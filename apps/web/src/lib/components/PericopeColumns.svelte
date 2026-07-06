<script lang="ts">
  import type { Pericope, GospelKey, Segment } from '@synopsis/schema';
  import { isVerse } from '@synopsis/schema';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { verseKey } from '$lib/data/alignment.js';
  import VerseItem from './VerseItem.svelte';
  import NoteItem from './NoteItem.svelte';
  import ColumnTabs from './ColumnTabs.svelte';

  let { pericope, present }: { pericope: Pericope; present: GospelKey[] } = $props();

  // active mobile tab: a user pin if it is still valid, else the first present gospel
  let pinnedTab = $state<GospelKey | null>(null);
  const activeTab = $derived<GospelKey>(
    pinnedTab !== null && present.includes(pinnedTab) ? pinnedTab : (present[0] ?? 'mt')
  );

  function itemKey(g: GospelKey, seg: Segment, v: number): string {
    return verseKey(g, seg.chapter, v);
  }
</script>

<!-- Mobile: tabs (CSS shows this only at <=760px) -->
<div class="mobile-only">
  <ColumnTabs gospels={present} active={activeTab} onselect={(g) => (pinnedTab = g)} />
</div>

<div class="grid" style="--cols: {present.length}">
  {#each present as g (g)}
    {@const col = pericope.columns[g]}
    <section class="col" class:mobile-active={g === activeTab} aria-label={GOSPEL_LABELS[g].nom}>
      <h2 class="col__head">{GOSPEL_LABELS[g].nom}</h2>
      {#if col}
        {#each col.segments as seg, si (g + '-' + si)}
          <div class="seg">
            <p class="chapter">Гл. {seg.chapter}</p>
            <div class="flow">
              {#each seg.items as item, i (i)}
                {#if isVerse(item)}
                  <VerseItem {item} id={itemKey(g, seg, item.v)} />
                {:else}
                  <NoteItem {item} />{' '}
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </section>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: clamp(0.75rem, 1.4vw, 1.25rem);
    align-items: start;
  }
  .col {
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
    border-radius: calc(var(--radius) + 6px);
    background: color-mix(in srgb, var(--card) 76%, transparent);
    box-shadow: var(--shadow-sm);
    overflow: clip;
  }
  .col__head {
    position: sticky;
    top: 4.25rem;
    z-index: 3;
    font-size: 1rem;
    margin: 0;
    padding: 0.75rem 0.9rem 0.65rem;
    border-bottom: 2px solid var(--accent-soft);
    font-family: var(--font-serif);
    color: var(--accent);
    background: var(--card);
  }
  .chapter {
    color: var(--fg-muted);
    font-size: var(--fs-caption);
    margin: 0 0 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .flow {
    margin: 0 0 0.5rem;
    font-size: var(--fs-reading);
    line-height: var(--lh-reading);
    text-wrap: pretty;
  }
  .seg {
    padding: 0.85rem 0.9rem 0.2rem;
    margin-bottom: 0.35rem;
  }
  .seg + .seg {
    border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  }
  .mobile-only {
    display: none;
  }

  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .mobile-only {
      display: block;
    }
    .col {
      display: none;
    }
    .col.mobile-active {
      display: block;
    }
    .col__head {
      display: none;
    }
    .col {
      border: none;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
    }
    .seg {
      padding: 0.75rem 0 0;
    }
    .flow {
      font-size: var(--fs-reading);
    }
  }
</style>
