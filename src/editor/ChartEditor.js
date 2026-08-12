import { LANE_COUNT, NOTE_TYPES, GRID_DIVISIONS } from '../utils/constants.js';
import { Note } from '../rhythm/Note.js';
import { rhythmClock } from '../rhythm/RhythmClock.js';
import { audioManager } from '../core/AudioManager.js';

const NOTE_COLORS = {
  [NOTE_TYPES.TAP]: '#3ef2ff',
  [NOTE_TYPES.HOLD]: '#ffd23e',
  [NOTE_TYPES.SLIDE]: '#ff2f92',
  [NOTE_TYPES.CHAIN]: '#7c4dff'
};

const DEFAULT_HOLD_BEATS = 1; // HOLDノーツを配置した際の既定の長さ（拍数）

/**
 * 譜面エディタ本体。曲を横軸（時間）、レーンを縦軸（4行）としたピアノロール形式で
 * ノーツを可視化・編集する。音楽時間はRhythmClock（=AudioContext基準）と常に同期する。
 */
export class ChartEditor {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../rhythm/Beatmap.js').Beatmap} beatmap
   */
  constructor(canvas, beatmap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.beatmap = beatmap;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);

    this.scrollTimeSec = 0;       // 画面左端の時間
    this.pixelsPerSecond = 160;   // 横方向のズーム
    this.divisionIndex = 2;       // GRID_DIVISIONS[2] = 4分割（既定）
    this.currentNoteType = NOTE_TYPES.TAP;
    this.isPlaying = false;
    this.onNotesChanged = null;   // コールバック

    this._resize();
    this._resizeHandler = () => this._resize();
    window.addEventListener('resize', this._resizeHandler);

    this._onPointerDown = this._onPointerDown.bind(this);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);

    this._raf = null;
    this._loop = this._loop.bind(this);
  }

  get division() {
    return GRID_DIVISIONS[this.divisionIndex];
  }

  get gridSec() {
    return this.beatmap.beatSec / (this.division / 4);
  }

  setNoteType(type) {
    this.currentNoteType = type;
  }

  setDivisionIndex(idx) {
    this.divisionIndex = Math.max(0, Math.min(GRID_DIVISIONS.length - 1, idx));
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get laneHeight() {
    return this.height / LANE_COUNT;
  }

  _timeToX(t) {
    return (t - this.scrollTimeSec) * this.pixelsPerSecond;
  }

  _xToTime(x) {
    return this.scrollTimeSec + x / this.pixelsPerSecond;
  }

  _laneToY(lane) {
    return lane * this.laneHeight;
  }

  _yToLane(y) {
    return Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(y / this.laneHeight)));
  }

  snapTime(t) {
    const g = this.gridSec;
    return Math.max(0, Math.round(t / g) * g);
  }

  _findNoteNear(time, lane, toleranceSec) {
    return this.beatmap.notes.find((n) => n.lane === lane && Math.abs(n.time - time) <= toleranceSec) || null;
  }

  _onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rawTime = this._xToTime(x);
    const lane = this._yToLane(y);
    const tolerance = this.gridSec * 0.5;

    const existing = this._findNoteNear(rawTime, lane, tolerance);
    if (existing) {
      this.beatmap.removeNote(existing.id);
    } else {
      const time = this.snapTime(rawTime);
      if (time > this.beatmap.duration - 0.05) return;
      const holdDuration = this.currentNoteType === NOTE_TYPES.HOLD ? this.beatmap.beatSec * DEFAULT_HOLD_BEATS : 0;
      this.beatmap.addNote(new Note({ time, lane, type: this.currentNoteType, holdDuration }));
    }
    this.onNotesChanged?.(this.beatmap.noteCount);
    if (!this.isPlaying) this.render(this.scrollTimeSec);
  }

  scrollBy(deltaSec) {
    this.scrollTimeSec = Math.max(0, Math.min(this.beatmap.duration - 1, this.scrollTimeSec + deltaSec));
    if (!this.isPlaying) this.render(this.scrollTimeSec);
  }

  seek(timeSec) {
    this.scrollTimeSec = Math.max(0, Math.min(Math.max(0, this.beatmap.duration - 2), timeSec));
    if (!this.isPlaying) this.render(this.scrollTimeSec);
  }

  async play() {
    await audioManager.play(this.scrollTimeSec);
    this.isPlaying = true;
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    audioManager.pause();
    this.isPlaying = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _loop() {
    if (!this.isPlaying) return;
    const now = rhythmClock.now();
    this.scrollTimeSec = Math.max(0, now - 1.2);
    this.render(this.scrollTimeSec, now);
    if (now >= this.beatmap.duration) {
      this.pause();
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  destroy() {
    this.pause();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('resize', this._resizeHandler);
  }

  /**
   * @param {number} viewStartSec
   * @param {number|null} playheadSec
   */
  render(viewStartSec, playheadSec = null) {
    this.scrollTimeSec = viewStartSec;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // レーン背景
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      ctx.fillStyle = lane % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)';
      ctx.fillRect(0, this._laneToY(lane), this.width, this.laneHeight);
    }

    // グリッド線（拍・分割線）
    const g = this.gridSec;
    const firstGridTime = Math.floor(this.scrollTimeSec / g) * g;
    const visibleSec = this.width / this.pixelsPerSecond;
    for (let t = firstGridTime; t < this.scrollTimeSec + visibleSec + g; t += g) {
      const x = this._timeToX(t);
      const isBeat = Math.abs(t / this.beatmap.beatSec - Math.round(t / this.beatmap.beatSec)) < 1e-3;
      ctx.strokeStyle = isBeat ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = isBeat ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    // フェーズ境界線
    ctx.strokeStyle = 'rgba(255,210,62,0.6)';
    ctx.setLineDash([5, 4]);
    for (const marker of this.beatmap.phaseMarkers) {
      const x = this._timeToX(marker);
      if (x < -20 || x > this.width + 20) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // ノーツ
    for (const note of this.beatmap.notes) {
      const x = this._timeToX(note.time);
      if (x < -60 || x > this.width + 60) continue;
      const y = this._laneToY(note.lane) + this.laneHeight / 2;
      const h = this.laneHeight * 0.6;
      ctx.fillStyle = NOTE_COLORS[note.type] || '#fff';

      if (note.type === NOTE_TYPES.HOLD) {
        const endX = this._timeToX(note.endTime);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y - h / 2, Math.max(4, endX - x), h);
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      const rw = Math.min(h, 22);
      if (ctx.roundRect) ctx.roundRect(x - rw / 2, y - h / 2, rw, h, 6);
      else ctx.rect(x - rw / 2, y - h / 2, rw, h);
      ctx.fill();
    }

    // 再生ヘッド
    const headTime = playheadSec !== null ? playheadSec : this.scrollTimeSec;
    const headX = this._timeToX(headTime);
    if (headX >= 0 && headX <= this.width) {
      ctx.strokeStyle = '#ff2f92';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(headX, 0);
      ctx.lineTo(headX, this.height);
      ctx.stroke();
    }
  }
}
