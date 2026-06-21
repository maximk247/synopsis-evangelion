<script lang="ts">
  import type { Pericope, GospelKey, Segment } from '@synopsis/schema';
  import { isVerse } from '@synopsis/schema';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { buildAlignmentMap, verseKey } from '$lib/data/alignment.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import VerseItem from './VerseItem.svelte';
  import NoteItem from './NoteItem.svelte';
  import RefLinkBadge from './RefLinkBadge.svelte';
  import ColumnTabs from './ColumnTabs.svelte';

  let { pericope, present }: { pericope: Pericope; present: GospelKey[] } = $props();

  const alignMap = $derived(buildAlignmentMap(pericope));
  let hoveredRow = $state<number | null>(null);

  // active mobile tab: a user pin if it is still valid, else the first present gospel
  let pinnedTab = $state<GospelKey | null>(null);
  const activeTab = $derived<GospelKey>(
    pinnedTab !== null && present.includes(pinnedTab) ? pinnedTab : (present[0] ?? 'mt')
  );

  function itemKey(g: GospelKey, seg: Segment, v: number): string {
    return verseKey(g, seg.chapter, v);
  }
  function rowOf(g: GospelKey, seg: Segment, v: number): number | undefined {
    return alignMap.get(itemKey(g, seg, v));
  }
  function isHot(g: GospelKey, seg: Segment, v: number): boolean {
    if (!settings.highlightParallels || hoveredRow === null) return false;
    return rowOf(g, seg, v) === hoveredRow;
  }
  function onHover(g: GospelKey, seg: Segment, v: number, on: boolean) {
    hoveredRow = on ? (rowOf(g, seg, v) ?? null) : null;
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
            {#if seg.prev}<RefLinkBadge link={seg.prev} kind="prev" />{/if}
            <p class="chapter">Гл. {seg.chapter}</p>
            <p class="flow">
              {#each seg.items as item, i (i)}
                {#if isVerse(item)}
                  <VerseItem
                    {item}
                    id={itemKey(g, seg, item.v)}
                    highlighted={isHot(g, seg, item.v)}
                    onhover={(key) => onHover(g, seg, item.v, key !== null)}
                  />{' '}
                {:else}
                  <NoteItem {item} />{' '}
                {/if}
              {/each}
            </p>
            {#if seg.next}<RefLinkBadge link={seg.next} kind="next" />{/if}
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
    gap: 1.25rem;
    align-items: start;
  }
  .col {
    min-width: 0;
  }
  .col__head {
    font-size: 1rem;
    margin: 0 0 0.5rem;
    padding-bottom: 0.3rem;
    border-bottom: 2px solid var(--accent-soft);
    font-family: var(--font-serif);
    color: var(--accent);
  }
  .chapter {
    color: var(--fg-muted);
    font-size: var(--fs-caption);
    margin: 0.5rem 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .flow {
    margin: 0 0 0.5rem;
  }
  .seg {
    margin-bottom: 0.75rem;
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
  }
</style>
