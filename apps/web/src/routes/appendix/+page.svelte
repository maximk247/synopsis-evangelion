<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import ScrollTable from '$lib/components/ScrollTable.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.appendix.title}</title></svelte:head>

<Breadcrumbs parent={{ label: 'Материалы', path: '/materials' }} />

<section class="page-head">
  <h1>{data.appendix.title}</h1>
  {#each data.appendix.intro as para, i (i)}<p class="intro">{para}</p>{/each}
</section>

<ScrollTable columns={data.appendix.columns} rows={data.appendix.rows} />

<style>
  .page-head {
    margin-bottom: 1rem;
  }
  .intro {
    max-width: 70ch;
    color: var(--fg-secondary);
  }
</style>
