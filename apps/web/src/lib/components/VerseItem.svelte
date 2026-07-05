<script lang="ts">
  import type { VerseItem } from '@synopsis/schema';
  let { item, id }: { item: VerseItem; id: string } = $props();
</script>

<span class="verse" {id}>
  <sup class="vnum">{item.v}{item.suf}</sup>
  <span class="verse-text">{item.t}</span>
</span>

<style>
  .verse {
    display: block;
    padding-left: 1.6em;
    text-indent: -1.6em;
    margin-bottom: 0.3em;
    scroll-margin-top: 4rem;
  }
  .vnum {
    color: var(--accent-subtle);
    font-weight: 600;
    margin-right: 0.15em;
  }
</style>
