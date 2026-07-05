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
    padding: 0.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--card);
  }
  .tabs button {
    flex: 1;
    min-height: 2.35rem;
    padding: 0.45rem 0.55rem;
    border: 0;
    background: transparent;
    color: var(--fg-secondary);
    border-radius: var(--radius-pill);
    font: inherit;
    cursor: pointer;
  }
  .tabs button.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .tabs button:hover {
    background: var(--hover);
  }
</style>
