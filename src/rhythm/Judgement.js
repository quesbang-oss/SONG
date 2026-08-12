import { JUDGEMENT, JUDGE_WINDOW_SEC } from '../utils/constants.js';

/**
 * ノーツの目標時刻と実際の入力時刻の差から判定を決定するユーティリティ。
 */
export class Judgement {
  /**
   * @param {number} deltaSec 入力時刻 - ノーツ時刻（絶対値ではなく符号付き）
   * @param {number} [windowMult] PRECISIONアビリティ等による判定窓拡大率
   * @returns {string|null} JUDGEMENTのいずれか。窓外ならnull（未判定）
   */
  static judge(deltaSec, windowMult = 1) {
    const abs = Math.abs(deltaSec);
    if (abs <= JUDGE_WINDOW_SEC.PERFECT * windowMult) return JUDGEMENT.PERFECT;
    if (abs <= JUDGE_WINDOW_SEC.GREAT * windowMult) return JUDGEMENT.GREAT;
    if (abs <= JUDGE_WINDOW_SEC.GOOD * windowMult) return JUDGEMENT.GOOD;
    if (abs <= JUDGE_WINDOW_SEC.MISS * windowMult) return JUDGEMENT.MISS;
    return null;
  }

  /** ノーツが判定窓を過ぎてなお未入力の場合、自動的にMISS確定する猶予時刻を返す */
  static missDeadline(noteTime, windowMult = 1) {
    return noteTime + JUDGE_WINDOW_SEC.MISS * windowMult;
  }
}
