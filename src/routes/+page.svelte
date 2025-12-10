<script>
  import { drift } from "$lib/stores/driftStore";
  import TopNav from "$lib/components/TopNav.svelte";
  import { onDestroy } from "svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  let minutesToday = 0;
  let coins = 0;
  let isDragging = false;
  let driftHistory = [];     // minutes per day
  let driftAverage = 60;    // default safe baseline
  let showAddModal = false;
  let addType = "doom"; // "doom" | "good"
  let newActivityName = "";

  let doomApps = [];
  let replacements = [];

  const unsubscribe = drift.subscribe((v) => {
    minutesToday = v.minutesToday;
    coins = v.coins;

    // Live sync of activity types
    doomApps = v.activityTypes?.doom || [];
    replacements = v.activityTypes?.good || [];
  });


  onDestroy(unsubscribe);

  $: hours = Math.floor(minutesToday / 60);
  $: minutes = minutesToday % 60;



  let draggedActivity = null;
  let convertedDoom = null;
  let coinPopIndex = null;

  onMount(() => {
    const saved = localStorage.getItem("drift-history");
    driftHistory = saved ? JSON.parse(saved) : [];
    recomputeAverage();
  });
  
  function onDragStart(act) {
    draggedActivity = act;
  }

  function onDrop(app) {
    if (!draggedActivity) return;

    const minutes = replaceMinutes[draggedActivity];
    const coinsGained = computeCoins(minutes);

    drift.replaceWithMinutes(draggedActivity, minutes, coinsGained);

    convertedDoom = app;
    coinPopIndex = { act: draggedActivity, value: coinsGained };

    setTimeout(() => {
      convertedDoom = null;
      coinPopIndex = null;
    }, 900);

    draggedActivity = null;
  }


  let doomMinutes = {
    TikTok: 15,
    Instagram: 15,
    YouTube: 15,
    Twitter: 15,
    Reddit: 15
  };

  $: doomApps.forEach(app => {
    if (doomMinutes[app] == null) {
      doomMinutes = { ...doomMinutes, [app]: 15 };
    }
  });


  let doomPulse = null;

  function logDoom(app) {
    drift.addMinutes(doomMinutes[app], app);

    doomPulse = app;
    setTimeout(() => (doomPulse = null), 600);
  }

  let replaceMinutes = {
    Read: 15,
    Gym: 15,
    Code: 15,
    Journal: 15,
    Music: 15
  };

  $: replacements.forEach(act => {
    if (replaceMinutes[act] == null) {
      replaceMinutes = { ...replaceMinutes, [act]: 15 };
    }
  });


  function computeCoins(minutes) {
    // Log-scaled reward: 5 min → 1 coin, 60 min → ~5 coins
    return Math.max(1, Math.round(Math.log2(minutes)));
  }

  function commitTodayToHistory() {
    driftHistory.push(minutesToday);

    if (driftHistory.length > 7) {
      driftHistory.shift(); // keep 7-day rolling window
    }

    localStorage.setItem("drift-history", JSON.stringify(driftHistory));
    recomputeAverage();
  }

  function recomputeAverage() {
    if (!driftHistory.length) return;
    driftAverage =
      driftHistory.reduce((a, b) => a + b, 0) / driftHistory.length;
  }

  function addCustomActivity() {
    if (!newActivityName.trim()) return;

    drift.addActivityType(addType, newActivityName);

    newActivityName = "";
    showAddModal = false;
  }



  $: dangerRatio = Math.min(minutesToday / driftAverage, 2); 
  $: dangerStrength = Math.max(0, Math.min(1, (dangerRatio - 1)));

  // Lightning cursor follow
  onMount(() => {
    const move = (e) => {
      document.body.style.setProperty("--x", `${e.clientX}px`);
      document.body.style.setProperty("--y", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", move);

    return () => window.removeEventListener("mousemove", move);
  });

  // Toggle lightning cursor during drag
  $: if (browser) {
    if (isDragging) {
      document.body.classList.add("dragging-replace");
    } else {
      document.body.classList.remove("dragging-replace");
    }
  }

  onMount(() => {
    const forceRelease = () => {
      isDragging = false;
      draggedActivity = null;
    };

    window.addEventListener("pointerup", forceRelease);
    window.addEventListener("blur", forceRelease);

    return () => {
      window.removeEventListener("pointerup", forceRelease);
      window.removeEventListener("blur", forceRelease);
    };
  });
  
  let scrolled = false;

  onMount(() => {
    const handler = () => {
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;

      scrolled = y > 0;
      console.log("REAL scrollY:", y);
    };

    window.addEventListener("scroll", handler, { passive: true });
    document.addEventListener("scroll", handler, { passive: true });

    handler();

    return () => {
      window.removeEventListener("scroll", handler);
      document.removeEventListener("scroll", handler);
    };
  });

  function removeActivity(type, name) {
    drift.removeActivityType(type, name);

    // clean up local minute state so no ghosts remain
    if (type === "doom") {
      const { [name]: _, ...rest } = doomMinutes;
      doomMinutes = rest;
    } else {
      const { [name]: _, ...rest } = replaceMinutes;
      replaceMinutes = rest;
    }
  }


</script>

<div class="top-shell" class:blurred={scrolled}>

  <TopNav />


  <div class="overlay">
    <div class="time">{hours}h {minutes}m drifted today</div>
    <div class="coins">
      {coins} coins 
      {#if dangerStrength > 0.25}
        · drifting high
      {/if}
    </div>
  </div>
</div>

{#if showAddModal}
  <div class="modal-backdrop">
    <div class="modal">
      <h3>Add {addType === "doom" ? "Doom App" : "Good Habit"}</h3>

      <input
        placeholder="Name"
        bind:value={newActivityName}
        on:keydown={(e) => e.key === "Enter" && addCustomActivity()}
      />

      <div class="modal-actions">
        <button on:click={() => (showAddModal = false)}>Cancel</button>
        <button on:click={addCustomActivity}>Add</button>
      </div>
    </div>
  </div>
{/if}


<main>

<div
  class="danger-overlay"
  style="--danger: {dangerStrength}"
></div>

  <!-- ✅ FIXED COLUMNS WRAPPER -->
  <div class="columns">

    <!-- LEFT: DOOM -->
    <div class="column left">
      <h2>
        Doom Sources
        <button on:click={() => { showAddModal = true; addType = "doom"; }}>+</button>
      </h2>


      {#each doomApps as app}
        <div
          class="card doom {(convertedDoom === app || doomPulse === app) ? 'pulse' : ''}"
          on:pointerup={() => {
            if (isDragging) onDrop(app);
          }}

        >
          <div class="doom-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>{app}</span>
            <button
              on:click|stopPropagation={() => removeActivity("doom", app)}
              style="background:transparent; border:none; color:rgba(255,255,255,0.4); cursor:pointer;"
            >
              🗑
            </button>
          </div>


          <div class="doom-controls">
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={doomMinutes[app]}
              on:input={(e) => {
                doomMinutes = {
                  ...doomMinutes,
                  [app]: +e.target.value
                };
              }}
            />

            <button on:click={() => logDoom(app)}>
              +{doomMinutes[app]}m
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- RIGHT: REPLACEMENTS -->
    <div class="column right">
      <h2>
        Replacements
        <button on:click={() => { showAddModal = true; addType = "good"; }}>+</button>
      </h2>


      {#each replacements as act}
        <div
          class="card good"
          on:pointerdown={(e) => {
            if (e.target.tagName === "INPUT") return;

            draggedActivity = act;
            isDragging = true;
          }}

          on:pointerup={() => {
            isDragging = false;
            draggedActivity = null;
          }}
        >


          <div class="replace-title" style="display:flex; justify-content:space-between; align-items:center;">
            <span>{act}</span>
            <button
              on:click|stopPropagation={() => removeActivity("good", act)}
              style="background:transparent; border:none; color:rgba(255,255,255,0.4); cursor:pointer;"
            >
              🗑
            </button>
          </div>


          <div class="replace-controls">
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={replaceMinutes[act]}
              on:mousedown|stopPropagation
              on:touchstart|stopPropagation
              on:input={(e) => {
                replaceMinutes = {
                  ...replaceMinutes,
                  [act]: +e.target.value
                };
              }}
            />

            <div class="coin-preview">
              {replaceMinutes[act]} min ≈ {computeCoins(replaceMinutes[act])} coins
            </div>

          </div>

          {#if coinPopIndex?.act === act}
            <span class="coin-pop">+{coinPopIndex.value}</span>
          {/if}
        </div>
      {/each}


    </div>

  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0e0e11;
    color: white;
    font-family: system-ui;
  }
  main {
    min-height: 100vh;
    width: 100%;
    position: relative;
    padding-top: 0;

  }


  .danger-overlay {
    pointer-events: none;      /* never blocks interaction */
    position: fixed;
    inset: 0;                  /* true full screen */
    z-index: 2;

    box-shadow:
      inset 0 0 140px rgba(255, 0, 0, calc(var(--danger) * 0.25));
    
    transition: box-shadow 0.6s ease;
  }

  .time {
    font-size: 1.3rem;
    letter-spacing: 0.08em;
  }

  .coins {
    font-size: 0.8rem;
    opacity: 0.6;
    margin-top: 0.3rem;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 5rem;  /* pushes content down visually but still allows blur */

  }


  .column {
    padding: 3rem;
  }

  h2 {
    font-weight: 400;
    opacity: 0.7;
    margin-bottom: 1rem;
  }

  .card {
    padding: 0.9rem;
    margin-bottom: 0.8rem;
    border-radius: 12px;
    text-align: center;
    position: relative;
    transition: all 0.25s ease;
  }

  .doom {
    background: rgba(255, 255, 255, 0.06);
    opacity: 1;                              /* ✅ KEEP CARD SOLID */
  }

  .doom.pulse {
    opacity: 1;
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.15);
  }

  .doom-title,
  .doom-controls {
    opacity: 0.75;                           /* ✅ Only fade text, not interaction */
  }

  .doom-controls input[type="range"] {
    flex: 1;
    opacity: 0.6;
  }

  .doom-controls button {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 0.2rem 0.6rem;
    font-size: 0.7rem;
    cursor: pointer;
    opacity: 0.6;
    border-radius: 6px;
  }

  .doom-controls button:hover {
    opacity: 1;
  }

  .good {
    cursor: grab;
    user-select: none;
  }

  .good:active {
    cursor: grabbing;
  }

  .good:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .coin-pop {
    position: absolute;
    right: -1.2rem;
    top: 0.2rem;
    font-size: 0.9rem;
    color: gold;
    animation: pop 0.8s ease forwards;
  }

    /* ===== THEMED SLIDER ===== */

  .doom-controls input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    outline: none;
    transition: background 0.2s ease;
  }

  /* Track hover */
  .doom-controls input[type="range"]:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  /* ===== THUMB (CHROME, EDGE, SAFARI) ===== */
  .doom-controls input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  /* Thumb hover */
  .doom-controls input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
  }

  /* ===== THUMB (FIREFOX) ===== */
  .doom-controls input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    border: none;
  }

  /* ===== FIREFOX TRACK ===== */
  .doom-controls input[type="range"]::-moz-range-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
  }

  /* ===== USE SAME SLIDER THEME FOR REPLACEMENTS ===== */

  .replace-controls input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    outline: none;
    transition: background 0.2s ease;
  }

  .replace-controls input[type="range"]:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .replace-controls input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .replace-controls input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.9);
  }

  .replace-controls input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    border: none;
  }

  .replace-controls input[type="range"]::-moz-range-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
  }


  .replace-title {
    margin-bottom: 0.4rem;
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .replace-controls {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .coin-preview {
    font-size: 0.65rem;
    opacity: 0.6;
    text-align: right;
  }

  /* ⚡ Lightning cursor during replacement drag */
  :global(body.dragging-replace) {
    cursor: none;
  }

  :global(body.dragging-replace::after) {
    content: "⚡";
    position: fixed;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);  /* ✅ PERFECT CENTERING */
    font-size: 22px;
    pointer-events: none;
    z-index: 999999;
    color: gold;
    text-shadow: 0 0 12px rgba(255, 215, 0, 0.8);
  }

  .top-shell {
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 50;

    padding-top: 1.25rem;
    padding-bottom: 0.85rem;

    display: flex;
    flex-direction: column;
    align-items: center;

    /* IMPORTANT: must be transparent for blur to show */
    background: rgba(14, 14, 17, 0.25);

    transition:
      backdrop-filter 0.3s ease,
      -webkit-backdrop-filter 0.3s ease,
      background 0.3s ease,
      box-shadow 0.3s ease;
  }

  .top-shell.blurred {
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    background: rgba(14, 14, 17, 0.70);
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
  }

  /* Drift text inside header */
  .top-shell .overlay {
    margin-top: 0.6rem;
    text-align: center;
  }


  .time {
    font-size: 1.3rem;
    letter-spacing: 0.08em;
  }

  .coins {
    font-size: 0.8rem;
    opacity: 0.6;
    margin-top: 0.3rem;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal {
    background: #111;
    padding: 1.5rem;
    border-radius: 12px;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .modal input {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    padding: 0.4rem 0.6rem;
    color: white;
    border-radius: 6px;
  }

  .modal-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
  }

  .modal-actions button {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
  }



  



  @keyframes pop {
    0% {
      opacity: 0;
      transform: translateY(0);
    }
    20% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
</style>
