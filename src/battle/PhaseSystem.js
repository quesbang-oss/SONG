import { PHASE_NAMES } from '../utils/constants.js';
import { bus } from '../utils/EventBus.js';

/**
 * 曲の時間経過（もしくはボスHP割合）に応じてフェーズを進行させる。
 * 仕様書 #20 の通り、曲の盛り上がりとゲームフェーズを同期させる設計。
 */
export class PhaseSystem {
  /**
   * @param {number[]} phaseMarkers 昇順の時刻配列（長さ4：PHASE2,3,4,FINALの開始時刻）
   */
  constructor(phaseMarkers) {
    this.phaseMarkers = phaseMarkers;
    this.currentPhaseIndex = 0; // 0=PHASE1 ... 4=FINAL BREAK
  }

  get phaseName() {
    return PHASE_NAMES[this.currentPhaseIndex] || PHASE_NAMES[PHASE_NAMES.length - 1];
  }

  get isFinalPhase() {
    return this.currentPhaseIndex >= PHASE_NAMES.length - 1;
  }

  /**
   * 現在の音楽時刻を渡し、フェーズ更新があればイベントを発火する。
   * @param {number} musicTimeSec
   * @returns {boolean} フェーズが切り替わったか
   */
  update(musicTimeSec) {
    let newIndex = 0;
    for (let i = 0; i < this.phaseMarkers.length; i++) {
      if (musicTimeSec >= this.phaseMarkers[i]) newIndex = i + 1;
    }
    if (newIndex !== this.currentPhaseIndex) {
      const prev = this.currentPhaseIndex;
      this.currentPhaseIndex = newIndex;
      bus.emit('phase:change', { from: prev, to: newIndex, name: this.phaseName });
      return true;
    }
    return false;
  }

}
