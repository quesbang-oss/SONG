/**
 * Web Audio APIを介した音源の読み込み・再生・時刻管理を担当する。
 * ゲーム内の唯一の時間基準は AudioContext.currentTime とし、
 * requestAnimationFrameのフレーム数には依存しない（仕様書 #49）。
 */
export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    /** @type {AudioBufferSourceNode|null} */
    this._sourceNode = null;
    /** @type {AudioBuffer|null} */
    this.currentBuffer = null;

    this._startedAtCtxTime = 0; // 再生開始時のctx.currentTime
    this._startOffsetSec = 0;   // バッファ内の再生開始オフセット
    this._isPlaying = false;
    this._playbackRate = 1.0;
  }

  /**
   * ユーザー操作起因でAudioContextを初期化・再開する（自動再生ポリシー対応）。
   */
  async ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  setVolumes({ master, music, sfx }) {
    if (!this.ctx) return;
    if (master !== undefined) this.masterGain.gain.value = master;
    if (music !== undefined) this.musicGain.gain.value = music;
    if (sfx !== undefined) this.sfxGain.gain.value = sfx;
  }

  /**
   * ファイル(File/Blob)からAudioBufferをデコードする（ローカル音源用）。
   * @param {File} file
   * @returns {Promise<AudioBuffer>}
   */
  async decodeFile(file) {
    await this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    return await this.decodeArrayBuffer(arrayBuffer);
  }

  /**
   * ArrayBufferをAudioBufferへデコードする。呼び出し元が保持するArrayBufferが
   * decodeAudioDataによって破棄（detach）されないよう、内部でコピーしてから渡す。
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<AudioBuffer>}
   */
  async decodeArrayBuffer(arrayBuffer) {
    await this.ensureContext();
    return await new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err || new Error('音声デコードに失敗しました'))
      );
    });
  }

  /**
   * 再生対象のAudioBufferをセットする。
   * @param {AudioBuffer} buffer
   */
  setBuffer(buffer) {
    this.stop();
    this.currentBuffer = buffer;
  }

  /**
   * 指定オフセット（秒）から再生を開始する。
   * @param {number} [offsetSec]
   */
  async play(offsetSec = 0) {
    await this.ensureContext();
    if (!this.currentBuffer) throw new Error('再生する音源がありません');
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = this.currentBuffer;
    src.playbackRate.value = this._playbackRate;
    src.connect(this.musicGain);
    const clamped = Math.max(0, Math.min(offsetSec, this.currentBuffer.duration - 0.001));
    src.start(0, clamped);
    this._sourceNode = src;
    this._startedAtCtxTime = this.ctx.currentTime;
    this._startOffsetSec = clamped;
    this._isPlaying = true;
    src.onended = () => {
      if (this._sourceNode === src) {
        this._isPlaying = false;
      }
    };
  }

  pause() {
    if (!this._isPlaying) return;
    this._pausedAt = this.getCurrentTime();
    this.stop();
  }

  async resume() {
    if (this._pausedAt !== undefined) {
      await this.play(this._pausedAt);
      this._pausedAt = undefined;
    }
  }

  stop() {
    if (this._sourceNode) {
      try { this._sourceNode.onended = null; this._sourceNode.stop(); } catch (err) { /* already stopped */ }
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    this._isPlaying = false;
  }

  /**
   * 現在の音楽再生時刻（秒）を取得する。これがゲーム全体の唯一の時間基準。
   * @returns {number}
   */
  getCurrentTime() {
    if (!this.ctx) return 0;
    if (!this._isPlaying) return this._pausedAt ?? this._startOffsetSec;
    return this._startOffsetSec + (this.ctx.currentTime - this._startedAtCtxTime) * this._playbackRate;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  get duration() {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  /**
   * 短いSE（判定音等）をビープとして生成再生する。ファイル資産に依存しない。
   * @param {number} freq
   * @param {number} durationSec
   * @param {'sine'|'square'|'triangle'|'sawtooth'} type
   */
  playBeep(freq = 880, durationSec = 0.08, type = 'sine', gainValue = 0.25) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + durationSec);
  }

  /**
   * SAFE SONG LIBRARY用に、完全にオリジナルな楽曲をプロシージャルに生成する。
   * 外部音源を一切使用しないため、ライセンス面で常に安全。
   * @param {import('../music/SafeSongLibrary.js').SafeSongDef} def
   * @returns {Promise<AudioBuffer>}
   */
  async generateProceduralSong(def) {
    await this.ensureContext();
    const sampleRate = this.ctx.sampleRate;
    const durationSec = def.duration;
    const length = Math.floor(sampleRate * durationSec);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    const bpm = def.bpm;
    const beatSec = 60 / bpm;
    const rng = mulberry32Local(def.seed || 1);

    // --- ドラム（キック/ハイハット）: パターンをbeatごとに配置 ---
    const drumBufferL = offlineCtx.createBuffer(1, length, sampleRate);
    const drumData = drumBufferL.getChannelData(0);
    const beatsTotal = Math.floor(durationSec / beatSec);
    for (let b = 0; b < beatsTotal; b++) {
      const t = b * beatSec;
      const sampleIdx = Math.floor(t * sampleRate);
      const isDownbeat = b % 4 === 0;
      const kickLen = Math.floor(sampleRate * 0.12);
      for (let i = 0; i < kickLen && sampleIdx + i < length; i++) {
        const env = Math.exp(-i / (sampleRate * 0.045));
        const freq = isDownbeat ? 90 : 70;
        drumData[sampleIdx + i] += Math.sin((2 * Math.PI * freq * i) / sampleRate) * env * 0.9;
      }
      if (b % 2 === 1) {
        const hatIdx = sampleIdx + Math.floor(sampleRate * beatSec * 0.5);
        const hatLen = Math.floor(sampleRate * 0.03);
        for (let i = 0; i < hatLen && hatIdx + i < length; i++) {
          const env = Math.exp(-i / (sampleRate * 0.01));
          drumData[hatIdx + i] += (rng() * 2 - 1) * env * 0.25;
        }
      }
    }

    // --- ベースライン（矩形波の簡易シーケンス） ---
    const bassOsc = offlineCtx.createOscillator();
    bassOsc.type = 'sawtooth';
    const bassGain = offlineCtx.createGain();
    bassGain.gain.value = 0.16;
    const rootFreq = def.rootFreq || 110;
    const scaleSteps = [0, 0, 3, 5, 7, 5, 3, 0];
    for (let b = 0; b < beatsTotal; b++) {
      const step = scaleSteps[b % scaleSteps.length];
      const freq = rootFreq * Math.pow(2, step / 12);
      bassOsc.frequency.setValueAtTime(freq, b * beatSec);
    }
    bassOsc.connect(bassGain);

    // --- メロディ（矩形波、8分音符でスケール上を歩く） ---
    const leadOsc = offlineCtx.createOscillator();
    leadOsc.type = 'square';
    const leadGain = offlineCtx.createGain();
    leadGain.gain.value = 0.09;
    const melodyScale = [0, 2, 4, 5, 7, 9, 11, 12];
    const eighth = beatSec / 2;
    const eighthsTotal = Math.floor(durationSec / eighth);
    for (let e = 0; e < eighthsTotal; e++) {
      const degree = melodyScale[Math.floor(rng() * melodyScale.length)];
      const octave = rng() > 0.85 ? 2 : 1;
      const freq = rootFreq * 2 * Math.pow(2, degree / 12) * octave;
      leadOsc.frequency.setValueAtTime(freq, e * eighth);
    }
    leadOsc.connect(leadGain);

    // --- ドラムバッファをソースとして接続 ---
    const drumSrc = offlineCtx.createBufferSource();
    drumSrc.buffer = drumBufferL;
    const drumGain = offlineCtx.createGain();
    drumGain.gain.value = 0.9;
    drumSrc.connect(drumGain);

    const merger = offlineCtx.createChannelMerger(2);
    const master = offlineCtx.createGain();
    master.gain.value = 0.8;
    bassGain.connect(master);
    leadGain.connect(master);
    drumGain.connect(master);
    master.connect(offlineCtx.destination);

    bassOsc.start(0);
    leadOsc.start(0);
    drumSrc.start(0);
    bassOsc.stop(durationSec);
    leadOsc.stop(durationSec);

    const rendered = await offlineCtx.startRendering();
    return rendered;
  }
}

function mulberry32Local(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const audioManager = new AudioManager();
