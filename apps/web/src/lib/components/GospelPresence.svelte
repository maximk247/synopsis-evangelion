<script lang="ts">
  import { GOSPELS, GOSPEL_LABELS, type GospelKey } from '$lib/data/labels.js';
  let { present }: { present: GospelKey[] } = $props();
</script>

<span class="presence" aria-label="Евангелия в перикопе">
  {#each GOSPELS as g (g)}
    <span class="chip" class:on={present.includes(g)} aria-hidden="true">
      {GOSPEL_LABELS[g].abbr}
    </span>
  {/each}
</span>

<style>
  .presence {
    display: inline-flex;
    gap: 0.2rem;
  }
  .chip {
    font-size: 0.72em;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    opacity: 0.35;
  }
  .chip.on {
    opacity: 1;
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
