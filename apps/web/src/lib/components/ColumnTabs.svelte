<script lang="ts">
  import { GOSPEL_LABELS, type GospelKey } from '$lib/data/labels.js';
  let {
    gospels,
    active,
    onselect
  }: {
    gospels: GospelKey[];
    active: GospelKey;
    onselect: (g: GospelKey) => void;
  } = $props();
</script>

<div class="tabs" role="tablist">
  {#each gospels as g (g)}
    <button
      role="tab"
      aria-selected={active === g}
      class:active={active === g}
      onclick={() => onselect(g)}
    >
      {GOSPEL_LABELS[g].nom}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }
  .tabs button {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    font: inherit;
    cursor: pointer;
  }
  .tabs button.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
