<script>
  import { page } from "$app/stores";
</script>

<nav class="topnav">
  <a href="/" class:active={$page.url.pathname === "/"}>Dashboard</a>
  <a href="/shop" class:active={$page.url.pathname === "/shop"}>Shop</a>
  <a href="/data" class:active={$page.url.pathname === "/data"}>Data</a>
</nav>

<style>
  .topnav {
    position: fixed;
    top: 1.2rem;
    right: 1.5rem;
    display: flex;
    gap: 1.2rem;
    font-family: system-ui;
    z-index: 2000;
  }

  .topnav a {
    all: unset;                  /* 🔥 THIS removes purple + link defaults */
    cursor: pointer;
    color: white;
    opacity: 0.65;
    font-size: 0.9rem;
    transition: opacity 0.2s ease;
    border-bottom: 1px solid transparent;
  }

  .topnav a:hover {
    opacity: 1;
  }

  .topnav a.active {
    opacity: 1;
    border-bottom: 1px solid white;
  }
</style>
