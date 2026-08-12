import safeSongsData from '../data/safeSongs.json';
import { audioManager } from '../core/AudioManager.js';

/**
 * @typedef {Object} SafeSongDef
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} license
 * @property {number} bpm
 * @property {number} duration
 * @property {number} rootFreq
 * @property {number} seed
 * @property {string[]} tags
 */

/**
 * SAFE SONG LIBRARY。ここに収録される曲はすべて本プロジェクトのために
 * プロシージャルに自動生成されたオリジナル楽曲であり、著作権上の懸念なく
 * ゲーム内で共有・利用できる（仕様書 #9, #56）。
 */
export class SafeSongLibrary {
  constructor() {
    /** @type {SafeSongDef[]} */
    this.songs = safeSongsData;
    /** @type {Map<string, AudioBuffer>} */
    this._bufferCache = new Map();
  }

  list() {
    return this.songs;
  }

  getById(id) {
    return this.songs.find((s) => s.id === id) || null;
  }

  filterByTag(tag) {
    if (!tag || tag === 'ALL') return this.songs;
    return this.songs.filter((s) => s.tags.includes(tag));
  }

  /**
   * 指定したSAFE SONGのAudioBufferを取得する（初回のみ生成、以後キャッシュ）。
   * @param {string} id
   * @returns {Promise<AudioBuffer>}
   */
  async loadBuffer(id) {
    if (this._bufferCache.has(id)) return this._bufferCache.get(id);
    const def = this.getById(id);
    if (!def) throw new Error(`SAFE SONG "${id}" が見つかりません`);
    const buffer = await audioManager.generateProceduralSong(def);
    this._bufferCache.set(id, buffer);
    return buffer;
  }
}

export const safeSongLibrary = new SafeSongLibrary();
