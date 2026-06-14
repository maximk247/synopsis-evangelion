// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PericopeColumns from './PericopeColumns.svelte';
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

describe('PericopeColumns', () => {
  it('renders numbered verses and unnumbered notes', () => {
    render(PericopeColumns, { props: { pericope, present: ['mt', 'lk'] } });
    // getByText throws if absent, so a truthy check asserts presence
    expect(screen.getByText('Блаженны нищие духом')).toBeTruthy();
    expect(screen.getByText('примечание редактора')).toBeTruthy();
    expect(screen.getAllByText('Матфей').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Лука').length).toBeGreaterThan(0);
  });
});
