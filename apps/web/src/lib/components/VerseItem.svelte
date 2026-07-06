<script lang="ts">
  import type { VerseItem } from '@synopsis/schema';
  let { item, id }: { item: VerseItem; id: string } = $props();
</script>

<span class="verse" {id}><sup class="vnum">{item.v}{item.suf}</sup><span class="verse-text"
    >{item.t}</span
  ></span
>

<style>
  .verse {
    display: block;
    padding-left: 1.8em;
    text-indent: -1.8em;
    margin-bottom: 0.3em;
    scroll-margin-top: 4rem;
  }
  /* fixed-width number box: first-line text always starts exactly at the 1.8em
     hanging indent, whether the number is "1" or "14а" */
  .vnum {
    display: inline-block;
    font-size: 0.75em;
    width: calc(1.35em / 0.75);
    margin-right: calc(0.45em / 0.75);
    text-align: center;
    text-indent: 0;
    color: var(--accent-subtle);
    font-weight: 600;
  }
</style>
