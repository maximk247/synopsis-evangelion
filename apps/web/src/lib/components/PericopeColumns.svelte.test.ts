// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PericopeColumns from './PericopeColumns.svelte';
import { contextPanel } from '$lib/stores/context-panel.svelte.js';
import type { Pericope } from '@synopsis/schema';

vi.mock('$app/paths', () => ({ base: '' }));

const pericope = {
  id: 't',
  title: 'Test',
  place: null,
  pages: [],
  order: 0,
  alignment: [{ mt: '5:3', lk: '6:20' }],
  columns: {
    mt: {
      segments: [
        {
          gospel: 'mt',
          chapter: 5,
          prev: null,
          next: null,
          items: [
            { v: 3, suf: '', t: 'Блаженны нищие духом' },
            { note: 'примечание редактора' }
          ]
        }
      ]
    },
    mk: null,
    lk: {
      segments: [
        {
          gospel: 'lk',
          chapter: 6,
          prev: null,
          next: null,
          items: [{ v: 20, suf: '', t: 'Блаженны нищие' }]
        }
      ]
    },
    jn: null
  }
} as unknown as Pericope;

afterEach(() => contextPanel.close());

describe('PericopeColumns', () => {
  it('opens the context panel from anywhere in the segment, not just the chapter caption', async () => {
    render(PericopeColumns, { props: { pericope, present: ['mt', 'lk'] } });

    await fireEvent.click(screen.getByText('Блаженны нищие'));
    expect(contextPanel.target).toEqual({
      gospel: 'lk',
      chapter: 6,
      origin: { chapter: 6, verses: [20] }
    });
  });

  it('does not hijack a click that ends a text selection', async () => {
    render(PericopeColumns, { props: { pericope, present: ['mt'] } });
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'Блаженны'
    } as unknown as Selection);

    await fireEvent.click(screen.getByText('Блаженны нищие духом'));
    expect(contextPanel.target).toBeNull();
  });

  it('renders numbered verses and unnumbered notes', () => {
    render(PericopeColumns, { props: { pericope, present: ['mt', 'lk'] } });
    // getByText throws if absent, so a truthy check asserts presence
    expect(screen.getByText('Блаженны нищие духом')).toBeTruthy();
    expect(screen.getByText('примечание редактора')).toBeTruthy();
    expect(screen.getAllByText('Матфей').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Лука').length).toBeGreaterThan(0);
  });
});
