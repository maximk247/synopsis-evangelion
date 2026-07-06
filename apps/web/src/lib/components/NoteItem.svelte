<script lang="ts">
  import type { NoteItem } from '@synopsis/schema';
  let { item }: { item: NoteItem } = $props();
</script>

<span class="note verse-text">{item.note}</span>

<style>
  /* inline: consecutive note lines from the source flow together as one paragraph.
     These are the book's small-print gospel passages — read as normal text. */
  .note {
    display: inline;
  }
</style>
