import { audioManager } from '../core/AudioManager.js';

/**
 * ゲーム内時間の唯一の情報源。仕様書 #49 の通り、
 * requestAnimationFrameのフレームカウントではなくAudioContextの時刻を基準にする。
 * オーディオ/入力オフセット（キャリブレーション値）もここで一元的に補正する。
 */
export class RhythmClock {
  constructor() {
    this.audioOffsetSec = 0; // 正の値=音楽を遅く感じる補正
    this.inputOffsetSec = 0; // 正の値=入力を早く評価する補正
  }

  setOffsets({ audioOffsetMs = 0, inputOffsetMs = 0 }) {
    this.audioOffsetSec = audioOffsetMs / 1000;
    this.inputOffsetSec = inputOffsetMs / 1000;
  }

  /** 譜面判定に使う「音楽時間」（オフセット補正込み） */
  now() {
    return audioManager.getCurrentTime() + this.audioOffsetSec;
  }

  /** 入力タイミング評価用の時間（入力オフセット込み） */
  inputNow() {
    return this.now() + this.inputOffsetSec;
  }
}

export const rhythmClock = new RhythmClock();
