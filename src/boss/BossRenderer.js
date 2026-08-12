/**
 * ボスのCanvas描画を担当する。画像未設定時はデフォルトの
 * 「UNKNOWN SONG」ボスをプロシージャルな図形で描画する（仕様書 #30, #31）。
 */
export class BossRenderer {
  constructor() {
    /** @type {HTMLImageElement|null} */
    this._image = null;
    this._imageUrl = null;
    this._hitFlashUntil = -Infinity;
    this._spawnAt = 0;
  }

  /**
   * @param {string|null} imageDataUrl
   */
  setImage(imageDataUrl) {
    if (!imageDataUrl) {
      this._image = null;
      this._imageUrl = null;
      return;
    }
    if (this._imageUrl === imageDataUrl) return;
    const img = new Image();
    img.onload = () => { this._image = img; };
    img.onerror = () => { console.error('[BossRenderer] ボス画像の読み込みに失敗しました'); this._image = null; };
    img.src = imageDataUrl;
    this._imageUrl = imageDataUrl;
  }

  notifyHit(nowSec) {
    this._hitFlashUntil = nowSec + 0.09;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} params
   * @param {number} params.x
   * @param {number} params.y
   * @param {number} params.size
   * @param {number} params.nowSec
   * @param {boolean} params.enraged
   * @param {boolean} params.defeated
   * @param {number} params.defeatProgress 0〜1
   */
  draw(ctx, { x, y, size, nowSec, enraged, defeated, defeatProgress = 0 }) {
    ctx.save();

    const bob = Math.sin(nowSec * (enraged ? 6 : 2.4)) * size * 0.03;
    let drawX = x;
    let drawY = y + bob;

    if (enraged) {
      drawX += (Math.random() - 0.5) * size * 0.015;
      drawY += (Math.random() - 0.5) * size * 0.015;
    }

    const alpha = defeated ? Math.max(0, 1 - defeatProgress) : 1;
    ctx.globalAlpha = alpha;

    if (defeated) {
      ctx.translate(drawX, drawY);
      ctx.scale(1 + defeatProgress * 0.4, 1 + defeatProgress * 0.4);
      ctx.translate(-drawX, -drawY);
    }

    if (this._image) {
      const half = size / 2;
      ctx.drawImage(this._image, drawX - half, drawY - half, size, size);
    } else {
      this._drawDefaultBoss(ctx, drawX, drawY, size, nowSec, enraged);
    }

    if (nowSec < this._hitFlashUntil) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const half = size / 2;
      ctx.fillRect(drawX - half, drawY - half, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  _drawDefaultBoss(ctx, x, y, size, nowSec, enraged) {
    const r = size / 2;
    const pulse = 1 + Math.sin(nowSec * 3) * 0.03;

    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * pulse);
    grad.addColorStop(0, enraged ? '#ff5b7a' : '#7c4dff');
    grad.addColorStop(1, '#140f24');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = enraged ? '#ff2f92' : '#3ef2ff';
    ctx.lineWidth = Math.max(2, size * 0.01);
    ctx.beginPath();
    ctx.arc(x, y, r * pulse * 0.82, 0, Math.PI * 2);
    ctx.stroke();

    // 目（不明な曲＝謎の存在という表現）
    ctx.fillStyle = '#0a0714';
    const eyeOffset = r * 0.22;
    const eyeSize = r * 0.1;
    ctx.beginPath();
    ctx.ellipse(x - eyeOffset, y - r * 0.05, eyeSize, eyeSize * 1.3, 0, 0, Math.PI * 2);
    ctx.ellipse(x + eyeOffset, y - r * 0.05, eyeSize, eyeSize * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = enraged ? '#ffb3c4' : '#e6e0ff';
    ctx.font = `700 ${Math.max(10, size * 0.07)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('UNKNOWN SONG', x, y + r * 0.5);
  }
}
