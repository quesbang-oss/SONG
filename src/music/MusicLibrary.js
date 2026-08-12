import { safeSongLibrary } from './SafeSongLibrary.js';
import { LocalMusicLoader } from './LocalMusicLoader.js';

/**
 * ステージ作成時に「SAFE SONG」と「LOCAL MUSIC」のどちらから曲を選んでも
 * 同一のインターフェースで扱えるようにする統合窓口（仕様書 #12, #59）。
 */
export class MusicLibrary {
  /**
   * @param {'SAFE'|'LOCAL'} source
   * @param {{safeSongId?: string, file?: File}} params
   * @returns {Promise<{buffer: AudioBuffer, title: string, artist: string, duration: number, source: 'SAFE'|'LOCAL', safeSongId?: string, bpm?: number, sourceFileName?: string}>}
   */
  async resolve(source, params) {
    if (source === 'SAFE') {
      const def = safeSongLibrary.getById(params.safeSongId);
      if (!def) throw new Error('SAFE SONGが見つかりません');
      const buffer = await safeSongLibrary.loadBuffer(def.id);
      return {
        buffer,
        title: def.title,
        artist: def.artist,
        duration: buffer.duration,
        source: 'SAFE',
        safeSongId: def.id,
        bpm: def.bpm,
        license: def.license
      };
    }
    if (source === 'LOCAL') {
      const result = await LocalMusicLoader.load(params.file);
      return {
        buffer: result.buffer,
        title: result.title,
        artist: result.artist,
        duration: result.duration,
        source: 'LOCAL',
        sourceFileName: result.sourceFileName,
        rawArrayBuffer: result.rawArrayBuffer,
        mimeType: result.mimeType
      };
    }
    throw new Error(`不明な音源ソース: ${source}`);
  }
}

export const musicLibrary = new MusicLibrary();
