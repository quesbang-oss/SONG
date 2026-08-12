import { Beatmap } from '../rhythm/Beatmap.js';
import { Judgement } from '../rhythm/Judgement.js';
import { rhythmClock } from '../rhythm/RhythmClock.js';
import { Player } from '../battle/Player.js';
import { SongBoss } from '../battle/SongBoss.js';
import { PhaseSystem } from '../battle/PhaseSystem.js';
import { DamageSystem } from '../battle/DamageSystem.js';
import { BossRenderer } from '../boss/BossRenderer.js';
import { Renderer } from '../rendering/Renderer.js';
import { Effects } from '../rendering/Effects.js';
import { InputManager } from '../input/InputManager.js';
import { audioManager } from './AudioManager.js';
import { saveManager } from './SaveManager.js';
import { stageManager } from '../ugc/StageManager.js';
import { rankingManager } from '../community/RankingManager.js';
import { bus } from '../utils/EventBus.js';
import { NOTE_TYPES, JUDGEMENT, GIMMICKS, NOTE_APPROACH_SEC_DEFAULT, JUDGE_DAMAGE, REFERENCE_BPM, BPM_SPEED_RATIO_MIN, BPM_SPEED_RATIO_MAX } from '../utils/constants.js';
import { clamp } from '../utils/helpers.js';

/**
 * 1回のボス戦（プレイセッション）を統括するクラス。
 * 音楽再生・譜面判定・ダメージ計算・フェーズ進行・ローグライト報酬・描画ループの
 * すべてをここで束ねる（仕様書 #14〜#22 のゲームプレイ中核）。
 */
export class PlaySession {
  /**
   * @param {Object} params
   * @param {Object} params.stage 保存済みステージデータ（StageManager形式）
   * @param {AudioBuffer} params.audioBuffer
   * @param {HTMLCanvasElement} params.canvas
   * @param {Object} params.settings ユーザー設定（DEFAULT_SETTINGS形式）
   * @param {number} [params.seed]
   * @param {boolean} [params.isDailyChallenge]
   */
  constructor({ stage, audioBuffer, canvas, settings, seed, isDailyChallenge = false }) {
    this.stage = stage;
    this.settings = settings;
    this.isDailyChallenge = isDailyChallenge;
    this.beatmap = Beatmap.fromJSON(stage.beatmap);
    this.beatmap.resetRuntimeState();

    this.gimmicks = stage.rules?.gimmicks || [];

    const perfectDmg = JUDGE_DAMAGE.PERFECT;
    this.boss = new SongBoss({
      name: stage.boss?.name || 'UNKNOWN SONG',
      imageDataUrl: stage.boss?.imageDataUrl || null,
      maxHp: SongBoss.computeMaxHp(this.beatmap, perfectDmg)
    });
    this.player = new Player({ maxHp: 1000 });
    this.phaseSystem = new PhaseSystem(this.beatmap.phaseMarkers);

    this.renderer = new Renderer(canvas);
    this.bossRenderer = new BossRenderer();
    this.bossRenderer.setImage(this.boss.imageDataUrl);
    this.effects = new Effects();
    this.effects.configure(settings);

    this.inputManager = new InputManager(canvas, this.gimmicks);
    this._laneFlashUntil = [0, 0, 0, 0];
    this._activeHolds = new Map(); // lane -> note

    this._raf = null;
    this._lastFrameAt = 0;
    this._running = false;
    this._paused = false;
    this._ended = false;

    // BPMに応じてノーツの流れる速さを変える：基準BPM(REFERENCE_BPM)より速い曲は
    // 接近時間(approachSec)が短くなり＝速く流れ、遅い曲はゆっくり流れる。
    const bpm = this.beatmap.bpm || REFERENCE_BPM;
    const bpmSpeedRatio = clamp(REFERENCE_BPM / bpm, BPM_SPEED_RATIO_MIN, BPM_SPEED_RATIO_MAX);
    this.approachSec = (NOTE_APPROACH_SEC_DEFAULT * bpmSpeedRatio) / (settings.noteSpeed || 1);

    this._onLaneDown = this._onLaneDown.bind(this);
    this._onLaneUp = this._onLaneUp.bind(this);
    this._loop = this._loop.bind(this);

    audioManager.setBuffer(audioBuffer);
    rhythmClock.setOffsets({ audioOffsetMs: settings.audioOffsetMs, inputOffsetMs: settings.inputOffsetMs });
    audioManager.setVolumes({ master: settings.masterVolume, music: settings.musicVolume, sfx: settings.sfxVolume });
  }

  get effectiveAbilities() {
    return {
      attackMult: 1,
      missDamageMult: 1,
      judgeWindowMult: 1,
      maxHpMult: 1,
      comboThresholdMult: 1,
      noteSpeedMult: 1,
      healOnPerfect: 0,
      lowHpAttackBonus: 0
    };
  }

  async start() {
    bus.on('input:lanedown', this._onLaneDown);
    bus.on('input:laneup', this._onLaneUp);
    this.inputManager.attach();
    this._running = true;
    this._ended = false;
    await audioManager.play(0);
    this._lastFrameAt = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    if (this._paused) return;
    this._paused = true;
    audioManager.pause();
  }

  async resume() {
    if (!this._paused) return;
    this._paused = false;
    await audioManager.resume();
    this._lastFrameAt = performance.now();
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    audioManager.stop();
    this.inputManager.detach();
    bus.off('input:lanedown', this._onLaneDown);
    bus.off('input:laneup', this._onLaneUp);
  }

  // ---------- 入力処理 ----------
  _onLaneDown({ lane, eventTimeMs }) {
    if (this._paused || !this._running) return;
    const now = this._inputTime(eventTimeMs);
    const windowMult = this.effectiveAbilities.judgeWindowMult;

    // このレーンで判定窓内の最も近いノーツを探す
    let best = null;
    let bestDelta = Infinity;
    for (const note of this.beatmap.notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      if (note.type === NOTE_TYPES.HOLD && note.holdActive) continue;
      const delta = now - note.time;
      const judged = Judgement.judge(delta, windowMult);
      if (!judged) continue;
      if (Math.abs(delta) < Math.abs(bestDelta)) { best = note; bestDelta = delta; }
    }
    if (!best) return;

    const judgement = Judgement.judge(bestDelta, windowMult);
    if (best.type === NOTE_TYPES.HOLD && judgement !== JUDGEMENT.MISS) {
      // HOLDは始点を叩いた時点では消化済みにせず、終点まで表示・保持する。
      best.hit = false;
      best.missed = false;
      best.holdActive = true;
      this._activeHolds.set(lane, best);
      this._grantScore(best, judgement, now, { holdStart: true });
    } else {
      this._applyJudgement(best, judgement, now);
    }
  }

  _onLaneUp({ lane, eventTimeMs }) {
    const note = this._activeHolds.get(lane);
    if (!note) return;
    const now = this._inputTime(eventTimeMs);
    this._activeHolds.delete(lane);
    if (now < note.endTime - 0.12) {
      // 早期リリース：HOLD失敗。ノーツを消化済みにして画面から除去する。
      note.holdCompleted = false;
      note.holdActive = false;
      note.missed = true;
      note.hit = false;
      this._grantScore(note, JUDGEMENT.GOOD, now, { partial: true });
    } else {
      note.holdCompleted = true;
      note.holdActive = false;
      note.hit = true;
    }
  }

  /**
   * タッチ/キーイベントがメインスレッド待ちで遅れて処理された場合、
   * イベント発生時刻を使ってその遅延分を補正する。これによりスマホの
   * 一時的な描画負荷で「押したのにMISS」になる現象を軽減する。
   */
  _inputTime(eventTimeMs) {
    const current = performance.now();
    const eventMs = Number(eventTimeMs);
    if (!Number.isFinite(eventMs)) return rhythmClock.inputNow();
    const latencySec = Math.max(0, Math.min(0.12, (current - eventMs) / 1000));
    return rhythmClock.inputNow() - latencySec;
  }

  // ---------- 判定・ダメージ適用 ----------
  _applyJudgement(note, judgement, now) {
    note.hit = judgement !== JUDGEMENT.MISS;
    note.missed = judgement === JUDGEMENT.MISS;
    this._grantScore(note, judgement, now);
  }

  _grantScore(note, judgement, now) {
    const abilities = this.effectiveAbilities;
    const hpRatio = this.player.hp / this.player.maxHp;
    const lowHpMult = DamageSystem.computeLowHpBonusMult(hpRatio, abilities);
    const comboMult = this.player.comboMultiplier * lowHpMult;

    const scoreGain = DamageSystem.computeScore(judgement, comboMult);
    this.player.registerJudgement(judgement, scoreGain);

    const laneX = this.renderer.laneCenterX(note.lane);
    const judgeY = this.renderer.judgeLineY;
    this._laneFlashUntil[note.lane] = now + 0.1;

    if (judgement === JUDGEMENT.MISS) {
      const dmg = DamageSystem.computeMissDamage(abilities, this.gimmicks);
      this.player.takeDamage(dmg);
      this.effects.onJudgement(laneX, judgeY, judgement);
      audioManager.playBeep(180, 0.09, 'sawtooth', 0.2);
      bus.emit('play:judgement', { judgement, lane: note.lane });
      return;
    }

    const dmg = DamageSystem.computeBossDamage(judgement, comboMult, abilities, this.gimmicks);
    const isBig = judgement === JUDGEMENT.PERFECT && this.player.combo % 25 === 0 && this.player.combo > 0;
    this.boss.takeDamage(dmg, now);
    this.bossRenderer.notifyHit(now);
    this.effects.onJudgement(laneX, judgeY, judgement);
    this.effects.onBossHit(this.renderer.width / 2, this.renderer.height * 0.12, isBig);

    const heal = DamageSystem.computeHeal(judgement, abilities, this.gimmicks);
    if (heal > 0) this.player.heal(heal);

    audioManager.playBeep(judgement === JUDGEMENT.PERFECT ? 1200 : 900, 0.05, 'sine', 0.15);
    bus.emit('play:judgement', { judgement, lane: note.lane });
  }

  // ---------- メインループ ----------
  _loop(tMs) {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, (tMs - this._lastFrameAt) / 1000);
    this._lastFrameAt = tMs;
    if (this._paused) return;

    const now = rhythmClock.now();

    this._autoMissExpiredNotes(now);
    this._updateHolds(now);

    const phaseChanged = this.phaseSystem.update(now);
    if (phaseChanged) {
      bus.emit('play:phase', { name: this.phaseSystem.phaseName, index: this.phaseSystem.currentPhaseIndex });
    }

    this.effects.update(dt);
    this._render(now);
    this._emitHud(now);

    if (this.boss.isDefeated && !this._ended) {
      this._ended = true;
      this._finish(true);
    } else if (!this.player.isAlive && !this._ended) {
      this._ended = true;
      this._finish(false);
    } else if (now >= this.beatmap.duration + 0.4 && !this._ended) {
      this._ended = true;
      this._finish(this.boss.hp <= this.boss.maxHp * 0.5 || this.player.isAlive);
    }
  }

  _autoMissExpiredNotes(now) {
    const windowMult = this.effectiveAbilities.judgeWindowMult;
    for (const note of this.beatmap.notes) {
      if (note.hit || note.missed) continue;
      if (note.type === NOTE_TYPES.HOLD && note.holdActive) continue;
      const deadline = Judgement.missDeadline(note.time, windowMult);
      if (now > deadline) {
        this._applyJudgement(note, JUDGEMENT.MISS, now);
      }
    }
  }

  _updateHolds(now) {
    for (const [lane, note] of Array.from(this._activeHolds.entries())) {
      if (now >= note.endTime) {
        note.holdActive = false;
        note.holdCompleted = true;
        note.hit = true;
        this._activeHolds.delete(lane);
        this._grantScore(note, JUDGEMENT.PERFECT, now, { holdComplete: true });
      }
    }
  }

  _render(now) {
    const r = this.renderer;
    r.clear();
    const shake = this.effects.getShakeOffset();
    r.ctx.save();
    r.ctx.translate(shake.x, shake.y);

    r.drawBackground(now, this.boss);
    this.bossRenderer.draw(r.ctx, {
      x: r.width / 2,
      y: r.height * 0.12,
      size: Math.min(r.width, r.height) * 0.26,
      nowSec: now,
      enraged: this.boss.enraged,
      defeated: this.boss.isDefeated,
      defeatProgress: 0
    });
    r.drawLanes();
    r.drawNotes(this.beatmap.notes, now, this.approachSec, this._laneFlashUntil);
    this.effects.draw(r.ctx);

    r.ctx.restore();
  }

  _emitHud(now) {
    bus.emit('play:hud', {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      bossHp: this.boss.hp,
      bossMaxHp: this.boss.maxHp,
      bossPct: this.boss.hpPercent,
      combo: this.player.combo,
      score: this.player.score,
      phaseName: this.phaseSystem.phaseName,
      timeSec: now,
      durationSec: this.beatmap.duration,
      bossName: this.boss.name
    });
  }

  _finish(cleared) {
    this.stop();
    const grade = this.player.grade;
    const isDraftTest = String(this.stage.id).startsWith('__draft');
    if (!isDraftTest) {
      stageManager.recordPlay(this.stage.id, cleared);
      rankingManager.submitScore(this.stage.id, {
        score: this.player.score,
        accuracy: this.player.accuracy,
        maxCombo: this.player.maxCombo,
        grade
      });
      const unlocks = saveManager.getUnlocks();
      if (cleared && !unlocks.titles.includes('BOSS SLAYER')) {
        unlocks.titles.push('BOSS SLAYER');
        saveManager.saveUnlocks(unlocks);
      }
    }
    bus.emit('play:finished', {
      cleared,
      score: this.player.score,
      accuracy: this.player.accuracy,
      maxCombo: this.player.maxCombo,
      grade,
      judgeCounts: this.player.judgeCounts,
      stage: this.stage
    });
  }
}
