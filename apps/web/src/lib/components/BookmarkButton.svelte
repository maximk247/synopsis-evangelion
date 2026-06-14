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
    background: var(--bg);
    color: var(--fg-muted);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
    white-space: nowrap;
  }
  .bm.active {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
