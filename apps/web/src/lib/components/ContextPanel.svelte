<script lang="ts">
  import { base } from '$app/paths';
  import type { BibleBook, GospelKey } from '@synopsis/schema';
  import {
    chapterNumbers,
    getChapter,
    loadBook,
    neighbourChapters,
    splitRuns,
    type ChapterVerse
  } from '$lib/data/bible.js';
  import { verseKey } from '$lib/data/alignment.js';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { contextPanel } from '$lib/stores/context-panel.svelte.js';

  let panel = $state<HTMLDivElement | null>(null);
  let body = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;
  // книга держится вместе с ключом, иначе при смене евангелия успевает мелькнуть чужой текст
  let loaded = $state<{ gospel: GospelKey; book: BibleBook } | null>(null);
  let failed = $state(false);

  const target = $derived(contextPanel.target);
  const gospel = $derived(target?.gospel ?? null);
  const book = $derived(loaded !== null && loaded.gospel === gospel ? loaded.book : null);
  const verses = $derived(book && target ? getChapter(book, target.chapter) : []);
  const nav = $derived(
    book && target ? neighbourChapters(book, target.chapter) : { prev: null, next: null }
  );
  const highlight = $derived(contextPanel.highlight);
  const runs = $derived(splitRuns(verses, new Set(highlight)));
  const anchor = $derived(highlight[0] ?? verses[0]?.verse ?? 1);
  const chapters = $derived(book ? chapterNumbers(book) : []);

  let pickerOpen = $state(false);
  // выбор главы закрывается вместе с панелью и при уходе на другую главу
  $effect(() => {
    void target?.chapter;
    pickerOpen = false;
  });

  $effect(() => {
    const g = gospel;
    if (g === null) return;
    failed = false;
    loadBook(g)
      .then((b) => {
        if (contextPanel.target?.gospel === g) loaded = { gospel: g, book: b };
      })
      .catch(() => {
        if (contextPanel.target?.gospel === g) failed = true;
      });
  });

  // прокрутка к первому подсвеченному стиху, как только глава отрисована
  $effect(() => {
    const first = highlight[0];
    if (verses.length === 0) return;
    queueMicrotask(() => {
      const el = first !== undefined ? body?.querySelector(`[data-v="${first}"]`) : null;
      if (el) el.scrollIntoView({ block: 'center' });
      else if (body) body.scrollTop = 0;
    });
  });

  $effect(() => {
    if (contextPanel.isOpen) {
      lastFocused = document.activeElement as HTMLElement | null;
      queueMicrotask(() => panel?.querySelector<HTMLElement>('button:not([disabled])')?.focus());
    } else {
      lastFocused?.focus?.();
    }
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      // первый Esc убирает сетку глав, второй закрывает панель
      if (pickerOpen) pickerOpen = false;
      else contextPanel.close();
      return;
    }
    if (e.key === 'ArrowLeft' && nav.prev !== null) {
      e.preventDefault();
      contextPanel.goToChapter(nav.prev);
      return;
    }
    if (e.key === 'ArrowRight' && nav.next !== null) {
      e.preventDefault();
      contextPanel.goToChapter(nav.next);
      return;
    }
    if (e.key === 'Tab' && panel) {
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
</script>

{#if target}
  <div class="scrim" onclick={() => contextPanel.close()} aria-hidden="true"></div>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Текст главы"
    tabindex="-1"
    bind:this={panel}
    onkeydown={onKeydown}
  >
    <header class="head">
      <button
        class="step"
        aria-label="Предыдущая глава"
        disabled={nav.prev === null}
        onclick={() => nav.prev !== null && contextPanel.goToChapter(nav.prev)}>‹</button
      >
      <h2 class="title">
        <button
          class="pick"
          aria-haspopup="true"
          aria-expanded={pickerOpen}
          onclick={() => (pickerOpen = !pickerOpen)}
          >{GOSPEL_LABELS[target.gospel].nom}, глава {target.chapter}<span
            class="caret"
            aria-hidden="true">▾</span
          ></button
        >
      </h2>
      <button
        class="step"
        aria-label="Следующая глава"
        disabled={nav.next === null}
        onclick={() => nav.next !== null && contextPanel.goToChapter(nav.next)}>›</button
      >
      <button class="step close" aria-label="Закрыть" onclick={() => contextPanel.close()}>×</button
      >
    </header>

    {#if pickerOpen}
      <div class="picker" aria-label="Выбор главы">
        {#each chapters as n (n)}
          <button
            class="num"
            class:current={n === target.chapter}
            aria-current={n === target.chapter ? 'true' : undefined}
            onclick={() => contextPanel.goToChapter(n)}>{n}</button
          >
        {/each}
      </div>
    {/if}

    {#snippet verse(v: ChapterVerse)}
      <span class="verse" data-v={v.verse}><sup class="vnum">{v.verse}</sup>{v.text}</span>
    {/snippet}

    <div class="body verse-text" bind:this={body}>
      {#if failed}
        <p class="state">Не удалось загрузить текст. Проверьте соединение и попробуйте снова.</p>
      {:else if verses.length === 0}
        <p class="state">Загрузка…</p>
      {:else}
        <!-- подряд идущие подсвеченные стихи рисуются одной полосой, а не блоком на каждый -->
        {#each runs as run, i (i)}
          {#if run.hl}
            <div class="hl">
              {#each run.items as v (v.verse)}{@render verse(v)}{/each}
            </div>
          {:else}
            {#each run.items as v (v.verse)}{@render verse(v)}{/each}
          {/if}
        {/each}
      {/if}
    </div>

    <footer class="foot">
      <a
        href="{base}/read/{target.gospel}#{verseKey(target.gospel, target.chapter, anchor)}"
        onclick={() => contextPanel.close()}>Открыть в чтении</a
      >
    </footer>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(28, 25, 23, 0.32);
  }
  .panel {
    position: fixed;
    z-index: 101;
    top: 4.6rem;
    right: max(0.75rem, calc((100vw - var(--page-max)) / 2 + var(--gutter)));
    width: min(460px, calc(100vw - 1.5rem));
    max-height: calc(100vh - 6rem);
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 6px);
    box-shadow: var(--shadow-md);
    overflow: clip;
  }
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border);
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    text-align: center;
    font-size: var(--fs-h3);
  }
  .pick {
    max-width: 100%;
    padding: 0.15rem 0.5rem;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-family: var(--font-serif);
    cursor: pointer;
  }
  .pick:hover,
  .pick[aria-expanded='true'] {
    background: var(--accent-soft);
  }
  .caret {
    margin-left: 0.35rem;
    font-size: 0.7em;
    vertical-align: 0.15em;
  }
  .step {
    flex: none;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--fg-secondary);
    font: inherit;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
  }
  .step:hover:not(:disabled) {
    background: var(--hover);
  }
  .step:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .close {
    margin-left: 0.35rem;
  }
  .picker {
    flex: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
    gap: 0.3rem;
    max-height: 40vh;
    overflow-y: auto;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
  }
  .num {
    padding: 0.4rem 0;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--fg-secondary);
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .num:hover {
    border-color: var(--border-strong);
    color: var(--accent);
  }
  .num.current {
    background: var(--accent-soft);
    border-color: var(--accent-subtle);
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.85rem 1rem;
    font-size: var(--fs-reading);
    line-height: var(--lh-reading);
    text-wrap: pretty;
  }
  .state {
    margin: 0;
    color: var(--fg-muted);
  }
  .verse {
    display: block;
    padding-left: 1.8em;
    text-indent: -1.8em;
    margin-bottom: 0.3em;
    scroll-margin: 2rem;
  }
  .hl {
    background: var(--active-verse);
    border-radius: var(--radius-sm);
    padding: 0.3em 0.5em;
    margin: 0.15em -0.5em 0.45em;
  }
  .hl .verse:last-child {
    margin-bottom: 0;
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
  .foot {
    flex: none;
    padding: 0.55rem 1rem;
    border-top: 1px solid var(--border);
    font-size: var(--fs-ui-sm);
  }

  @media (max-width: 760px) {
    .panel {
      top: auto;
      right: 0;
      left: 0;
      bottom: 0;
      width: 100%;
      max-height: 82vh;
      border-radius: calc(var(--radius) + 10px) calc(var(--radius) + 10px) 0 0;
    }
  }
</style>
