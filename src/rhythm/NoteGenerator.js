import { Beatmap } from './Beatmap.js';
import { Note } from './Note.js';
import { NOTE_TYPES, LANE_COUNT, DIFFICULTY, GRID_DIVISIONS } from '../utils/constants.js';
import { mulberry32 } from '../utils/helpers.js';

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;

/**
 * オーディオバッファを解析し、オンセット（音の立ち上がり）検出に基づいて
 * 譜面の初期案（自動生成譜面）を作成するクラス（仕様書 #23）。
 * BPM・ビート・キック/スネア相当のエネルギー変化・音量ピークなどを解析対象とする。
 */
export class NoteGenerator {
  /**
   * AudioBufferから短時間エネルギーに基づくオンセット強度関数（ODF）を計算する。
   * @param {AudioBuffer} buffer
   * @returns {{ times: number[], strength: number[], hopSec: number }}
   */
  static analyzeOnsets(buffer) {
    const sampleRate = buffer.sampleRate;
    const channelCount = buffer.numberOfChannels;
    const length = buffer.length;

    // モノラルにダウンミックス
    const mono = new Float32Array(length);
    for (let c = 0; c < channelCount; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channelCount;
    }

    const frameCount = Math.max(1, Math.floor((length - FRAME_SIZE) / HOP_SIZE));
    const energies = new Float32Array(frameCount);
    const highFreqEnergies = new Float32Array(frameCount);

    for (let f = 0; f < frameCount; f++) {
      const start = f * HOP_SIZE;
      let sumSq = 0;
      let hfSum = 0;
      let prevSample = 0;
      for (let i = 0; i < FRAME_SIZE; i++) {
        const s = mono[start + i] || 0;
        sumSq += s * s;
        // 隣接サンプル差分＝簡易ハイパス（高域成分＝アタック検出に有効）
        hfSum += Math.abs(s - prevSample);
        prevSample = s;
      }
      energies[f] = Math.sqrt(sumSq / FRAME_SIZE);
      highFreqEnergies[f] = hfSum / FRAME_SIZE;
    }

    // オンセット強度関数：エネルギー増加分 + 高域変化量
    const odf = new Float32Array(frameCount);
    for (let f = 1; f < frameCount; f++) {
      const energyRise = Math.max(0, energies[f] - energies[f - 1]);
      odf[f] = energyRise * 3.0 + highFreqEnergies[f] * 1.5;
    }

    const hopSec = HOP_SIZE / sampleRate;
    const times = Array.from({ length: frameCount }, (_, f) => f * hopSec);

    return { times, strength: Array.from(odf), hopSec, rms: Array.from(energies) };
  }

  /**
   * ODFから局所ピークを抽出し、オンセット時刻の配列を返す。
   * @param {{ times: number[], strength: number[] }} odfResult
   * @param {number} minIntervalSec ピーク間の最小間隔
   */
  static pickPeaks(odfResult, minIntervalSec) {
    const { times, strength } = odfResult;
    const n = strength.length;
    const windowRadius = 6;

    // 適応的しきい値：局所平均 + 標準偏差
    const mean = strength.reduce((a, b) => a + b, 0) / (n || 1);
    const variance = strength.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1);
    const std = Math.sqrt(variance);
    const threshold = mean + std * 0.9;

    const peaks = [];
    let lastPeakTime = -Infinity;
    for (let i = windowRadius; i < n - windowRadius; i++) {
      const v = strength[i];
      if (v < threshold) continue;
      let isLocalMax = true;
      for (let k = i - windowRadius; k <= i + windowRadius; k++) {
        if (k !== i && strength[k] > v) { isLocalMax = false; break; }
      }
      if (!isLocalMax) continue;
      if (times[i] - lastPeakTime < minIntervalSec) continue;
      peaks.push({ time: times[i], strength: v });
      lastPeakTime = times[i];
    }
    return peaks;
  }

  /**
   * 時刻を指定BPM・グリッド分割にスナップする。
   */
  static snapToGrid(timeSec, bpm, division) {
    const beatSec = 60 / bpm;
    const gridSec = beatSec / (division / 4); // division=4を1拍とする
    return Math.round(timeSec / gridSec) * gridSec;
  }

  /**
   * オンセット群からレーン・ノーツ種別を割り当て、譜面(Beatmap)を構築する。
   * @param {AudioBuffer} buffer
   * @param {number} bpm
   * @param {string} difficultyId DIFFICULTYのキー
   * @param {number} [seed]
   * @returns {Beatmap}
   */
  static generate(buffer, bpm, difficultyId = 'NORMAL', seed = 1) {
    const diff = DIFFICULTY[difficultyId] || DIFFICULTY.NORMAL;
    const odf = this.analyzeOnsets(buffer);
    const beatSec = 60 / bpm;
    const minInterval = (beatSec / 8) / diff.speedMult; // 最速でも32分は詰めすぎない
    let peaks = this.pickPeaks(odf, Math.max(0.06, minInterval));

    // 密度調整：EASYなら間引き、EXPERTなら弱いピークも拾う
    const rng = mulberry32(seed);
    if (diff.density < 1) {
      peaks = peaks.filter(() => rng() < diff.density + 0.15);
    } else if (diff.density > 1) {
      // 強いピークの間に補助ノーツを軽く挿入
      const extra = [];
      for (let i = 0; i < peaks.length - 1; i++) {
        const gap = peaks[i + 1].time - peaks[i].time;
        if (gap > beatSec * 0.9 && rng() < (diff.density - 1)) {
          extra.push({ time: peaks[i].time + gap / 2, strength: peaks[i].strength * 0.6 });
        }
      }
      peaks = peaks.concat(extra).sort((a, b) => a.time - b.time);
    }

    // グリッド分割の決定（難易度が上がるほど細かい分割を許容）
    const division = diff.level >= 4 ? 16 : diff.level === 3 ? 8 : 4;

    const notes = [];
    let lastLane = -1;
    const duration = buffer.duration;
    const strengthValues = peaks.map((p) => p.strength);
    const maxStrength = Math.max(1e-6, ...strengthValues);

    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      let time = this.snapToGrid(peak.time, bpm, division);
      time = Math.max(0.3, Math.min(duration - 0.15, time));
      const relStrength = peak.strength / maxStrength;

      // レーン選択：直前と被らないようローテーション＋ランダム性
      let lane = Math.floor(rng() * LANE_COUNT);
      if (lane === lastLane) lane = (lane + 1 + Math.floor(rng() * (LANE_COUNT - 1))) % LANE_COUNT;
      lastLane = lane;

      // 強いピーク（サビ級）はCHAIN（同時多レーン）にすることがある
      if (relStrength > 0.85 && diff.level >= 3 && rng() < 0.25) {
        const secondLane = (lane + 2) % LANE_COUNT;
        notes.push(new Note({ time, lane, type: NOTE_TYPES.CHAIN }));
        notes.push(new Note({ time, lane: secondLane, type: NOTE_TYPES.CHAIN }));
        continue;
      }

      // 次のオンセットまで間隔が広ければHOLDにする（サステイン表現）
      const nextTime = i < peaks.length - 1 ? peaks[i + 1].time : duration;
      const gapToNext = nextTime - peak.time;
      if (gapToNext > beatSec * 1.5 && relStrength > 0.5 && rng() < 0.3) {
        const holdLen = Math.min(gapToNext * 0.7, beatSec * 3);
        notes.push(new Note({ time, lane, type: NOTE_TYPES.HOLD, holdDuration: holdLen }));
        continue;
      }

      // 高強度かつ高難易度ではSLIDEを混ぜてバリエーションを出す
      if (relStrength > 0.7 && diff.level >= 2 && rng() < 0.2) {
        notes.push(new Note({ time, lane, type: NOTE_TYPES.SLIDE }));
        continue;
      }

      notes.push(new Note({ time, lane, type: NOTE_TYPES.TAP }));
    }

    notes.sort((a, b) => a.time - b.time);

    const beatmap = new Beatmap({ bpm, duration, notes, difficulty: diff.id });
    return beatmap;
  }

  /**
   * 全難易度分の譜面を一括生成する。
   * @param {AudioBuffer} buffer
   * @param {number} bpm
   * @returns {Record<string, Beatmap>}
   */
  static generateAllDifficulties(buffer, bpm, seed = 1) {
    const result = {};
    for (const key of Object.keys(DIFFICULTY)) {
      if (key === 'UNKNOWN_SONG') continue;
      result[key] = this.generate(buffer, bpm, key, seed + key.length);
    }
    return result;
  }
}
