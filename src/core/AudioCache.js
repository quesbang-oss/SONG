/**
 * ローカル音源（プレイヤーの端末から選んだ音楽ファイル）の生バイト列をIndexedDBに保存し、
 * 同じステージを再プレイする際にファイル選択ダイアログを毎回出さずに済むようにする。
 *
 * 本ゲームはオンラインで不特定多数に配布・共有するものではなく、
 * 個人の端末内で完結する用途を前提とするため、音源データそのものをローカルに
 * キャッシュしても著作権・配布上の問題を生じない（仕様書#5〜#7の「友達同士のローカル利用」方針の範囲内）。
 */
const DB_NAME = 'ycsb-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export class AudioCache {
  static _dbPromise = null;

  static _openDb() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('このブラウザはIndexedDBに対応していません'));
        return;
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'stageId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDBのオープンに失敗しました'));
    });
    return this._dbPromise;
  }

  /**
   * 音源ファイルの生バイト列をステージIDに紐づけて保存する。
   * @param {string} stageId
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} mimeType
   * @param {string} fileName
   */
  static async put(stageId, arrayBuffer, mimeType, fileName) {
    try {
      const db = await this._openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ stageId, arrayBuffer, mimeType, fileName, savedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.error('[AudioCache] 保存に失敗しました', err);
      return false;
    }
  }

  /**
   * @param {string} stageId
   * @returns {Promise<{arrayBuffer: ArrayBuffer, mimeType: string, fileName: string}|null>}
   */
  static async get(stageId) {
    try {
      const db = await this._openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(stageId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('[AudioCache] 読み込みに失敗しました', err);
      return null;
    }
  }

  static async delete(stageId) {
    try {
      const db = await this._openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(stageId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[AudioCache] 削除に失敗しました', err);
    }
  }

  static async has(stageId) {
    return (await this.get(stageId)) !== null;
  }
}
