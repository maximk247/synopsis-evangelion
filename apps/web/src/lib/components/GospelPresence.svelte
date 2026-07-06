<script lang="ts">
  import { GOSPELS, GOSPEL_LABELS, type GospelKey } from '$lib/data/labels.js';
  let { present }: { present: GospelKey[] } = $props();

  const visible = $derived(GOSPELS.filter((g) => present.includes(g)));
  const label = $derived(
    visible.length
      ? `Евангелия в перикопе: ${visible.map((g) => GOSPEL_LABELS[g].nom).join(', ')}`
      : 'Евангелия не указаны'
  );
</script>

<span class="presence" aria-label={label}>
  {#each visible as g (g)}
    <span class="chip" aria-hidden="true">{GOSPEL_LABELS[g].abbr}</span>
  {/each}
</span>

<style>
  .presence {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }
  .chip {
    min-width: 1.55rem;
    font-size: var(--fs-caption);
    line-height: 1;
    padding: 0.22rem 0.34rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
    text-align: center;
    font-weight: var(--fw-medium);
  }
</style>
