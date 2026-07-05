<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let {
    prevId,
    nextId,
    suffix = ''
  }: {
    prevId?: string | undefined;
    nextId?: string | undefined;
    /** query string appended to prev/next links, e.g. "?from=bookmarks" */
    suffix?: string;
  } = $props();

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && prevId) goto(`${base}/p/${prevId}${suffix}`);
      if (e.key === 'ArrowRight' && nextId) goto(`${base}/p/${nextId}${suffix}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<!-- Wide screens: floating arrows in the side gutters (also on ← / → keys) -->
{#if prevId}
  <a class="side side--left" href="{base}/p/{prevId}{suffix}" aria-label="Предыдущая перикопа (←)"
    >‹</a
  >
{/if}
{#if nextId}
  <a class="side side--right" href="{base}/p/{nextId}{suffix}" aria-label="Следующая перикопа (→)"
    >›</a
  >
{/if}

<!-- Narrow screens: the classic bottom pager -->
<div class="pager">
  {#if prevId}
    <a class="pbtn" href="{base}/p/{prevId}{suffix}" aria-label="Предыдущая перикопа">‹ Пред.</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">‹ Пред.</span>
  {/if}
  {#if nextId}
    <a class="pbtn" href="{base}/p/{nextId}{suffix}" aria-label="Следующая перикопа">След. ›</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">След. ›</span>
  {/if}
</div>

<style>
  /* each arrow owns its whole side gutter, from topbar to the bottom edge */
  .side {
    position: fixed;
    top: 4.5rem;
    bottom: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    width: max(4rem, calc((100vw - var(--page-max)) / 2));
    color: var(--fg-muted);
    font-family: var(--font-serif);
    font-size: 3.2rem;
    line-height: 1;
    opacity: 0.4;
    transition:
      opacity 0.2s ease,
      color 0.2s ease,
      background 0.2s ease;
  }
  .side--left {
    left: 0;
  }
  .side--right {
    right: 0;
  }
  .side:hover,
  .side:focus-visible {
    opacity: 1;
    color: var(--accent);
    backdrop-filter: blur(5px);
    text-decoration: none;
  }
  .side--left:hover,
  .side--left:focus-visible {
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }
  .side--right:hover,
  .side--right:focus-visible {
    background: linear-gradient(
      to left,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }

  .pager {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin: 1.5rem 0 0;
  }
  .pbtn {
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 0.55rem 0.9rem;
    background: var(--card);
    box-shadow: var(--shadow-sm);
  }
  a.pbtn:hover {
    border-color: var(--border-strong);
    background: var(--hover);
    text-decoration: none;
  }
  .pbtn.disabled {
    color: var(--fg-muted);
    opacity: 0.4;
    box-shadow: none;
  }

  /* side arrows need real gutters; below that fall back to the bottom pager */
  @media (min-width: 1300px) {
    .pager {
      display: none;
    }
  }
  @media (max-width: 1299.98px) {
    .side {
      display: none;
    }
  }
</style>
