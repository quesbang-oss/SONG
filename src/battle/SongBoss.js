import { bus } from '../utils/EventBus.js';

/**
 * 「曲そのものをボスとして扱う」というコアコンセプト（仕様書 #15）を実装するクラス。
 * ボスHPは譜面のノーツ総数から動的に算出し、プレイヤーの精度に応じて減少する。
 */
export class SongBoss {
  /**
   * @param {Object} params
   * @param {string} params.name
   * @param {string} [params.imageDataUrl] ボス画像（未指定ならデフォルト画像を使用）
   * @param {number} params.maxHp
   */
  constructor({ name, imageDataUrl = null, maxHp }) {
    this.name = name || 'UNKNOWN SONG';
    this.imageDataUrl = imageDataUrl; // nullの場合はBossRendererがデフォルト画像を描画
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.isDefeated = false;
    this.lastHitAt = -Infinity;
    this.enraged = false;
  }

  /**
   * 譜面のノーツ構成から適切なボスHPを算出する静的ヘルパー。
   * PERFECTのみで撃破可能な総ダメージ量とほぼ一致するよう設計。
   * @param {import('../rhythm/Beatmap.js').Beatmap} beatmap
   * @param {number} perfectDamage
   */
  static computeMaxHp(beatmap, perfectDamage) {
    const count = beatmap.noteCount || 1;
    return Math.max(500, Math.round(count * perfectDamage * 0.92));
  }

  takeDamage(amount, atSec) {
    if (this.isDefeated || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.lastHitAt = atSec;
    this.enraged = this.hp / this.maxHp < 0.25;
    bus.emit('boss:hp', { hp: this.hp, maxHp: this.maxHp, pct: this.hpPercent });
    if (this.hp <= 0) {
      this.isDefeated = true;
      bus.emit('boss:defeated');
    }
  }

  get hpPercent() {
    return this.maxHp > 0 ? (this.hp / this.maxHp) * 100 : 0;
  }
}
