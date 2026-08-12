import { PLAYER_MAX_HP_DEFAULT, COMBO_MULTIPLIER_TABLE, JUDGEMENT } from '../utils/constants.js';
import { bus } from '../utils/EventBus.js';

/**
 * プレイヤー側のランタイム状態（HP・コンボ・スコア・精度統計）を管理する。
 */
export class Player {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxHp]
   * @param {number} [opts.comboThresholdMult] COMBO_MASTERアビリティ用
   */
  constructor({ maxHp = PLAYER_MAX_HP_DEFAULT, comboThresholdMult = 1 } = {}) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.comboThresholdMult = comboThresholdMult;

    this.judgeCounts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.isAlive = true;
  }

  get comboMultiplier() {
    for (const row of COMBO_MULTIPLIER_TABLE) {
      if (this.combo >= row.combo * this.comboThresholdMult) return row.mult;
    }
    return 1.0;
  }

  registerJudgement(judgement, scoreGain = 0) {
    this.judgeCounts[judgement] = (this.judgeCounts[judgement] || 0) + 1;
    if (judgement === JUDGEMENT.MISS) {
      this.combo = 0;
    } else {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    this.score += Math.round(scoreGain);
    bus.emit('player:judgement', { judgement, combo: this.combo, score: this.score });
  }

  takeDamage(amount) {
    if (amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    bus.emit('player:hp', { hp: this.hp, maxHp: this.maxHp });
    if (this.hp <= 0) {
      this.isAlive = false;
      bus.emit('player:defeated');
    }
  }

  heal(amount) {
    if (amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    bus.emit('player:hp', { hp: this.hp, maxHp: this.maxHp });
  }

  get totalNotes() {
    return this.judgeCounts.PERFECT + this.judgeCounts.GREAT + this.judgeCounts.GOOD + this.judgeCounts.MISS;
  }

  /** 精度をPERFECT=1.0, GREAT=0.7, GOOD=0.4, MISS=0として算出（0〜100%） */
  get accuracy() {
    const total = this.totalNotes;
    if (total === 0) return 100;
    const weighted =
      this.judgeCounts.PERFECT * 1.0 +
      this.judgeCounts.GREAT * 0.7 +
      this.judgeCounts.GOOD * 0.4;
    return Math.max(0, Math.min(100, (weighted / total) * 100));
  }

  get grade() {
    const acc = this.accuracy;
    if (this.judgeCounts.MISS === 0 && acc >= 99.5) return 'SS';
    if (acc >= 95) return 'S';
    if (acc >= 90) return 'A';
    if (acc >= 80) return 'B';
    if (acc >= 65) return 'C';
    return 'D';
  }
}
