<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Примечания</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Примечания</b></nav>

<div class="prose">
  <h1>Примечания</h1>
  {#each data.footnotes as f (f.n)}<p><b>{f.n}.</b> {f.text}</p>{/each}
  {#if data.footnotes.length === 0}<p class="muted">Примечания не извлечены.</p>{/if}
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
  .muted {
    color: var(--fg-muted);
  }
</style>
