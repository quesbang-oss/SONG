import { LANE_COUNT } from '../utils/constants.js';

/**
 * ステージ（曲・譜面・ボス・ルール）データの整合性を検証する（仕様書#52）。
 * 不正なステージは公開できないようにする。
 */
export class StageValidator {
  /**
   * @param {Object} stage
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(stage) {
    const errors = [];

    if (!stage.name || !stage.name.trim()) errors.push('ステージ名が未入力です');
    if (stage.name && stage.name.length > 40) errors.push('ステージ名が長すぎます（40文字以内）');

    if (!stage.song) errors.push('曲情報がありません');
    if (stage.song && (!stage.song.duration || stage.song.duration <= 0)) errors.push('曲の長さが不正です');
    if (stage.song && stage.song.duration > 600) errors.push('曲の長さが長すぎます（10分以内）');

    const beatmapJson = stage.beatmap;
    if (!beatmapJson || !Array.isArray(beatmapJson.notes)) {
      errors.push('譜面データが不正です');
    } else {
      const notes = beatmapJson.notes;
      if (notes.length === 0) errors.push('ノーツが1つもありません');
      if (notes.length > 6000) errors.push('ノーツ数が多すぎます（6000個以内）');

      for (const n of notes) {
        if (typeof n.time !== 'number' || n.time < 0 || !isFinite(n.time)) {
          errors.push('不正なノーツ時間が含まれています'); break;
        }
        if (n.time > beatmapJson.duration + 0.5) {
          errors.push('曲の長さを超えるノーツがあります'); break;
        }
      }
      for (const n of notes) {
        if (n.lane < 0 || n.lane >= LANE_COUNT) { errors.push('不正なレーン番号のノーツがあります'); break; }
      }
      for (const n of notes) {
        if (n.type === 'HOLD' && (n.holdDuration <= 0 || n.holdDuration > 30)) {
          errors.push('HOLDノーツの長さが不正です'); break;
        }
      }
    }

    if (!stage.boss) errors.push('ボス情報がありません');
    if (stage.boss && stage.boss.imageDataUrl && stage.boss.imageDataUrl.length > 6_000_000) {
      errors.push('ボス画像データが大きすぎます');
    }

    const totalSizeEstimate = JSON.stringify(stage).length;
    if (totalSizeEstimate > 8_000_000) errors.push('ステージデータ全体のサイズが大きすぎます');

    return { valid: errors.length === 0, errors };
  }
}
