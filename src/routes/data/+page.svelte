<script>
  import { drift } from "$lib/stores/driftStore";
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import TopNav from "$lib/components/TopNav.svelte";
  import { browser } from "$app/environment";


  let daily = {};
  let history = [];

  const unsubscribe = drift.subscribe((v) => {
    daily = v.daily || {};
    history = v.history || [];
  });


  onMount(() => {
    draw();
    return unsubscribe;
  });

  $: if (browser && Object.keys(daily).length >= 0) {
    requestAnimationFrame(() => {
      d3.select("#chart").selectAll("*").remove();
      d3.select("#bars").selectAll("*").remove();
      d3.select("#heatmap").selectAll("*").remove();
      draw();
    });
  }

  // ---------- SUMMARY METRICS ----------




  $: todayKeyStr = new Date().toISOString().slice(0, 10);
  $: todayStats = daily[todayKeyStr] || { doom: 0, good: 0 };

  $: hasAnyDoomData = history.some(e => e.category === "doom");
  $: hasAnyGoodData = history.some(e => e.category === "good");

  $: mostUsedApp = (() => {
    if (!hasAnyDoomData) return "Add doom categories to see data";

    const counts = {};
    history.forEach(e => {
      if (e.category === "doom") {
        counts[e.activity] = (counts[e.activity] || 0) + e.minutes;
      }
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1])?.[0]?.[0]
      ?? "Add doom categories to see data";
  })();

  $: mostDoneGood = (() => {
    if (!hasAnyGoodData) return "Add good habits to see data";

    const counts = {};
    history.forEach(e => {
      if (e.category === "good") {
        counts[e.activity] = (counts[e.activity] || 0) + e.minutes;
      }
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1])?.[0]?.[0]
      ?? "Add good habits to see data";
  })();



  let doomDist = [];
  let goodDist = [];

  $: {
    const doomMap = {};
    const goodMap = {};

    drift.subscribe(v => {
      v.history.forEach(e => {
        if (e.category === "doom") {
          doomMap[e.activity] = (doomMap[e.activity] || 0) + e.minutes;
        } else {
          goodMap[e.activity] = (goodMap[e.activity] || 0) + e.minutes;
        }
      });

      doomDist = Object.entries(doomMap)
        .map(([k, v]) => ({ activity: k, minutes: v }))
        .sort((a, b) => b.minutes - a.minutes);

      goodDist = Object.entries(goodMap)
        .map(([k, v]) => ({ activity: k, minutes: v }))
        .sort((a, b) => b.minutes - a.minutes);
    });

    if (browser) {
    requestAnimationFrame(() => {
      d3.select("#doom-bars").selectAll("*").remove();
      d3.select("#good-bars").selectAll("*").remove();
      drawActivityBars(doomDist, "#doom-bars", "#ff3b3b");
      drawActivityBars(goodDist, "#good-bars", "#2cff8f");
    });
  }
  }



  function draw() {
    const data = Object.entries(daily)
      .map(([date, v]) => ({
        date: new Date(date),
        doom: v.doom,
        good: v.good,
        net: v.good - v.doom
      }))
      .sort((a, b) => a.date - b.date);

    if (!data.length) return;

    const windowSize = 7;
    const ma = data.map((d, i) => {
      const start = Math.max(0, i - windowSize + 1);
      const slice = data.slice(start, i + 1);
      return {
        date: d.date,
        doom: d3.mean(slice, (s) => s.doom) ?? 0,
        good: d3.mean(slice, (s) => s.good) ?? 0,
        net: d3.mean(slice, (s) => s.net) ?? 0
      };
    });

    drawLineChart(ma);
    drawStackedBars(data);
    drawHeatmap(data);
  }

  function drawLineChart(ma) {
    const width = 900;
    const height = 420;
    const margin = { top: 40, right: 40, bottom: 70, left: 70 };

    const svg = d3.select("#chart").append("svg").attr("width", width).attr("height", height);

    const x = d3.scaleTime().domain(d3.extent(ma, (d) => d.date)).range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(ma, (d) => Math.min(d.doom, d.good, d.net)),
        d3.max(ma, (d) => Math.max(d.doom, d.good, d.net))
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = (key) =>
      d3.line().x((d) => x(d.date)).y((d) => y(d[key]));

    svg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y));

    svg.append("text").attr("x", width / 2).attr("y", height - 20).attr("fill", "#aaa").attr("text-anchor", "middle").text("Date");
    svg.append("text").attr("x", -height / 2).attr("y", 18).attr("transform", "rotate(-90)").attr("fill", "#aaa").attr("text-anchor", "middle").text("Minutes");

    svg.append("path").datum(ma).attr("fill", "none").attr("stroke", "#ff3b3b").attr("stroke-width", 2).attr("d", line("doom"));
    svg.append("path").datum(ma).attr("fill", "none").attr("stroke", "#2cff8f").attr("stroke-width", 2).attr("d", line("good"));
    svg.append("path").datum(ma).attr("fill", "none").attr("stroke", "#3aa0ff").attr("stroke-width", 2).attr("d", line("net"));
  }

  function drawStackedBars(data) {
    const width = 900;
    const height = 320;
    const margin = { top: 40, right: 40, bottom: 60, left: 70 };

    const svg = d3.select("#bars").append("svg").attr("width", width).attr("height", height);

    const stack = d3.stack().keys(["doom", "good"]);
    const stackedData = stack(data);

    const x = d3.scaleBand().domain(data.map((d) => d.date)).range([margin.left, width - margin.right]).padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.doom + d.good)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg
      .append("g")
      .selectAll("g")
      .data(stackedData)
      .join("g")
      .attr("fill", (d) => (d.key === "doom" ? "#ff3b3b" : "#2cff8f"))
      .selectAll("rect")
      .data((d) => d)
      .join("rect")
      .attr("x", (d) => x(d.data.date))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());

    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.append("text").attr("x", width / 2).attr("y", height - 18).attr("fill", "#aaa").attr("text-anchor", "middle").text("Date");
    svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("fill", "#aaa").attr("text-anchor", "middle").text("Minutes");
  }

  function drawHeatmap(data) {
    const size = 22;
    const width = 900;
    const height = 180;
    const margin = { top: 40, right: 40, bottom: 40, left: 50 };

    const svg = d3
        .select("#heatmap")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // X scale = time scale to show real dates
    const x = d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.date))
        .range([margin.left, width - margin.right]);

    // Axis with day numbers
    svg
        .append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(
        d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%d"))
        );

    // Heatmap color scale
    const maxNet = d3.max(data, (d) => Math.abs(d.net));
    const color = d3
        .scaleLinear()
        .domain([-maxNet, 0, maxNet])
        .range(["#ff3b3b", "#222", "#2cff8f"]);

    // Heat cells
    svg
        .selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d) => x(d.date) - size / 2)
        .attr("y", 60)
        .attr("width", size)
        .attr("height", size)
        .attr("rx", 4)
        .attr("fill", (d) => color(d.net));

    // Axis label
    svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("fill", "#aaa")
        .attr("text-anchor", "middle")
        .text("Day of Month");

    }

  function drawActivityBars(data, target, color) {
    if (!data.length) return;

    const width = 900;
    const height = 320;
    const margin = { top: 30, right: 40, bottom: 40, left: 120 };

    const svg = d3
      .select(target)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const y = d3
      .scaleBand()
      .domain(data.map(d => d.activity))
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.minutes)])
      .nice()
      .range([margin.left, width - margin.right]);

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    svg.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", margin.left)
      .attr("y", d => y(d.activity))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.minutes) - margin.left)
      .attr("fill", color);
  }



</script>

<TopNav />

<div class="controls">
  <button class="primary" on:click={() => drift.simulateMonth()}>Simulate 30 Days</button>
  <button class="danger" on:click={() => drift.resetAll()}>Reset All Data</button>
</div>

<main class="data-shell">
  <h1>Drift Analytics</h1>

  <div class="stats-grid">
    <div class="stat">
      <span class="label">Today Doom</span>
      <span class="value doom">{todayStats.doom} min</span>
    </div>

    <div class="stat">
      <span class="label">Today Good</span>
      <span class="value good">{todayStats.good} min</span>
    </div>

    <div class="stat">
      <span class="label">Most Used App</span>
      <span class="value">{mostUsedApp}</span>
    </div>

    <div class="stat">
      <span class="label">Top Good Habit</span>
      <span class="value">{mostDoneGood}</span>
    </div>
  </div>


  <div class="card">
    <h2>7-Day Moving Average</h2>
    <div class="legend">
      <span class="doom">Doom</span>
      <span class="good">Good</span>
      <span class="net">Net</span>
    </div>
    <div id="chart"></div>
  </div>

  <div class="card">
    <h2>Daily Doom vs Good (Stacked)</h2>
    <div class="legend">
      <span class="doom">Doom</span>
      <span class="good">Good</span>
    </div>
    <div id="bars"></div>
  </div>

  <div class="card">
    <h2>Net Drift Heatmap</h2>
    <div id="heatmap"></div>
  </div>

  <div class="card">
    <h2>Doom App Distribution</h2>

    {#if doomDist.length === 0}
      <div class="empty-state">Add doom categories to see data</div>
    {:else}
      <div id="doom-bars"></div>
    {/if}
  </div>


  <div class="card">
    <h2>Good Habit Distribution</h2>

    {#if goodDist.length === 0}
      <div class="empty-state">Add good habits to see data</div>
    {:else}
      <div id="good-bars"></div>
    {/if}
  </div>




  
</main>

<style>
  .data-shell {
    min-height: 100vh;
    padding: 8rem 4rem 4rem;
    background: #0e0e11;
    color: white;
  }

  .controls {
    position: fixed;
    top: 5.5rem;
    right: 3rem;
    display: flex;
    gap: 1rem;
    z-index: 10;
  }

  button {
    border: none;
    padding: 0.7rem 1.4rem;
    border-radius: 999px;
    font-size: 0.8rem;
    cursor: pointer;
    letter-spacing: 0.08em;
  }

  button.primary {
    background: linear-gradient(135deg, #2cff8f, #3aa0ff);
    color: black;
  }

  button.danger {
    background: rgba(255, 60, 60, 0.2);
    color: #ff5c5c;
    border: 1px solid rgba(255, 92, 92, 0.5);
  }

  .card {
    margin-top: 3rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 2rem;
  }

  .legend {
    display: flex;
    gap: 1.2rem;
    margin-bottom: 1rem;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .legend span::before {
    content: "";
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 0.4rem;
  }

  .legend .doom::before { background: #ff3b3b; }
  .legend .good::before { background: #2cff8f; }
  .legend .net::before  { background: #3aa0ff; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .stat {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #aaa;
  }

  .stat .value {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .stat .doom { color: #ff3b3b; }
  .stat .good { color: #2cff8f; }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: rgba(255,255,255,0.35);
    font-size: 0.85rem;
    letter-spacing: 0.08em;
  }


</style>
