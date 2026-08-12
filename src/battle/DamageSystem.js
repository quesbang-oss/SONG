import { JUDGE_DAMAGE, MISS_PLAYER_DAMAGE, JUDGEMENT, GIMMICKS } from '../utils/constants.js';

/**
 * 判定結果・コンボ倍率・ローグライトアビリティ・ギミックを合成して
 * 最終的なダメージ量を算出する純粋関数群。
 */
export class DamageSystem {
  /**
   * ボスへ与えるダメージを算出する。
   * @param {string} judgement JUDGEMENTのいずれか
   * @param {number} comboMultiplier
   * @param {Object} abilityEffects 選択中アビリティの合成効果
   * @param {string[]} activeGimmicks 現在有効なギミックID配列
   */
  static computeBossDamage(judgement, comboMultiplier, abilityEffects = {}, activeGimmicks = []) {
    const base = JUDGE_DAMAGE[judgement] ?? 0;
    if (base <= 0) return 0;
    let mult = comboMultiplier * (abilityEffects.attackMult ?? 1);
    if (activeGimmicks.includes(GIMMICKS.DOUBLE_DAMAGE)) mult *= 2;
    return base * mult;
  }

  /**
   * MISS時にプレイヤーが受けるダメージを算出する。
   * @param {Object} abilityEffects
   * @param {string[]} activeGimmicks
   */
  static computeMissDamage(abilityEffects = {}, activeGimmicks = []) {
    let dmg = MISS_PLAYER_DAMAGE * (abilityEffects.missDamageMult ?? 1);
    if (activeGimmicks.includes(GIMMICKS.ONE_MISS)) dmg = 999999; // 1度のMISSで即死級
    return dmg;
  }

  /**
   * PERFECT時などの回復量を算出する（VAMPIREアビリティ等）。
   * @param {string} judgement
   * @param {Object} abilityEffects
   * @param {string[]} activeGimmicks
   */
  static computeHeal(judgement, abilityEffects = {}, activeGimmicks = []) {
    if (activeGimmicks.includes(GIMMICKS.NO_HEAL)) return 0;
    if (judgement === JUDGEMENT.PERFECT && abilityEffects.healOnPerfect) {
      return abilityEffects.healOnPerfect;
    }
    return 0;
  }

  /**
   * BERSERKERアビリティ用：現在HP割合に応じた追加攻撃倍率を算出する。
   * @param {number} hpRatio 0〜1
   * @param {Object} abilityEffects
   */
  static computeLowHpBonusMult(hpRatio, abilityEffects = {}) {
    if (!abilityEffects.lowHpAttackBonus) return 1;
    const bonus = abilityEffects.lowHpAttackBonus * (1 - hpRatio);
    return 1 + bonus;
  }

  /**
   * スコア加算量を判定とコンボ倍率から算出する。
   */
  static computeScore(judgement, comboMultiplier) {
    const base = { PERFECT: 1000, GREAT: 700, GOOD: 350, MISS: 0 }[judgement] ?? 0;
    return base * comboMultiplier;
  }
}
