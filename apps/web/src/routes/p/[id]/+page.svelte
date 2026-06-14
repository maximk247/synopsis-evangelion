<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Pager from '$lib/components/Pager.svelte';
  import PericopeColumns from '$lib/components/PericopeColumns.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import { reading } from '$lib/stores/reading.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const p = $derived(data.pericope);

  // remember reading position
  $effect(() => {
    reading.set({ id: p.id, title: p.title });
  });

  // deep-link to a verse via hash: #mt-3-13
  onMount(() => {
    function scrollToHash() {
      const hash = location.hash.replace(/^#/, '');
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('deep-target');
        setTimeout(() => el.classList.remove('deep-target'), 2000);
      }
    }
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  });
</script>

<svelte:head><title>{p.id}. {p.title}</title></svelte:head>

<Breadcrumbs sectionTitle={data.sectionTitle} current="{p.id}. {p.title}" />

<header class="phead">
  <div class="phead__top">
    <h1>{p.id}. {p.title}</h1>
    <BookmarkButton id={p.id} />
  </div>
  {#if p.place}<p class="place">{p.place}</p>{/if}
  {#if p.headnote}<p class="headnote">{p.headnote}</p>{/if}
</header>

<PericopeColumns pericope={p} present={data.present} />

{#if p.extra}
  <section class="extra">
    <h2>{p.extra.source}</h2>
    <p class="flow">
      {#each p.extra.items as v, i (i)}
        <span class="verse-text"><sup class="vnum">{v.v}{v.suf}</sup> {v.t}</span>{' '}
      {/each}
    </p>
  </section>
{/if}

<Pager prevId={data.prevId} nextId={data.nextId} />

<style>
  .phead {
    margin-bottom: 1rem;
  }
  .phead__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .phead h1 {
    font-size: 1.4rem;
    margin: 0 0 0.25rem;
  }
  .place {
    color: var(--fg-muted);
    font-style: italic;
    margin: 0 0 0.5rem;
  }
  .headnote {
    background: var(--bg-soft);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
  }
  .extra {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  .vnum {
    color: var(--fg-muted);
    font-weight: 600;
  }
  :global(.deep-target) {
    background: var(--highlight);
    border-radius: 3px;
    transition: background 0.4s;
  }
</style>
