/**
 * ステージ作成時にプレイヤーが設定するボスの構成データを扱う（仕様書 #28〜#31）。
 * 画像が未指定の場合は必ずデフォルト画像「UNKNOWN SONG」を使用し、
 * 画像なしでもステージ作成を完了できるようにする（仕様書 #30）。
 */
export class BossManager {
  /**
   * @param {Object} params
   * @param {string} [params.name]
   * @param {string|null} [params.imageDataUrl]
   * @param {number} [params.scale]
   * @param {string[]} [params.gimmicks]
   */
  static createDefaultConfig({ name = '', imageDataUrl = null, scale = 1.0, gimmicks = [] } = {}) {
    return {
      name: name.trim() || 'UNKNOWN SONG',
      imageDataUrl: imageDataUrl || null,
      scale: Math.max(0.5, Math.min(2.0, scale)),
      gimmicks
    };
  }

  /**
   * File(画像)をDataURLへ変換する（サーバー保存はせずローカルステージデータに埋め込む）。
   * @param {File} file
   * @returns {Promise<string>}
   */
  static async fileToDataUrl(file) {
    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      throw new Error('ボス画像はPNG / JPG / WebPのみ対応しています');
    }
    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw new Error('ボス画像は4MB以下にしてください');
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      reader.readAsDataURL(file);
    });
  }
}
