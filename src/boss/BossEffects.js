/**
 * ヒット/コンボ/撃破時のパーティクル演出。Object Poolでメモリ確保を最小化する（仕様書#64）。
 */
export class BossEffects {
  constructor(poolSize = 240) {
    this._pool = Array.from({ length: poolSize }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2
    }));
  }

  _acquire() {
    return this._pool.find((p) => !p.active) || this._pool[0];
  }

  burst(x, y, count, color, options = {}) {
    const { speed = 220, life = 0.5, size = 3 } = options;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.6);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.color = color;
      p.size = size * (0.7 + Math.random() * 0.8);
    }
  }

  update(dt) {
    for (const p of this._pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // 軽い重力
      p.vx *= 0.98;
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    for (const p of this._pool) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this._pool) p.active = false;
  }
}
