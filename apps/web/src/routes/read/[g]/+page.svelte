<script lang="ts">
  import { base } from '$app/paths';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { GOSPELS, GOSPEL_LABELS, gospelHeading } from '$lib/data/labels.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let scrollY = $state(0);
  const showTop = $derived(scrollY > 600);
</script>

<svelte:window bind:scrollY />

<svelte:head><title>{gospelHeading(data.gospel)}</title></svelte:head>

<div class="page-top">
  <div class="switch" aria-label="Выбор Евангелия">
    {#each GOSPELS as g (g)}
      <a href="{base}/read/{g}" class:active={g === data.gospel}>{GOSPEL_LABELS[g].nom}</a>
    {/each}
  </div>
  <Breadcrumbs />
</div>

<article class="reader verse-text">
  {#each data.blocks as b, i (i)}
    {#if b.kind === 'pericope'}
      <h2 class="pmark"><a href="{base}/p/{b.id}">п. {b.id}. {b.title}</a></h2>
    {:else if b.kind === 'chapter'}
      <h3 class="chapter">Глава {b.chapter}</h3>
    {:else}
      <span class="verse"><sup class="vnum">{b.verse}{b.suf}</sup>{b.text}</span>
    {/if}
  {/each}
</article>

{#if showTop}
  <button
    class="totop totop--left"
    onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    aria-label="Наверх"><span class="totop__glyph">‹</span></button
  >
  <button
    class="totop totop--right"
    onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    aria-label="Наверх"><span class="totop__glyph">‹</span></button
  >
{/if}

<style>
  .page-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0 0 1rem;
  }
  .page-top :global(.crumbs) {
    margin: 0;
  }
  .switch {
    flex: 1;
    display: flex;
    gap: 0.35rem;
    padding: 0.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--card) 86%, transparent);
    overflow-x: auto;
  }
  .switch a {
    flex: 1;
    min-width: max-content;
    border-radius: var(--radius-pill);
    padding: 0.45rem 0.8rem;
    color: var(--fg-secondary);
    text-align: center;
  }
  .switch a.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .switch a:hover {
    background: var(--hover);
    text-decoration: none;
  }
  .reader {
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: calc(var(--radius) + 8px);
    background: color-mix(in srgb, var(--card) 78%, transparent);
    box-shadow: var(--shadow-sm);
    font-size: var(--fs-reading);
  }
  .pmark {
    font-size: var(--fs-h3);
    margin: 1.7rem 0 0.35rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--border);
    color: var(--accent);
    font-family: var(--font-serif);
  }
  .pmark:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  .pmark a:hover {
    text-decoration-thickness: 1px;
  }
  .chapter {
    font-size: var(--fs-caption);
    color: var(--fg-muted);
    margin: 0.75rem 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
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
  .verse {
    display: block;
    padding-left: 1.8em;
    text-indent: -1.8em;
    margin-bottom: 0.3em;
  }

  /* full-gutter "to top" zones, styled like the pericope side arrows */
  .totop {
    position: fixed;
    top: 4.5rem;
    bottom: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    width: max(4rem, calc((100vw - var(--page-max)) / 2));
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--fg-muted);
    font-family: var(--font-serif);
    font-size: 3.2rem;
    line-height: 1;
    opacity: 0.4;
    cursor: pointer;
    transition:
      opacity 0.2s ease,
      color 0.2s ease,
      background 0.2s ease;
  }
  .totop__glyph {
    display: inline-block;
    transform: rotate(90deg);
  }
  .totop--left {
    left: 0;
  }
  .totop--right {
    right: 0;
  }
  .totop:hover,
  .totop:focus-visible {
    opacity: 1;
    color: var(--accent);
    backdrop-filter: blur(5px);
  }
  .totop--left:hover,
  .totop--left:focus-visible {
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }
  .totop--right:hover,
  .totop--right:focus-visible {
    background: linear-gradient(
      to left,
      color-mix(in srgb, var(--accent-soft) 75%, transparent),
      transparent
    );
  }
  @media (max-width: 1299.98px) {
    .totop {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .reader {
      padding: 0.25rem 0;
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .switch {
      border-radius: var(--radius);
    }
  }
</style>
