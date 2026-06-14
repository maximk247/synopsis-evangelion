<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Предисловия</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Предисловия</b></nav>

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
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .prose {
    max-width: 70ch;
  }
  .prose h2 {
    font-size: 1.1rem;
  }
  .muted {
    color: var(--fg-muted);
  }
</style>
