import { LANE_COUNT, NOTE_TYPES } from '../utils/constants.js';

/** レーンごとのキャラクターカラー風パレット（プロセカ風のカラフルな配色） */
const LANE_COLORS = ['#4EEAF0', '#FF5DA8', '#FFE066', '#A16BFF'];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * リズムゲーム本編のCanvas描画を担当する。
 * 「プロセカ（Project SEKAI）風」の演出を目指し、レーンを奥へ収束する
 * パースペクティブ（台形）で描画し、判定ライン付近でノーツが大きく・速く見えるようにする。
 * カラフルなレーンカラー・発光する判定ライン・輝くステージ床が特徴。
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
  const rect = this.canvas.getBoundingClientRect();

  // スマホではDPRを最大1.5に制限
  // 3倍・4倍DPRの端末でCanvasを巨大化させない
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const maxDpr = isMobile ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);

  this.canvas.width = Math.floor(rect.width * dpr);
  this.canvas.height = Math.floor(rect.height * dpr);

  this.ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  this.width = rect.width;
  this.height = rect.height;
}

  // ---------- パースペクティブ・レーン形状 ----------

  /** 判定ライン（手前・最も大きい位置）のY座標 */
  get judgeLineY() {
    return this.height * 0.8;
  }

  /** ノーツ出現位置（奥）のY座標。見下ろし視点のため、極端に遠い消失点は作らない */
  get horizonY() {
    return this.height * 0.2;
  }

  get centerX() {
    return this.width / 2;
  }

  /** 判定ライン位置でのレーン全体の半幅 */
  get bottomHalfWidth() {
    return Math.min(this.width * 0.47, 640);
  }

  /** 奥（出現位置）でのレーン全体の半幅。真上から見下ろす視点のため、手前と全く同じ幅にする（遠近感による拡大縮小・速度変化なし） */
  get topHalfWidth() {
    return this.bottomHalfWidth;
  }

  /**
   * 進行度をそのままY座標・幅の補間に用いる（線形補間）。
   * 遠近感による速度変化・加減速を発生させないため、イージングは適用しない。
   * progressが1を超えても外挿し、ノーツが判定ラインで止まらず手前へ通り抜けていくようにする。
   */
  laneGeometryAt(progress) {
    const p = progress;
    const halfW = lerp(this.topHalfWidth, this.bottomHalfWidth, p);
    const y = lerp(this.horizonY, this.judgeLineY, p);
    const laneW = (halfW * 2) / LANE_COUNT;
    const leftX = this.centerX - halfW;
    return { y, leftX, laneW };
  }

  /** 判定ライン上でのレーン中心X座標（入力・エフェクト位置計算用） */
  laneCenterX(lane) {
    const g = this.laneGeometryAt(1);
    return g.leftX + g.laneW * (lane + 0.5);
  }

  get lanesLeftX() {
    return this.laneGeometryAt(1).leftX;
  }

  get lanesTotalWidth() {
    return this.laneGeometryAt(1).laneW * LANE_COUNT;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  // ---------- 背景・ステージ演出 ----------

  drawBackground(nowSec, boss) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    if (boss?.enraged) {
      grad.addColorStop(0, '#3a1030');
      grad.addColorStop(0.5, '#1c0a2a');
      grad.addColorStop(1, '#0a0714');
    } else {
      grad.addColorStop(0, '#241a44');
      grad.addColorStop(0.5, '#160f2e');
      grad.addColorStop(1, '#0a0714');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 奥の消失点から放射状に伸びるステージライト
    ctx.save();
    ctx.globalAlpha = 0.18;
    const vx = this.centerX;
    const vy = this.horizonY;
    const beamCount = 10;
    for (let i = 0; i < beamCount; i++) {
      const baseAngle = (Math.PI / (beamCount - 1)) * i + Math.PI * 0.15;
      const sweep = Math.sin(nowSec * 0.6 + i) * 0.05;
      const angle = baseAngle + sweep;
      const len = this.height * 1.3;
      const grad2 = ctx.createLinearGradient(vx, vy, vx + Math.cos(angle) * len, vy + Math.sin(angle) * len);
      grad2.addColorStop(0, LANE_COLORS[i % LANE_COLORS.length] + '55');
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(vx + Math.cos(angle - 0.05) * len, vy + Math.sin(angle - 0.05) * len);
      ctx.lineTo(vx + Math.cos(angle + 0.05) * len, vy + Math.sin(angle + 0.05) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // ステージ床：奥へ収束する格子（パース感を強調）
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    const rows = 7;
    for (let i = 0; i <= rows; i++) {
      const g = this.laneGeometryAt(i / rows);
      ctx.beginPath();
      ctx.moveTo(g.leftX, g.y);
      ctx.lineTo(g.leftX + g.laneW * LANE_COUNT, g.y);
      ctx.globalAlpha = 0.05 + (i / rows) * 0.2;
      ctx.stroke();
    }
    const top = this.laneGeometryAt(0);
    const bottom = this.laneGeometryAt(1);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i <= LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(top.leftX + top.laneW * i, top.y);
      ctx.lineTo(bottom.leftX + bottom.laneW * i, bottom.y);
      ctx.stroke();
    }
    ctx.restore();

    // ビートに合わせて広がる光の輪（奥の消失点付近）
    ctx.save();
    ctx.globalAlpha = 0.15;
    const pulse = nowSec % 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.centerX, this.horizonY + 20, 20 + pulse * 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- レーン・判定ライン ----------

  drawLanes() {
    const ctx = this.ctx;
    const top = this.laneGeometryAt(0);
    const bottom = this.laneGeometryAt(1);

    ctx.save();
    // レーンごとの帯（カラー付き半透明フィル）
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const topX0 = top.leftX + top.laneW * lane;
      const topX1 = top.leftX + top.laneW * (lane + 1);
      const botX0 = bottom.leftX + bottom.laneW * lane;
      const botX1 = bottom.leftX + bottom.laneW * (lane + 1);
      const laneGrad = ctx.createLinearGradient(0, top.y, 0, bottom.y);
      laneGrad.addColorStop(0, rgba(LANE_COLORS[lane % LANE_COLORS.length], 0.02));
      laneGrad.addColorStop(1, rgba(LANE_COLORS[lane % LANE_COLORS.length], 0.16));
      ctx.fillStyle = laneGrad;
      ctx.beginPath();
      ctx.moveTo(topX0, top.y);
      ctx.lineTo(topX1, top.y);
      ctx.lineTo(botX1, bottom.y);
      ctx.lineTo(botX0, bottom.y);
      ctx.closePath();
      ctx.fill();
    }

    // レーン境界線（発光）
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(top.leftX + top.laneW * i, top.y);
      ctx.lineTo(bottom.leftX + bottom.laneW * i, bottom.y);
      ctx.stroke();
    }

    // 判定ライン（強い発光バー）
    const glowGrad = ctx.createLinearGradient(0, bottom.y - 26, 0, bottom.y + 8);
    glowGrad.addColorStop(0, 'rgba(255,255,255,0)');
    glowGrad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    glowGrad.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(bottom.leftX - 14, bottom.y - 26, bottom.laneW * LANE_COUNT + 28, 34);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(bottom.leftX - 14, bottom.y);
    ctx.lineTo(bottom.leftX + bottom.laneW * LANE_COUNT + 14, bottom.y);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- ノーツ ----------

  /**
   * @param {import('../rhythm/Note.js').Note[]} notes
   * @param {number} nowSec
   * @param {number} approachSec
   * @param {number[]} laneFlashUntil レーンごとの判定フラッシュ終了時刻
   */
  drawNotes(notes, nowSec, approachSec, laneFlashUntil = []) {
    const ctx = this.ctx;
    const PASS_THROUGH_LIMIT = 1.6; // 判定ラインを越えた後、画面外へ抜けるまで描画を続ける範囲

    // HOLDノーツ
for (const note of notes) {
  if (note.type !== NOTE_TYPES.HOLD || note.hit || note.missed) continue;

  const headProgress = 1 - (note.time - nowSec) / approachSec;
  const tailProgress = 1 - (note.endTime - nowSec) / approachSec;

  if (headProgress < -0.1 && tailProgress < -0.1) continue;

  // 長押し中は「現在位置より先」だけを表示する。
  // つまり、すでに押し切った部分は消えていく。
  const visibleHeadProgress = note.holdActive
    ? Math.max(1, headProgress)
    : Math.max(-0.05, headProgress);

  const visibleTailProgress = Math.max(-0.05, tailProgress);

  // すでに終点まで到達していたら描画しない
  if (note.holdActive && visibleHeadProgress >= visibleTailProgress) {
    continue;
  }

  this._drawHoldTrail(
    ctx,
    note,
    visibleHeadProgress,
    visibleTailProgress,
    note.holdActive
  );
}

    for (const note of notes) {
  if (note.hit || note.missed) continue;

  // 長押し中は通常の「頭」を描画しない。
  // 残っている部分は上のHOLDトレイルだけで表示する。
  if (note.type === NOTE_TYPES.HOLD && note.holdActive) continue;

  const progress = 1 - (note.time - nowSec) / approachSec;

  if (progress < -0.08 || progress > PASS_THROUGH_LIMIT) continue;

  this._drawNote(ctx, note, progress);
}

    // レーンヒットフラッシュ（判定ライン付近が光る）
    const bottom = this.laneGeometryAt(1);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (!laneFlashUntil[lane] || nowSec > laneFlashUntil[lane]) continue;
      const x0 = bottom.leftX + bottom.laneW * lane;
      ctx.save();
      const t = Math.max(0, laneFlashUntil[lane] - nowSec) / 0.1;
      ctx.globalAlpha = 0.5 * t;
      const flashGrad = ctx.createLinearGradient(0, bottom.y - 90, 0, bottom.y);
      flashGrad.addColorStop(0, 'rgba(255,255,255,0)');
      flashGrad.addColorStop(1, rgba(LANE_COLORS[lane % LANE_COLORS.length], 0.9));
      ctx.fillStyle = flashGrad;
      ctx.fillRect(x0, bottom.y - 90, bottom.laneW, 90);
      ctx.restore();
    }
  }

  _drawHoldTrail(ctx, note, headP, tailP, active) {
    const color = LANE_COLORS[note.lane % LANE_COLORS.length];
    const headG = this.laneGeometryAt(headP);
    const tailG = this.laneGeometryAt(tailP);
    const headX = headG.leftX + headG.laneW * (note.lane + 0.5);
    const tailX = tailG.leftX + tailG.laneW * (note.lane + 0.5);
    const headW = headG.laneW * 0.42;
    const tailW = tailG.laneW * 0.42;

    ctx.save();
    ctx.globalAlpha = active ? 0.85 : 0.45;
    ctx.beginPath();
    ctx.moveTo(headX - headW / 2, headG.y);
    ctx.lineTo(headX + headW / 2, headG.y);
    ctx.lineTo(tailX + tailW / 2, tailG.y);
    ctx.lineTo(tailX - tailW / 2, tailG.y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, headG.y, 0, tailG.y);
    grad.addColorStop(0, rgba(color, 0.85));
    grad.addColorStop(1, rgba(color, 0.25));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  _drawNote(ctx, note, progress) {
    const g = this.laneGeometryAt(progress);
    const x = g.leftX + g.laneW * (note.lane + 0.5);
    const y = g.y;
    const color = LANE_COLORS[note.lane % LANE_COLORS.length];
    // 真上から見下ろす視点のため、進行度によってサイズが変わらないようにする（拡大縮小＝速度感の変化を排除）
    // スリムな細めのノーツにする
    const w = g.laneW * 0.5;
    const h = Math.max(6, g.laneW * 0.14);

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    switch (note.type) {
      case NOTE_TYPES.SLIDE:
        this._drawFlickShape(ctx, x, y, w, h, color);
        break;
      case NOTE_TYPES.CHAIN:
        this._drawChainShape(ctx, x, y, w, h, color);
        break;
      default:
        this._drawFlatNote(ctx, x, y, w, h, color, note.type === NOTE_TYPES.HOLD);
    }
    ctx.restore();
  }

  /** 基本ノーツ（TAP/HOLD）：白い芯を持つカラフルな横長の角丸バー */
  _drawFlatNote(ctx, x, y, w, h, color, isHold) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.45);
    else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    const innerW = w * 0.82;
    const innerH = h * 0.42;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - innerW / 2, y - innerH / 2, innerW, innerH, innerH * 0.5);
    else ctx.rect(x - innerW / 2, y - innerH / 2, innerW, innerH);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isHold) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, h * 0.12);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.45) : ctx.rect(x - w / 2, y - h / 2, w, h);
      ctx.stroke();
    }
  }

  /** SLIDEノーツ：横方向へ弾く「フリック」矢印風の三角形 */
  _drawFlickShape(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.22, y + h * 0.28);
    ctx.lineTo(x, y - h * 0.18);
    ctx.lineTo(x + w * 0.22, y + h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** CHAINノーツ：小さな連続する光の玉 */
  _drawChainShape(ctx, x, y, w, h, color) {
    const r = Math.min(w, h) * 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
