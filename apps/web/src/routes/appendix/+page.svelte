<script lang="ts">
  import { base } from '$app/paths';
  import ScrollTable from '$lib/components/ScrollTable.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.appendix.title}</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Хронология</b></nav>

<h1>{data.appendix.title}</h1>
{#each data.appendix.intro as para, i (i)}<p class="intro">{para}</p>{/each}

<ScrollTable columns={data.appendix.columns} rows={data.appendix.rows} />

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .intro {
    max-width: 70ch;
    color: var(--fg-muted);
  }
</style>
