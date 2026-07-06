<script lang="ts">
  import { base } from '$app/paths';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Закладки</title></svelte:head>

<div class="page-top">
  <h1>Закладки</h1>
  <Breadcrumbs />
</div>
{#if bookmarks.ids.length === 0}
  <p class="empty">Пока нет закладок. Откройте перикопу и нажмите «Закладка».</p>
{:else}
  <ul class="list">
    {#each bookmarks.ids as id (id)}
      <li>
        <a href="{base}/p/{id}?from=bookmarks">{id}. {data.titles[id] ?? id}</a>
        <button onclick={() => bookmarks.toggle(id)} aria-label="Убрать">✕</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .page-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1rem;
  }
  .page-top h1 {
    margin: 0;
  }
  .page-top :global(.crumbs) {
    margin: 0;
  }
  .empty {
    color: var(--fg-muted);
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 4px);
    background: var(--card);
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--card) 76%, transparent);
  }
  .list li:hover {
    background: var(--hover);
  }
  .list a:hover {
    text-decoration: none;
  }
  .list button {
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--fg-muted);
    cursor: pointer;
    width: 2rem;
    height: 2rem;
  }
  .list button:hover {
    color: var(--accent);
    background: var(--hover);
  }
</style>
