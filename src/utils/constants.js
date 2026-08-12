/**
 * ゲーム全体で使用する定数群。マジックナンバー禁止方針に基づき、
 * 数値設定はすべてここに集約する。
 */

export const LANE_COUNT = 4;

export const NOTE_TYPES = Object.freeze({
  TAP: 'TAP',
  HOLD: 'HOLD',
  SLIDE: 'SLIDE',
  CHAIN: 'CHAIN',
  SPECIAL: 'SPECIAL'
});

export const JUDGEMENT = Object.freeze({
  PERFECT: 'PERFECT',
  GREAT: 'GREAT',
  GOOD: 'GOOD',
  MISS: 'MISS'
});

/** 判定窓（秒）。値が小さいほどシビア。少し緩めの設定。 */
export const JUDGE_WINDOW_SEC = Object.freeze({
  PERFECT: 0.06,
  GREAT: 0.12,
  GOOD: 0.19,
  MISS: 0.27
});

/** 判定ごとの基礎ダメージ（ボスHPに対する割合ではなく固定値） */
export const JUDGE_DAMAGE = Object.freeze({
  PERFECT: 140,
  GREAT: 95,
  GOOD: 55,
  MISS: 0
});

/** MISS時にプレイヤーが受けるダメージ */
export const MISS_PLAYER_DAMAGE = 60;

export const PLAYER_MAX_HP_DEFAULT = 1000;

/** コンボ数と攻撃力倍率のしきい値テーブル */
export const COMBO_MULTIPLIER_TABLE = Object.freeze([
  { combo: 200, mult: 2.0 },
  { combo: 100, mult: 1.5 },
  { combo: 50, mult: 1.2 },
  { combo: 0, mult: 1.0 }
]);

export const DIFFICULTY = Object.freeze({
  EASY: { id: 'EASY', label: 'EASY', level: 1, density: 0.55, speedMult: 0.85 },
  NORMAL: { id: 'NORMAL', label: 'NORMAL', level: 2, density: 0.8, speedMult: 1.0 },
  HARD: { id: 'HARD', label: 'HARD', level: 3, density: 1.15, speedMult: 1.15 },
  EXPERT: { id: 'EXPERT', label: 'EXPERT', level: 4, density: 1.5, speedMult: 1.3 },
  UNKNOWN_SONG: { id: 'UNKNOWN_SONG', label: '???', level: 5, density: 1.9, speedMult: 1.45 }
});

export const GRID_DIVISIONS = [1, 2, 4, 8, 16, 32];

/** ノーツが出現してから判定ラインに到達するまでの時間（秒）＝視認時間。BPM基準値の速度で、これより速いBPMの曲は速く、遅いBPMの曲はゆっくり流れる。 */
export const NOTE_APPROACH_SEC_DEFAULT = 1.5;

/** ノーツ速度がBPMに応じて変化する際の基準BPM（この値と同じBPMなら NOTE_APPROACH_SEC_DEFAULT のまま） */
export const REFERENCE_BPM = 120;

/** BPMによる速度変化の上限・下限（速くなりすぎ・遅くなりすぎを防ぐためのクランプ範囲） */
export const BPM_SPEED_RATIO_MIN = 0.6;
export const BPM_SPEED_RATIO_MAX = 1.7;

export const GIMMICKS = Object.freeze({
  SPEED_2X: 'SPEED_2X',
  MIRROR: 'MIRROR',
  REVERSE: 'REVERSE',
  NO_HEAL: 'NO_HEAL',
  INVISIBLE: 'INVISIBLE',
  RANDOM_LANE: 'RANDOM_LANE',
  ONE_MISS: 'ONE_MISS',
  DOUBLE_DAMAGE: 'DOUBLE_DAMAGE'
});

export const PHASE_NAMES = ['PHASE 1 - Awakening', 'PHASE 2 - Acceleration', 'PHASE 3 - Rage', 'PHASE 4 - Overdrive', 'FINAL BREAK'];

export const STORAGE_KEYS = Object.freeze({
  STAGES: 'ycsb.stages.v1',
  COMMUNITY: 'ycsb.community.v1',
  SCORES: 'ycsb.scores.v1',
  SETTINGS: 'ycsb.settings.v1',
  UNLOCKS: 'ycsb.unlocks.v1',
  RATINGS: 'ycsb.ratings.v1',
  REPORTS: 'ycsb.reports.v1',
  TITLES: 'ycsb.titles.v1'
});

export const DEFAULT_SETTINGS = Object.freeze({
  audioOffsetMs: 0,
  inputOffsetMs: 0,
  masterVolume: 0.85,
  musicVolume: 1.0,
  sfxVolume: 0.9,
  noteSpeed: 1.0,
  laneSize: 1.0,
  colorBlindMode: false,
  reduceFlash: false,
  screenShake: true,
  effects: true,
  showJudgeText: true
});
