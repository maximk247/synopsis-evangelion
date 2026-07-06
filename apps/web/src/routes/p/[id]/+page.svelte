<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { isVerse } from '@synopsis/schema';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Pager from '$lib/components/Pager.svelte';
  import PericopeColumns from '$lib/components/PericopeColumns.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  import { reading } from '$lib/stores/reading.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const p = $derived(data.pericope);
  const hasVerses = $derived(
    Object.values(p.columns).some((c) => c?.segments.some((s) => s.items.some(isVerse)))
  );

  // opened from the bookmarks list: arrows walk the bookmarks, back leads to them
  const fromBookmarks = $derived(
    browser && page.url.searchParams.get('from') === 'bookmarks' && bookmarks.ids.includes(p.id)
  );
  const bmIndex = $derived(bookmarks.ids.indexOf(p.id));
  const prevId = $derived(fromBookmarks ? bookmarks.ids[bmIndex - 1] : data.prevId);
  const nextId = $derived(fromBookmarks ? bookmarks.ids[bmIndex + 1] : data.nextId);
  const linkSuffix = $derived(fromBookmarks ? '?from=bookmarks' : '');

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

<Breadcrumbs
  parent={fromBookmarks
    ? { label: 'Закладки', path: '/bookmarks' }
    : data.sectionTitle
      ? {
          label: data.sectionTitle,
          // first section sits right under the page header — show the whole top
          path: data.sectionId === 0 ? '/' : `/#section-${data.sectionId}`
        }
      : undefined}
/>

<header class="phead">
  <div class="phead__top">
    <div>
      <p class="overline">Перикопа {p.id}</p>
      <h1>{p.title}</h1>
    </div>
    <BookmarkButton id={p.id} />
  </div>
  {#if p.place}<p class="place">{p.place}</p>{/if}
  {#if p.headnote}<p class="headnote">{p.headnote}</p>{/if}
</header>

{#if data.children.length}
  <nav class="children" aria-label="Состав перикопы">
    <h2 class="children__title">Состав</h2>
    <ul>
      {#each data.children as c (c.id)}
        <li>
          <a href="{base}/p/{c.id}">
            <span class="children__id">{c.id}</span>
            <span>{c.title}</span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

{#if hasVerses || !data.children.length}
  <PericopeColumns pericope={p} present={data.present} />
{/if}

{#if p.extra}
  <section class="extra">
    <h2>{p.extra.source}</h2>
    <div class="flow">
      {#each p.extra.items as v, i (i)}
        <span class="everse verse-text"><sup class="vnum">{v.v}{v.suf}</sup>{v.t}</span>
      {/each}
    </div>
  </section>
{/if}

<Pager {prevId} {nextId} suffix={linkSuffix} />

<style>
  .phead {
    margin-bottom: 1rem;
    padding: clamp(1rem, 3vw, 1.5rem);
    border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 76%, transparent);
    box-shadow: var(--shadow-sm);
  }
  .phead__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .phead .overline {
    margin: 0 0 0.35rem;
  }
  .phead h1 {
    font-size: var(--fs-h1);
    margin: 0 0 0.25rem;
  }
  .place {
    color: color-mix(in srgb, var(--fg-muted) 82%, transparent);
    font-style: italic;
    font-size: var(--fs-ui-sm);
    margin: 0.35rem 0 0;
  }
  .headnote {
    background: var(--card);
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    color: var(--fg-secondary);
  }
  .children {
    margin-bottom: 1rem;
    border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 68%, transparent);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .children__title {
    font-size: var(--fs-h3);
    margin: 0;
    padding: 0.85rem 1rem 0.7rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
    background: color-mix(in srgb, var(--surface) 56%, transparent);
  }
  .children ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .children li + li {
    border-top: 1px solid color-mix(in srgb, var(--border) 48%, transparent);
  }
  .children a {
    display: grid;
    grid-template-columns: 3.4rem minmax(0, 1fr);
    gap: 0.65rem;
    align-items: center;
    min-height: 2.85rem;
    padding: 0.35rem 1rem;
    color: var(--fg);
  }
  .children a:hover {
    background: var(--hover);
    text-decoration: none;
  }
  .children__id {
    color: var(--accent-medium);
    font-variant-numeric: tabular-nums;
    text-align: right;
    font-size: var(--fs-ui-sm);
    font-weight: var(--fw-medium);
  }
  .extra {
    margin-top: 1.5rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 4px);
    background: color-mix(in srgb, var(--card) 72%, transparent);
  }
  .vnum {
    display: inline-block;
    font-size: 0.75em;
    width: calc(1.35em / 0.75);
    margin-right: calc(0.45em / 0.75);
    text-align: center;
    text-indent: 0;
    color: var(--accent-subtle);
    font-weight: 600;
  }
  .everse {
    display: block;
    padding-left: 1.8em;
    text-indent: -1.8em;
    margin-bottom: 0.3em;
  }
  :global(.deep-target) {
    background: var(--highlight);
    border-radius: 3px;
    transition: background 0.4s;
  }

  @media (max-width: 760px) {
    .phead__top {
      display: grid;
    }
  }
</style>
