<script lang="ts">
  import type { NoteItem } from '@synopsis/schema';
  let { item }: { item: NoteItem } = $props();
</script>

<span class="note verse-text">{item.note}</span>

<style>
  .note {
    display: inline;
    font-style: italic;
    color: var(--fg-muted);
  }
</style>
