<script lang="ts">
  import type { VerseItem } from '@synopsis/schema';
  let {
    item,
    id,
    highlighted = false,
    onhover
  }: {
    item: VerseItem;
    id: string;
    highlighted?: boolean;
    onhover?: (key: string | null) => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="verse"
  class:highlighted
  {id}
  onmouseenter={() => onhover?.(id)}
  onmouseleave={() => onhover?.(null)}
>
  <sup class="vnum">{item.v}{item.suf}</sup>
  <span class="verse-text">{item.t}</span>
</span>

<style>
  .verse {
    display: inline;
    scroll-margin-top: 4rem;
  }
  .vnum {
    color: var(--fg-muted);
    font-weight: 600;
    margin-right: 0.15em;
  }
  .highlighted {
    background: var(--highlight);
    border-radius: 3px;
  }
</style>
