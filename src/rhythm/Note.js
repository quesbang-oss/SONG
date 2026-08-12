import { NOTE_TYPES, LANE_COUNT } from '../utils/constants.js';

let noteSeq = 0;

/**
 * 譜面上の1つのノーツを表すクラス。
 */
export class Note {
  /**
   * @param {Object} params
   * @param {number} params.time 判定タイミング（曲の秒数）
   * @param {number} params.lane レーン番号（0〜LANE_COUNT-1）
   * @param {string} [params.type] NOTE_TYPESのいずれか
   * @param {number} [params.holdDuration] HOLDノーツの長さ（秒）
   * @param {string} [params.id]
   */
  constructor({ time, lane, type = NOTE_TYPES.TAP, holdDuration = 0, id }) {
    this.id = id || `note_${noteSeq++}`;
    this.time = time;
    this.lane = Math.max(0, Math.min(LANE_COUNT - 1, lane));
    this.type = type;
    this.holdDuration = type === NOTE_TYPES.HOLD ? Math.max(0.1, holdDuration) : 0;

    // ランタイム状態（ゲームプレイ中のみ使用、譜面データには保存しない）
    this.hit = false;
    this.missed = false;
    this.holdActive = false;
    this.holdCompleted = false;
  }

  get endTime() {
    return this.time + this.holdDuration;
  }

  resetRuntimeState() {
    this.hit = false;
    this.missed = false;
    this.holdActive = false;
    this.holdCompleted = false;
  }

  toJSON() {
    return {
      id: this.id,
      time: Number(this.time.toFixed(4)),
      lane: this.lane,
      type: this.type,
      holdDuration: Number(this.holdDuration.toFixed(4))
    };
  }

  static fromJSON(json) {
    return new Note({ ...json });
  }
}
