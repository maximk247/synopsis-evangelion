<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { settings } from '$lib/stores/settings.svelte.js';
  import SettingsDrawer from '$lib/components/SettingsDrawer.svelte';

  let { children } = $props();
  let settingsOpen = $state(false);

  $effect(() => {
    settings.apply();
  });

  // active top-level section for the nav highlight
  const path = $derived(page.url.pathname.slice(base.length) || '/');
  const active = $derived(
    path === '/' || path.startsWith('/p/')
      ? 'contents'
      : path.startsWith('/bookmarks')
        ? 'bookmarks'
        : path.startsWith('/materials') ||
            path.startsWith('/prefaces') ||
            path.startsWith('/footnotes') ||
            path.startsWith('/read/')
          ? 'materials'
          : null
  );
</script>

<a class="skip-link" href="#main">К содержанию</a>

<header class="topbar">
  <nav class="topbar__inner">
    <a class="brand" href="{base}/">
      <span class="brand__mark" aria-hidden="true">С</span>
      <span>Синопсис</span>
    </a>
    <div class="links">
      <a href="{base}/" class:active={active === 'contents'}>Содержание</a>
      <a href="{base}/bookmarks" class:active={active === 'bookmarks'}>Закладки</a>
      <a href="{base}/materials" class:active={active === 'materials'}>Материалы</a>
    </div>
    <button class="gear" onclick={() => (settingsOpen = true)} aria-label="Настройки">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </nav>
</header>

<main id="main" class="container">
  {@render children()}
</main>

<SettingsDrawer bind:open={settingsOpen} />

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(18px);
  }
  .topbar__inner {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    max-width: var(--page-max);
    margin: 0 auto;
    min-height: 4.25rem;
    padding: 0.65rem var(--gutter);
    flex-wrap: wrap;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    font-weight: var(--fw-bold);
    font-size: 1.25rem;
    color: var(--fg);
    font-family: var(--font-serif);
    white-space: nowrap;
    letter-spacing: 0.01em;
  }
  .brand:hover {
    text-decoration: none;
  }
  .brand__mark {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.35rem;
    border: 1px solid transparent;
    border-radius: calc(var(--radius) + 2px);
    background:
      linear-gradient(var(--surface), var(--surface)) padding-box,
      linear-gradient(135deg, var(--accent), var(--accent-subtle)) border-box;
    color: var(--accent);
    box-shadow: var(--shadow-sm);
  }
  .links {
    display: flex;
    margin-left: auto;
    gap: 0.2rem;
    font-size: var(--fs-ui-sm);
    align-items: stretch;
    height: 2.75rem;
    padding: 0.25rem;
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--card) 86%, transparent);
  }
  .links a {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.75rem;
    border-radius: var(--radius-pill);
    color: var(--fg-secondary);
    white-space: nowrap;
  }
  .links a:hover {
    background: var(--hover);
    color: var(--accent);
    text-decoration: none;
  }
  .links a.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .gear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg-secondary);
    border-radius: var(--radius-pill);
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .gear svg {
    width: 1.35rem;
    height: 1.35rem;
    transition: transform 0.25s ease;
  }
  .gear:hover {
    border-color: var(--border-strong);
    background: var(--hover);
    color: var(--accent);
  }
  .gear:hover svg {
    transform: rotate(40deg);
  }
  .container {
    max-width: var(--page-max);
    margin: 0 auto;
    padding: clamp(1.25rem, 3vw, 2.5rem) var(--gutter) 4rem;
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
    .topbar__inner {
      min-height: auto;
    }
    .brand {
      flex: 1;
    }
    .links {
      order: 3;
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-radius: var(--radius);
      justify-content: stretch;
    }
    .links a {
      justify-content: center;
      min-width: 0;
      padding-inline: 0.45rem;
    }
  }
</style>
