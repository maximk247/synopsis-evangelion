<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { settings } from '$lib/stores/settings.svelte.js';
  import SearchBox from '$lib/components/SearchBox.svelte';
  import SettingsDrawer from '$lib/components/SettingsDrawer.svelte';

  let { children } = $props();
  let settingsOpen = $state(false);

  $effect(() => {
    settings.apply();
  });
</script>

<a class="skip-link" href="#main">К содержанию</a>

<header class="topbar">
  <nav class="topbar__inner">
    <a class="brand" href="{base}/">Синопсис</a>
    <SearchBox />
    <div class="links">
      <a href="{base}/read/lk">Читать</a>
      <a href="{base}/bookmarks">Закладки</a>
      <a href="{base}/prefaces">Предисловия</a>
      <a href="{base}/footnotes">Примечания</a>
      <a href="{base}/appendix">Хронология</a>
    </div>
    <button class="gear" onclick={() => (settingsOpen = true)} aria-label="Настройки">⚙</button>
  </nav>
</header>

<main id="main" class="container">
  {@render children()}
</main>

<SettingsDrawer bind:open={settingsOpen} />

<style>
  .topbar {
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .topbar__inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.6rem 1rem;
    flex-wrap: wrap;
  }
  .brand {
    font-weight: 600;
    color: var(--fg);
  }
  .links {
    display: flex;
    gap: 0.75rem;
    font-size: 0.9em;
  }
  .gear {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    font-size: 1rem;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }
  .skip-link {
    position: absolute;
    left: -9999px;
  }
  .skip-link:focus {
    left: 1rem;
    top: 0.5rem;
    z-index: 200;
    background: var(--bg);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
  }

  @media (max-width: 760px) {
    .links {
      order: 3;
      width: 100%;
      overflow-x: auto;
    }
  }
</style>
