// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContextPanel from './ContextPanel.svelte';
import { contextPanel } from '$lib/stores/context-panel.svelte.js';

vi.mock('$app/paths', () => ({ base: '' }));

const book = {
  '5': { '1': 'Увидев народ', '2': 'И Он отверз уста', '3': 'Блаженны нищие духом' },
  '6': { '1': 'Смотрите, не творите' }
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(book)))
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  contextPanel.close();
  vi.unstubAllGlobals();
});

describe('ContextPanel', () => {
  it('stays closed until a target is opened', () => {
    render(ContextPanel);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the whole chapter and marks the segment verses', async () => {
    render(ContextPanel);
    contextPanel.open('mt', 5, [3]);

    await waitFor(() => expect(screen.getByText('Блаженны нищие духом')).toBeTruthy());
    // весь текст главы, а не только стихи перикопы
    expect(screen.getByText('Увидев народ')).toBeTruthy();

    const marked = document.querySelectorAll('.verse.hl');
    expect(marked.length).toBe(1);
    expect(marked[0]!.getAttribute('data-v')).toBe('3');
  });

  it('steps to the next chapter, drops the highlight, and restores it on the way back', async () => {
    render(ContextPanel);
    contextPanel.open('mt', 5, [3]);
    await waitFor(() => expect(screen.getByText('Блаженны нищие духом')).toBeTruthy());

    await fireEvent.click(screen.getByLabelText('Следующая глава'));
    await waitFor(() => expect(screen.getByText('Смотрите, не творите')).toBeTruthy());
    expect(document.querySelectorAll('.verse.hl').length).toBe(0);
    expect(screen.queryByText('Блаженны нищие духом')).toBeNull();

    await fireEvent.click(screen.getByLabelText('Предыдущая глава'));
    await waitFor(() => expect(document.querySelectorAll('.verse.hl').length).toBe(1));
  });

  it('disables the arrows at the edges of the book', async () => {
    render(ContextPanel);
    contextPanel.open('mt', 5, []);
    await waitFor(() => expect(screen.getByText('Увидев народ')).toBeTruthy());

    expect(screen.getByLabelText('Предыдущая глава')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Следующая глава')).toHaveProperty('disabled', false);
  });

  it('links into the reading view at the first marked verse', async () => {
    render(ContextPanel);
    contextPanel.open('mt', 5, [3]);
    await waitFor(() => expect(screen.getByText('Блаженны нищие духом')).toBeTruthy());

    expect(screen.getByText('Открыть в чтении').getAttribute('href')).toBe('/read/mt#mt-5-3');
  });

  it('Escape and the scrim close the panel', async () => {
    render(ContextPanel);
    contextPanel.open('mt', 5, [3]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    contextPanel.open('mt', 5, [3]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await fireEvent.click(document.querySelector('.scrim')!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports a failed load instead of hanging on "Загрузка"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    );
    render(ContextPanel);
    contextPanel.open('lk', 1, []);

    await waitFor(() => expect(screen.getByText(/Не удалось загрузить/)).toBeTruthy());
  });
});
