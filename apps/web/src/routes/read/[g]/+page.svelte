<script lang="ts">
  import { base } from '$app/paths';
  import { GOSPELS, GOSPEL_LABELS, gospelHeading } from '$lib/data/labels.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{gospelHeading(data.gospel)}</title></svelte:head>

<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>{gospelHeading(data.gospel)}</b></nav>

<div class="switch">
  {#each GOSPELS as g (g)}
    <a href="{base}/read/{g}" class:active={g === data.gospel}>{GOSPEL_LABELS[g].nom}</a>
  {/each}
</div>

<article class="reader verse-text">
  {#each data.blocks as b, i (i)}
    {#if b.kind === 'pericope'}
      <h2 class="pmark"><a href="{base}/p/{b.id}">п. {b.id}. {b.title}</a></h2>
    {:else if b.kind === 'chapter'}
      <h3 class="chapter">Глава {b.chapter}</h3>
    {:else}
      <span class="verse"><sup class="vnum">{b.verse}{b.suf}</sup> {b.text}</span>{' '}
    {/if}
  {/each}
</article>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .switch {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .switch a {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    color: var(--fg);
  }
  .switch a.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .pmark {
    font-size: 0.95rem;
    margin: 1.25rem 0 0.25rem;
    color: var(--accent);
  }
  .chapter {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0.75rem 0 0.25rem;
  }
  .vnum {
    color: var(--fg-muted);
    font-weight: 600;
  }
</style>
