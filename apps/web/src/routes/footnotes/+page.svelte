<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Примечания</title></svelte:head>

<Breadcrumbs parent={{ label: 'Материалы', path: '/materials' }} />

<h1>Примечания</h1>

<div class="prose">
  {#each data.footnotes as f (f.n)}<p><b>{f.n}.</b> {f.text}</p>{/each}
  {#if data.footnotes.length === 0}<p class="muted">Примечания не извлечены.</p>{/if}
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
  .prose p {
    max-width: 70ch;
    margin: 0;
  }
  .prose p + p {
    margin-top: 0.75rem;
  }
  .muted {
    color: var(--fg-muted);
  }
</style>
