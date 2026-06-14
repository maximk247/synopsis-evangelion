import { readJSON, writeJSON } from './persist.js';

export interface ReadingPosition {
  id: string;
  title: string;
}

export class ReadingStore {
  last = $state<ReadingPosition | null>(null);

  constructor() {
    this.last = readJSON<ReadingPosition | null>('reading', null);
  }

  set(pos: ReadingPosition) {
    this.last = pos;
    writeJSON('reading', pos);
  }
}

export const reading = new ReadingStore();
