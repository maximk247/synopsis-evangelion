import { readJSON, writeJSON } from './persist.js';

export class BookmarksStore {
  ids = $state<string[]>([]);

  constructor() {
    this.ids = readJSON<string[]>('bookmarks', []);
  }

  private persist() {
    writeJSON('bookmarks', this.ids);
  }

  has(id: string): boolean {
    return this.ids.includes(id);
  }

  toggle(id: string) {
    this.ids = this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id];
    this.persist();
  }
}

export const bookmarks = new BookmarksStore();
