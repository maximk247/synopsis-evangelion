<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Предисловия</title></svelte:head>

<Breadcrumbs parent={{ label: 'Материалы', path: '/materials' }} />

<h1>Предисловия</h1>

<div class="prose">
  {#each data.prefaces as pref, i (i)}
    <section>
      <h2>{pref.title}</h2>
      {#each pref.paragraphs as para, j (j)}<p>{para}</p>{/each}
    </section>
  {/each}
  {#if data.prefaces.length === 0}<p class="muted">Предисловия не извлечены.</p>{/if}
</div>

<style>
  .prose {
    font-family: var(--reading-font);
    padding: clamp(1rem, 3vw, 1.5rem);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 76%, transparent);
    box-shadow: var(--shadow-sm);
  }
  .prose h2 {
    font-size: var(--fs-h3);
    margin-top: 0;
  }
  .muted {
    color: var(--fg-muted);
  }
</style>
