<script lang="ts">
  import { base } from '$app/paths';
  import GospelPresence from '$lib/components/GospelPresence.svelte';
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
</script>

<svelte:head><title>Евангельский синопсис — содержание</title></svelte:head>

{#if reading.last}
  <p class="resume">
    Продолжить чтение:
    <a href="{base}/p/{reading.last.id}">{reading.last.id}. {reading.last.title}</a>
  </p>
{/if}

<h1>Содержание</h1>

<input
  class="filter"
  type="search"
  name="filter"
  placeholder="Фильтр: номер, название или место…"
  bind:value={query}
  aria-label="Фильтр перикоп"
/>

{#each data.sections as section (section.id)}
  {@const visible = section.items.filter(matches)}
  {#if visible.length}
    <section class="sec">
      <h2 class="sec__title">{section.title}</h2>
      <ul class="plist">
        {#each visible as p (p.id)}
          <li class="pitem">
            <a class="pitem__main" href="{base}/p/{p.id}">
              <span class="pitem__id">{p.id}</span>
              <span class="pitem__title">{p.title}</span>
            </a>
            <GospelPresence present={p.present} />
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/each}

<style>
  .resume {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.8rem;
    margin-bottom: 1rem;
    box-shadow: var(--shadow-sm);
  }
  .filter {
    width: 100%;
    padding: 0.6rem 0.8rem;
    margin: 0.5rem 0 1.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--fg);
    font: inherit;
  }
  .sec {
    margin-bottom: 1.5rem;
  }
  .sec__title {
    font-size: var(--fs-h3);
    border-bottom: 2px solid var(--accent-soft);
    padding-bottom: 0.3rem;
  }
  .plist {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .pitem {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .pitem__main {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    flex: 1;
    min-width: 0;
  }
  .pitem__id {
    color: var(--accent-medium);
    font-variant-numeric: tabular-nums;
    min-width: 2.5rem;
  }
  .pitem__title {
    color: var(--fg);
  }
</style>
