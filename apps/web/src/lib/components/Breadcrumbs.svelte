<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  let {
    parent
  }: {
    /** Optional middle crumb; `path` is app-relative (e.g. "/materials" or "/#section-2"). */
    parent?: { label: string; path?: string } | undefined;
  } = $props();

  // back button: to the nearest list — the parent when it is a link, else the contents
  const backHref = $derived(parent?.path ? `${base}${parent.path}` : `${base}/`);

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented) return; // settings menu consumes its own Esc
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    goto(backHref);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Path to the current page (only when there is a real path); the back button is always there. -->
<nav class="crumbs" aria-label="Хлебные крошки">
  {#if parent}
    <a href="{base}/">Содержание</a>
    <span aria-hidden="true">›</span>
    {#if parent.path}
      <a href="{base}{parent.path}">{parent.label}</a>
    {:else}
      <span>{parent.label}</span>
    {/if}
  {/if}
  <a class="back" href={backHref} aria-label="Назад к списку">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  </a>
</nav>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0 0 1rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .crumbs a {
    color: var(--fg-muted);
  }
  .crumbs a:hover {
    color: var(--accent);
  }
  .back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    width: 4.25rem;
    height: 2.4rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 2px);
    background: var(--card);
    box-shadow: var(--shadow-sm);
    color: var(--fg);
  }
  .back svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  .back:hover {
    background: var(--hover);
    border-color: var(--border-strong);
    text-decoration: none;
    color: var(--fg);
  }
</style>
