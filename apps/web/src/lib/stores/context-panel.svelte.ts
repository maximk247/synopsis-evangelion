import type { GospelKey } from '@synopsis/schema';

/** Что показывает панель контекста. null — панель закрыта. */
export interface ContextTarget {
  gospel: GospelKey;
  /** Глава, открытая в панели прямо сейчас. */
  chapter: number;
  /** Откуда пришли: глава сегмента и его стихи. Подсветка возвращается, если вернуться к ней. */
  origin: { chapter: number; verses: number[] };
}

/**
 * Панель канонического контекста: открывается из любого места, живёт в layout.
 * Состояние эфемерное — в localStorage ему не место.
 */
export class ContextPanelStore {
  target = $state<ContextTarget | null>(null);

  get isOpen(): boolean {
    return this.target !== null;
  }

  /** Стихи, подсвеченные в текущей главе: только в той, из которой открыли. */
  get highlight(): number[] {
    const t = this.target;
    return t && t.chapter === t.origin.chapter ? t.origin.verses : [];
  }

  open(gospel: GospelKey, chapter: number, verses: number[] = []) {
    this.target = { gospel, chapter, origin: { chapter, verses } };
  }

  /** Листание внутри той же книги. */
  goToChapter(chapter: number) {
    if (!this.target) return;
    this.target = { ...this.target, chapter };
  }

  close() {
    this.target = null;
  }
}

export const contextPanel = new ContextPanelStore();
