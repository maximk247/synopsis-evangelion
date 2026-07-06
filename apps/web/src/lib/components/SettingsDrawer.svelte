<script lang="ts">
  import {
    settings,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    FONT_SIZE_STEP,
    type Theme
  } from '$lib/stores/settings.svelte.js';
  import { READING_FONT_OPTIONS, type ReadingFontKey } from '$lib/data/fonts.js';

  let { open = $bindable() }: { open: boolean } = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' }
  ];

  function close() {
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
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

  $effect(() => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null;
      queueMicrotask(() => panel?.querySelector<HTMLElement>('button:not([disabled])')?.focus());
    } else {
      lastFocused?.focus?.();
    }
  });
</script>

{#if open}
  <div class="scrim" onclick={close} aria-hidden="true"></div>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Настройки"
    tabindex="-1"
    bind:this={panel}
    onkeydown={onKeydown}
  >
    <div class="group">
      <span class="label">Тема</span>
      <div class="row">
        {#each themes as t (t.value)}
          <button
            class:active={settings.theme === t.value}
            aria-pressed={settings.theme === t.value}
            onclick={() => settings.setTheme(t.value)}>{t.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="group">
      <span class="label">Размер шрифта</span>
      <div class="row stepper">
        <button
          aria-label="Мельче"
          disabled={settings.fontSize <= FONT_SIZE_MIN}
          onclick={() => settings.stepFontSize(-FONT_SIZE_STEP)}>A−</button
        >
        <input
          class="value"
          type="number"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          value={settings.fontSize}
          aria-label="Размер шрифта, px"
          onchange={(e) => {
            settings.setFontSize(Number(e.currentTarget.value) || settings.fontSize);
            e.currentTarget.value = String(settings.fontSize);
          }}
        />
        <button
          aria-label="Крупнее"
          disabled={settings.fontSize >= FONT_SIZE_MAX}
          onclick={() => settings.stepFontSize(FONT_SIZE_STEP)}>A+</button
        >
      </div>
    </div>

    <div class="group">
      <span class="label">Шрифт</span>
      <select
        class="font-select"
        value={settings.readingFont}
        onchange={(e) => settings.setReadingFont(e.currentTarget.value as ReadingFontKey)}
        aria-label="Шрифт текста"
      >
        {#each READING_FONT_OPTIONS as f (f.key)}
          <option value={f.key}>{f.label}</option>
        {/each}
      </select>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 100;
  }
  .panel {
    position: fixed;
    top: 4.6rem;
    right: max(0.75rem, calc((100vw - var(--page-max)) / 2 + var(--gutter)));
    width: min(280px, calc(100vw - 1.5rem));
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) + 6px);
    z-index: 101;
    padding: 0.9rem;
    box-shadow: var(--shadow-md);
    display: grid;
    gap: 0.8rem;
  }
  .group {
    display: grid;
    gap: 0.35rem;
  }
  .label {
    color: var(--fg-muted);
    font-size: var(--fs-caption);
  }
  .row {
    display: flex;
    gap: 0.35rem;
    padding: 0.2rem;
    border-radius: var(--radius-pill);
    background: var(--bg-soft);
  }
  .row button {
    flex: 1;
    padding: 0.45rem 0.4rem;
    border: 0;
    background: transparent;
    color: var(--fg-secondary);
    border-radius: var(--radius-pill);
    cursor: pointer;
    font: inherit;
  }
  .row button:hover:not(:disabled) {
    background: var(--hover);
  }
  .row button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .row button.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: var(--fw-semibold);
  }
  .stepper .value {
    align-self: center;
    width: 3rem;
    text-align: center;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
    font: inherit;
    background: transparent;
    border: 0;
    padding: 0;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .stepper .value::-webkit-outer-spin-button,
  .stepper .value::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .font-select {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--fg);
    cursor: pointer;
  }
  .font-select:hover {
    border-color: var(--border-strong);
  }
</style>
