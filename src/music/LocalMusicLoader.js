import { audioManager } from '../core/AudioManager.js';

const SUPPORTED_EXT = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac', 'flac'];

/**
 * プレイヤーの端末上にある音楽ファイルを読み込むためのローダー。
 * 仕様書 #6 の通り、音源をサーバーへアップロードすることはなく、
 * ブラウザ内でデコードしてその場で使用する。
 */
export class LocalMusicLoader {
  /**
   * <input type="file"> から選択されたFileを検証してメタ情報を作る。
   * @param {File} file
   */
  static validate(file) {
    if (!file) throw new Error('ファイルが選択されていません');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isAudioMime = file.type.startsWith('audio/');
    if (!isAudioMime && !SUPPORTED_EXT.includes(ext)) {
      throw new Error('対応していない音声形式です（MP3 / WAV / OGG / WebM等をご利用ください）');
    }
    const MAX_BYTES = 60 * 1024 * 1024; // 60MB
    if (file.size > MAX_BYTES) {
      throw new Error('ファイルサイズが大きすぎます（60MB以下にしてください）');
    }
    return { name: file.name, ext, sizeBytes: file.size };
  }

  /**
   * ファイル名から簡易的な曲名/アーティスト名を推定する（メタタグ非依存の簡易実装）。
   * @param {string} filename
   */
  static guessMeta(filename) {
    const base = filename.replace(/\.[a-zA-Z0-9]+$/, '');
    const parts = base.split(/\s*-\s*/);
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: 'Unknown Artist', title: base.trim() || 'Untitled' };
  }

  /**
   * ファイルを読み込みデコードし、再生可能なAudioBufferとメタ情報を返す。
   * キャッシュ保存用に、デコード前の生バイト列(rawArrayBuffer)も併せて返す。
   * @param {File} file
   */
  static async load(file) {
    this.validate(file);
    const rawArrayBuffer = await file.arrayBuffer();
    const buffer = await audioManager.decodeArrayBuffer(rawArrayBuffer);
    const meta = this.guessMeta(file.name);
    return {
      buffer,
      rawArrayBuffer,
      mimeType: file.type || 'application/octet-stream',
      title: meta.title,
      artist: meta.artist,
      duration: buffer.duration,
      sourceFileName: file.name,
      sourceType: 'LOCAL'
    };
  }
}
