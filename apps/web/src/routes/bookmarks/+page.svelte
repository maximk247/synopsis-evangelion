<script lang="ts">
  import { base } from '$app/paths';
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Закладки</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Закладки</b></nav>

<h1>Закладки</h1>
{#if bookmarks.ids.length === 0}
  <p class="muted">Пока нет закладок. Откройте перикопу и нажмите «Закладка».</p>
{:else}
  <ul class="list">
    {#each bookmarks.ids as id (id)}
      <li>
        <a href="{base}/p/{id}">{id}. {data.titles[id] ?? id}</a>
        <button onclick={() => bookmarks.toggle(id)} aria-label="Убрать">✕</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .muted {
    color: var(--fg-muted);
  }
  .list {
    list-style: none;
    padding: 0;
  }
  .list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }
  .list button {
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }
</style>
