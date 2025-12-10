<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app-scroll">
  {@render children()}
</div>

<style>
  .app-scroll {
    min-height: 100vh;
    width: 100%;
  }
</style>
