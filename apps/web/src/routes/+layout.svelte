<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { settings } from '$lib/stores/settings.svelte.js';

  let { children } = $props();

  // Apply persisted settings to <html> on the client.
  $effect(() => {
    settings.apply();
  });
</script>

<a class="skip-link" href="#main">К содержанию</a>

<header class="topbar">
  <nav class="topbar__inner">
    <a class="brand" href="{base}/">Евангельский синопсис</a>
    <div class="spacer"></div>
    <!-- Search and settings UI arrive in Plan 2B -->
  </nav>
</header>

<main id="main" class="container">
  {@render children()}
</main>

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
  }
  .brand {
    font-weight: 600;
    color: var(--fg);
  }
  .spacer {
    flex: 1;
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
    z-index: 20;
    background: var(--bg);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
  }
</style>
