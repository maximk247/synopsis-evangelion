<script lang="ts">
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import GospelPresence from '$lib/components/GospelPresence.svelte';
  import ToTop from '$lib/components/ToTop.svelte';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { loadSynopsis, type SynopsisModel } from '$lib/data/synopsis.js';
  import {
    buildSearchIndex,
    search,
    type SearchIndex,
    type SearchResult
  } from '$lib/data/search.js';
  import { reading } from '$lib/stores/reading.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let query = $state('');
  const normalized = $derived(query.trim().toLowerCase());

  function matches(item: { id: string; title: string; place: string | null }): boolean {
    if (!normalized) return true;
    if (item.id.toLowerCase().includes(normalized)) return true;
    if (item.title.toLowerCase().includes(normalized)) return true;
    if (item.place && item.place.toLowerCase().includes(normalized)) return true;
    return false;
  }

  const anyTitleMatch = $derived(data.sections.some((s) => s.items.some(matches)));

  // full-text search over verse text kicks in from 3 characters (lazy-loads the index)
  let model = $state<SynopsisModel | null>(null);
  let index = $state<SearchIndex | null>(null);
  $effect(() => {
    if (!browser || model || normalized.length < 3) return;
    loadSynopsis(fetch).then((m) => {
      model = m;
      index = buildSearchIndex(m);
    });
  });
  const textResult = $derived<SearchResult | null>(
    model && index && normalized.length >= 3 ? search(index, model, query) : null
  );
</script>

<svelte:head><title>Евангельский синопсис — содержание</title></svelte:head>

<section class="home-shell">
  <header class="home-panel">
    <div class="home-title">
      <h1>Содержание</h1>
    </div>

    {#if reading.last}
      <a class="resume" href="{base}/p/{reading.last.id}">
        <span>Продолжить</span>
        <strong>{reading.last.id}. {reading.last.title}</strong>
      </a>
    {/if}

    <div class="filter-shell">
      <input
        class="filter"
        type="search"
        name="filter"
        placeholder="Фильтр: номер, название или место…"
        bind:value={query}
        aria-label="Фильтр перикоп"
      />
    </div>
  </header>

  <div class="sections">
    {#each data.sections as section (section.id)}
      {@const visible = section.items.filter(matches)}
      {#if visible.length}
        <section class="sec" id="section-{section.id}">
          <div class="sec__head">
            <h2 class="sec__title">{section.title}</h2>
            <span class="sec__count">{visible.length}</span>
          </div>
          <ul class="plist">
            {#each visible as p (p.id)}
              <li class="pitem">
                <a class="pitem__link" href="{base}/p/{p.id}">
                  <span class="pitem__id">{p.id}</span>
                  <span class="pitem__title">{p.title}</span>
                  <GospelPresence present={p.present} />
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>

  {#if normalized}
    {#if textResult?.kind === 'reference'}
      <section class="hits-block">
        <h2 class="hits-block__title">По ссылке</h2>
        <ul class="hits">
          <li>
            <a href="{base}/p/{textResult.pericopeId}#{textResult.anchor}">
              Перейти к {GOSPEL_LABELS[textResult.gospel].abbr}
              {textResult.anchor.split('-').slice(1).join(':')} (п. {textResult.pericopeId})
            </a>
          </li>
        </ul>
      </section>
    {:else if textResult?.kind === 'text' && textResult.hits.length}
      <section class="hits-block">
        <h2 class="hits-block__title">В тексте</h2>
        <ul class="hits">
          {#each textResult.hits.slice(0, 30) as h (h.pid + h.gospel + h.chapter + h.verse + h.suf)}
            <li>
              <a href="{base}/p/{h.pid}#{h.gospel}-{h.chapter}-{h.verse}">
                <b>{GOSPEL_LABELS[h.gospel].abbr} {h.chapter}:{h.verse}{h.suf}</b>
                <span class="snippet">{h.text}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {:else if !anyTitleMatch}
      <p class="nothing">
        {normalized.length < 3 ? 'Ничего не найдено в названиях.' : 'Ничего не найдено.'}
      </p>
    {/if}
  {/if}

  <ToTop />

  <nav class="materials" aria-label="Справочные материалы">
    <h2 class="materials__title">Справочные материалы</h2>
    <div class="materials__links">
      <a href="{base}/prefaces">Предисловия</a>
      <span aria-hidden="true">·</span>
      <a href="{base}/footnotes">Источник</a>
    </div>
  </nav>
</section>

<style>
  .home-shell {
    display: grid;
    gap: 0.85rem;
  }
  .home-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.62fr);
    gap: 1.25rem;
    align-items: center;
    padding-bottom: 0.25rem;
  }
  .home-title h1 {
    margin-bottom: 0;
  }
  .resume {
    display: grid;
    gap: 0.2rem;
    justify-self: end;
    max-width: 24rem;
    padding: 0.45rem 0 0.45rem 1rem;
    border-left: 2px solid var(--accent-soft);
    color: var(--fg);
  }
  .resume:hover {
    text-decoration: none;
  }
  .resume span {
    color: var(--fg-muted);
    font-size: var(--fs-caption);
  }
  .resume strong {
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .filter-shell {
    grid-column: 1 / -1;
    position: sticky;
    top: 4.25rem;
    z-index: 4;
    padding: 0.25rem 0;
    background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(10px);
  }
  .filter {
    width: 100%;
    min-height: 2.65rem;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
  }
  .sections {
    display: grid;
    border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 68%, transparent);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .sec {
    padding: 0;
    /* anchored #section-N must clear the sticky topbar and filter */
    scroll-margin-top: 7.75rem;
  }
  .sec + .sec {
    border-top: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  }
  .sec__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem 0.7rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
    background: color-mix(in srgb, var(--surface) 56%, transparent);
  }
  .sec__title {
    font-size: var(--fs-h3);
    margin: 0;
  }
  .sec__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 1.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--fg-muted);
    font-size: var(--fs-caption);
    font-variant-numeric: tabular-nums;
    background: var(--surface);
  }
  .plist {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
  }
  .pitem {
    border-top: 1px solid transparent;
  }
  .pitem + .pitem {
    border-top-color: color-mix(in srgb, var(--border) 48%, transparent);
  }
  .pitem__link {
    display: grid;
    grid-template-columns: 2.8rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    min-height: 2.85rem;
    padding: 0.35rem 1rem;
    color: var(--fg);
    transition: background 0.16s ease;
  }
  .pitem__link:hover {
    background: var(--hover);
    text-decoration: none;
    color: var(--fg);
  }
  .pitem__id {
    color: var(--accent-medium);
    font-variant-numeric: tabular-nums;
    justify-self: start;
    min-width: 2.4rem;
    padding: 0;
    text-align: right;
    font-size: var(--fs-ui-sm);
    font-weight: var(--fw-medium);
  }
  .pitem__title {
    color: var(--fg);
    overflow-wrap: anywhere;
    font-size: 0.98rem;
  }

  .hits-block__title {
    font-size: var(--fs-h3);
    margin: 0 0 0.5rem;
  }
  .hits {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .hits li {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--card) 76%, transparent);
  }
  .hits li:hover {
    background: var(--hover);
  }
  .hits a {
    display: block;
    padding: 0.75rem 0.85rem;
    color: var(--fg);
  }
  .hits a:hover {
    text-decoration: none;
  }
  .hits b {
    color: var(--accent);
  }
  .snippet {
    margin-left: 0.5rem;
  }
  .nothing {
    color: var(--fg-muted);
    margin: 0;
  }

  .materials {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.85rem 1rem;
    border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 68%, transparent);
  }
  .materials__title {
    font-size: var(--fs-h3);
    margin: 0;
  }
  .materials__links {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    color: var(--fg-muted);
  }

  @media (max-width: 980px) {
    .home-panel {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
    .resume {
      justify-self: stretch;
      max-width: none;
    }
  }

  @media (max-width: 760px) {
    .pitem__link {
      grid-template-columns: 2.1rem minmax(0, 1fr) auto;
      gap: 0.5rem;
      padding: 0.55rem 0.8rem;
    }
    .pitem__id {
      justify-self: stretch;
      min-width: 0;
      text-align: center;
    }
  }
</style>
