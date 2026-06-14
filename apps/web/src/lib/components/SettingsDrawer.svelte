<script lang="ts">
  import { settings, type Theme, type FontSize } from '$lib/stores/settings.svelte.js';

  let { open = $bindable() }: { open: boolean } = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Светлая' },
    { value: 'sepia', label: 'Сепия' },
    { value: 'dark', label: 'Тёмная' }
  ];
  const sizes: { value: FontSize; label: string }[] = [
    { value: 'sm', label: 'A−' },
    { value: 'md', label: 'A' },
    { value: 'lg', label: 'A+' }
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
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
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
      queueMicrotask(() => panel?.querySelector<HTMLElement>('button')?.focus());
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
    <div class="panel__head">
      <h2>Настройки</h2>
      <button class="x" onclick={close} aria-label="Закрыть">✕</button>
    </div>

    <fieldset>
      <legend>Тема</legend>
      <div class="row">
        {#each themes as t (t.value)}
          <button
            class:active={settings.theme === t.value}
            aria-pressed={settings.theme === t.value}
            onclick={() => settings.setTheme(t.value)}>{t.label}</button
          >
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Размер шрифта</legend>
      <div class="row">
        {#each sizes as s (s.value)}
          <button
            class:active={settings.fontSize === s.value}
            aria-pressed={settings.fontSize === s.value}
            onclick={() => settings.setFontSize(s.value)}>{s.label}</button
          >
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Текст</legend>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.serif}
          onchange={(e) => settings.setSerif(e.currentTarget.checked)}
        />
        С засечками
      </label>
    </fieldset>

    <fieldset>
      <legend>Параллели</legend>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.highlightParallels}
          onchange={(e) => settings.setHighlightParallels(e.currentTarget.checked)}
        />
        Подсвечивать параллельные стихи
      </label>
    </fieldset>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 90vw);
    background: var(--bg);
    border-left: 1px solid var(--border);
    z-index: 101;
    padding: 1rem;
    overflow-y: auto;
  }
  .panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .panel__head h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .x {
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--fg);
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
    margin: 0.75rem 0;
  }
  legend {
    color: var(--fg-muted);
    font-size: 0.85em;
    padding: 0 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  .row button {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
  }
  .row button.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    cursor: pointer;
  }
</style>
