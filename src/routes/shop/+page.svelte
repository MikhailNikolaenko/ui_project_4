<script> 
  import { drift } from "$lib/stores/driftStore";
  import TopNav from "$lib/components/TopNav.svelte";

  let coins = 0;
  drift.subscribe((v) => (coins = v.coins));

  const shop = [
    {
      category: "Progression",
      items: [
        { name: "Coins Boost (24h)", cost: 25 },
        { name: "Streak Saver", cost: 30 },
        { name: "Daily Reset Token", cost: 15 },
        { name: "Reflection Unlock", cost: 20 }
      ]
    },

    {
      category: "Visual Upgrades",
      items: [
        { name: "Custom Theme", cost: 10 },
        { name: "Glow UI Mode", cost: 12 },
        { name: "Minimal Mode", cost: 8 },
        { name: "Retro Terminal Skin", cost: 14 },
        { name: "Animated Streak Effects", cost: 18 }
      ]
    }
  ];
</script>

<TopNav />

<main>
  <h1>Shop</h1>
  <p>{coins} coins available</p>

  {#each shop as section}
    <h2 style="margin-top: 2rem; font-weight: 400;">{section.category}</h2>

    <div class="items">
      {#each section.items as item}
        <div class="item">
          <span>{item.name}</span>
          <span>{item.cost} coins</span>
        </div>
      {/each}
    </div>
  {/each}
</main>

<style>
  main {
    min-height: 100vh;
    background: #0e0e11;
    color: white;
    font-family: system-ui;
    padding: 6rem 3rem;
  }

  h1 {
    font-weight: 400;
    margin-bottom: 1rem;
  }

  .items {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item {
    padding: 1rem;
    border-radius: 10px;
    background: rgba(255,255,255,0.1);
    display: flex;
    justify-content: space-between;
  }
</style>
