<script lang="ts">
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  let { id }: { id: string } = $props();
  const active = $derived(bookmarks.has(id));
</script>

<button
  class="bm"
  class:active
  aria-pressed={active}
  onclick={() => bookmarks.toggle(id)}
  title={active ? 'Убрать из закладок' : 'В закладки'}
>
  {active ? '★' : '☆'} Закладка
</button>

<style>
  .bm {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--fg-muted);
    border-radius: var(--radius-pill);
    padding: 0.45rem 0.75rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
    white-space: nowrap;
    box-shadow: var(--shadow-sm);
  }
  .bm:hover {
    border-color: var(--border-strong);
    background: var(--hover);
  }
  .bm.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
