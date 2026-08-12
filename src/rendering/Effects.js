import { BossEffects } from '../boss/BossEffects.js';
import { JUDGEMENT } from '../utils/constants.js';

const JUDGE_COLORS = {
  [JUDGEMENT.PERFECT]: '#ffd23e',
  [JUDGEMENT.GREAT]: '#3ef2ff',
  [JUDGEMENT.GOOD]: '#a3f36b',
  [JUDGEMENT.MISS]: '#ff3b5c'
};

/**
 * 判定ヒットパーティクル・画面シェイクなど、演出全般をまとめて管理する。
 * アクセシビリティ設定（画面揺れOFF・エフェクトOFF）を考慮する（仕様書#51）。
 */
export class Effects {
  constructor() {
    this.particles = new BossEffects(300);
    this.shakeAmount = 0;
    this.enabled = true;
    this.shakeEnabled = true;
  }

  configure({ effects, screenShake }) {
    this.enabled = effects !== false;
    this.shakeEnabled = screenShake !== false;
  }

  onJudgement(x, y, judgement) {
    if (!this.enabled) return;
    const color = JUDGE_COLORS[judgement] || '#fff';
    const count = judgement === JUDGEMENT.PERFECT ? 22 : judgement === JUDGEMENT.GREAT ? 14 : judgement === JUDGEMENT.GOOD ? 8 : 6;
    this.particles.burst(x, y, count, color, { speed: judgement === JUDGEMENT.MISS ? 90 : 260, life: 0.55 });
    if (judgement === JUDGEMENT.MISS && this.shakeEnabled) this.addShake(6);
  }

  onBossHit(x, y, big = false) {
    if (!this.enabled) return;
    this.particles.burst(x, y, big ? 40 : 10, '#ff2f92', { speed: big ? 400 : 220, life: big ? 0.9 : 0.4, size: big ? 5 : 3 });
    if (big && this.shakeEnabled) this.addShake(14);
  }

  addShake(amount) {
    this.shakeAmount = Math.min(24, this.shakeAmount + amount);
  }

  update(dt) {
    this.particles.update(dt);
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 40);
  }

  getShakeOffset() {
    if (!this.shakeEnabled || this.shakeAmount <= 0) return { x: 0, y: 0 };
    const a = this.shakeAmount;
    return { x: (Math.random() - 0.5) * a, y: (Math.random() - 0.5) * a };
  }

  draw(ctx) {
    this.particles.draw(ctx);
  }

  clear() {
    this.particles.clear();
    this.shakeAmount = 0;
  }
}
