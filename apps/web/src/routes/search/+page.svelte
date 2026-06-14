<script lang="ts">
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { loadSynopsis, type SynopsisModel } from '$lib/data/synopsis.js';
  import {
    buildSearchIndex,
    search,
    type SearchIndex,
    type SearchResult
  } from '$lib/data/search.js';

  let model = $state<SynopsisModel | null>(null);
  let index = $state<SearchIndex | null>(null);
  let query = $state('');

  // initialize query from ?q=
  $effect(() => {
    query = page.url.searchParams.get('q') ?? '';
  });

  $effect(() => {
    if (!browser || model) return;
    loadSynopsis(fetch).then((m) => {
      model = m;
      index = buildSearchIndex(m);
    });
  });

  const result = $derived<SearchResult | null>(
    model && index && query.trim() ? search(index, model, query) : null
  );

  // a reference query jumps straight to the pericope anchor
  $effect(() => {
    if (result && result.kind === 'reference') {
      goto(`${base}/p/${result.pericopeId}#${result.anchor}`);
    }
  });
</script>

<svelte:head><title>Поиск</title></svelte:head>

<h1>Поиск</h1>
<input
  class="q"
  type="search"
  name="q"
  bind:value={query}
  placeholder="Текст или ссылка, напр. «Мф 5:3»"
  aria-label="Поисковый запрос"
/>

{#if !model}
  <p class="muted">Индекс загружается…</p>
{:else if result && result.kind === 'text'}
  <p class="muted">{result.hits.length} совпадений</p>
  <ul class="hits">
    {#each result.hits as h (h.pid + h.gospel + h.chapter + h.verse + h.suf)}
      <li>
        <a href="{base}/p/{h.pid}#{h.gospel}-{h.chapter}-{h.verse}">
          <b>{GOSPEL_LABELS[h.gospel].abbr} {h.chapter}:{h.verse}{h.suf}</b>
          <span class="snippet">{h.text}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .q {
    width: 100%;
    padding: 0.6rem 0.8rem;
    margin: 0.5rem 0 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
  .muted {
    color: var(--fg-muted);
  }
  .hits {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .hits li {
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0;
  }
  .snippet {
    color: var(--fg);
    margin-left: 0.5rem;
  }
</style>
