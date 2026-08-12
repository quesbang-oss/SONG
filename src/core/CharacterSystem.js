// src/core/CharacterSystem.js
// 完全版
// 仕様:
// - スキル条件値は最低20（combo / hits / perfect）
// - 条件値の倍数ごとに同一演奏中何度でも発動
// - comboはコンボが切れたらスキル用カウンターをリセットし、再び条件値に到達すると発動
// - ログインボーナスは毎日100ダイヤ
// - 曲クリア報酬は従来値の2倍
// - 画像パス、CharacterHub、ミッション処理は変更していません

import characterData from '../data/characters.json';
import { bus } from '../utils/EventBus.js';
import { saveManager } from './SaveManager.js';
import { clamp } from '../utils/helpers.js';

const MAX_LEVEL = 50;
const MAX_BREAKTHROUGH = 5;
const GACHA_COST_SINGLE = 100;
const GACHA_COST_TEN = 900;
const DUPLICATE_XP = 120;
const DUPLICATE_SHARDS = 1;
const XP_PER_LEVEL_BASE = 100;

const RARITY_RATES = Object.freeze([
  { rarity: 5, rate: 0.03 },
  { rarity: 4, rate: 0.10 },
  { rarity: 3, rate: 0.27 },
  { rarity: 2, rate: 0.35 },
  { rarity: 1, rate: 0.25 }
]);

// 元のクリア報酬:
// EASY 20 / NORMAL 30 / HARD 45 / EXPERT 65 / UNKNOWN_SONG 90
// ↓ すべて2倍
const CLEAR_REWARDS = Object.freeze({
  EASY: 40,
  NORMAL: 60,
  HARD: 90,
  EXPERT: 130,
  UNKNOWN_SONG: 180
});

const LOGIN_REWARD = 100;

const DAILY_GOAL = 3;
const WEEKLY_GOAL = 10;
const EVENT_GOAL = 7;

function createInitialState() {
  return {
    currency: 500,
    selectedCharacterId: 'sp_001',

    characters: {},

    stats: {
      plays: 0,
      clears: 0,
      firstClears: 0,
      fullCombos: 0,
      totalNotes: 0,
      perfects: 0,
      highDifficultyClears: 0
    },

    claimedFirstClears: {},
    claimedFullCombos: {},

    missions: {
      daily: {
        date: '',
        progress: 0,
        claimed: false
      },
      weekly: {
        week: '',
        progress: 0,
        claimed: false
      }
    },

    achievements: {},

    login: {
      lastDate: '',
      streak: 0,
      claimedToday: false
    },

    event: {
      startedAt: '',
      progress: 0,
      claimed: false
    }
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekKey() {
  const d = new Date();
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  const week = Math.ceil(
    (((d - first) / 86400000) + first.getUTCDay() + 1) / 7
  );

  return `${d.getUTCFullYear()}-W${week}`;
}

function normalizeState(raw) {
  const base = createInitialState();
  const state = { ...base, ...(raw || {}) };

  state.characters = {
    ...(raw?.characters || {})
  };

  state.stats = {
    ...base.stats,
    ...(raw?.stats || {})
  };

  state.claimedFirstClears = {
    ...(raw?.claimedFirstClears || {})
  };

  state.claimedFullCombos = {
    ...(raw?.claimedFullCombos || {})
  };

  state.missions = {
    daily: {
      ...base.missions.daily,
      ...(raw?.missions?.daily || {})
    },
    weekly: {
      ...base.missions.weekly,
      ...(raw?.missions?.weekly || {})
    }
  };

  state.achievements = {
    ...(raw?.achievements || {})
  };

  state.login = {
    ...base.login,
    ...(raw?.login || {})
  };

  state.event = {
    ...base.event,
    ...(raw?.event || {})
  };

  return state;
}

export class CharacterSystem {
  constructor() {
    this.characters = characterData.map((c) => ({ ...c }));

    this.state = normalizeState(
      saveManager.getCharacterData()
    );

    this._battle = null;

    bus.on('play:finished', (result) => {
      this.onPlayFinished(result);
    });

    this._prepareDateState();
    this._ensureStarterCharacter();
    this._save();
  }

  _save() {
    saveManager.saveCharacterData(this.state);
  }

  _prepareDateState() {
    const today = todayKey();

    if (this.state.missions.daily.date !== today) {
      this.state.missions.daily = {
        date: today,
        progress: 0,
        claimed: false
      };
    }

    const week = weekKey();

    if (this.state.missions.weekly.week !== week) {
      this.state.missions.weekly = {
        week,
        progress: 0,
        claimed: false
      };
    }

    if (!this.state.event.startedAt) {
      this.state.event.startedAt = today;
    }

    this._processLogin(today);
  }

  _processLogin(today) {
    if (this.state.login.lastDate === today) {
      return;
    }

    const previous = new Date(
      this.state.login.lastDate || '1970-01-01'
    );

    const current = new Date(today);

    const diff = Math.round(
      (current - previous) / 86400000
    );

    this.state.login.streak =
      diff === 1
        ? this.state.login.streak + 1
        : 1;

    this.state.login.lastDate = today;
    this.state.login.claimedToday = false;
  }

  _ensureStarterCharacter() {
    if (!this.state.characters.sp_001) {
      this.state.characters.sp_001 = {
        level: 1,
        xp: 0,
        breakthrough: 0,
        owned: 1
      };
    }
  }

  get allCharacters() {
    return this.characters;
  }

  getCharacter(id) {
    return (
      this.characters.find((c) => c.id === id) ||
      null
    );
  }

  getProgress(id) {
    return this.state.characters[id] || null;
  }

  isOwned(id) {
    return Boolean(this.state.characters[id]);
  }

  get selectedCharacter() {
    return (
      this.getCharacter(this.state.selectedCharacterId) ||
      this.getCharacter('sp_001')
    );
  }

  get currency() {
    return this.state.currency;
  }

  selectCharacter(id) {
    if (!this.isOwned(id)) {
      return false;
    }

    this.state.selectedCharacterId = id;
    this._save();

    bus.emit('character:changed', {
      character: this.selectedCharacter
    });

    return true;
  }

  getBattleStats() {
    const character = this.selectedCharacter;

    const progress =
      this.getProgress(character.id) || {
        level: 1,
        breakthrough: 0
      };

    const level = clamp(
      progress.level || 1,
      1,
      MAX_LEVEL
    );

    const breakthrough = clamp(
      progress.breakthrough || 0,
      0,
      MAX_BREAKTHROUGH
    );

    const levelBonus =
      1 + (level - 1) * 0.012;

    const breakthroughBonus =
      1 + breakthrough * 0.04;

    return {
      maxHp: Math.round(
        character.baseHp *
        levelBonus *
        breakthroughBonus
      ),

      attackMultiplier:
        character.attackMultiplier *
        (1 + (level - 1) * 0.004) *
        (1 + breakthrough * 0.02),

      character
    };
  }

  beginBattle() {
    const skill = this.selectedCharacter?.skill;

    const triggerType =
      skill?.trigger?.type || null;

    const triggerValue =
      this._getSkillTriggerValue(skill);

    this._battle = {
      hits: 0,
      perfects: 0,

      // 現在のコンボ。
      combo: 0,

      // comboスキル専用の到達カウンター。
      // ミス等でコンボが切れたら0に戻す。
      comboSkillCounter: 0,

      activeEffects: [],

      skillTriggerType: triggerType,
      skillTriggerValue: triggerValue,

      // hits / perfect は累積型なので
      // 20, 40, 60... のように進む。
      nextSkillTrigger:
        triggerValue > 0
          ? triggerValue
          : null
    };
  }

  endBattle() {
    this._battle = null;
  }

  _getSkillTriggerValue(skill) {
    const raw = Number(
      skill?.trigger?.value
    );

    if (!Number.isFinite(raw) || raw <= 0) {
      return 0;
    }

    // どんなキャラデータでも最低20。
    return Math.max(20, Math.floor(raw));
  }

  _getSkillMetric(triggerType) {
    if (!this._battle) {
      return 0;
    }

    if (triggerType === 'combo') {
      return this._battle.comboSkillCounter;
    }

    if (triggerType === 'hits') {
      return this._battle.hits;
    }

    if (triggerType === 'perfect') {
      return this._battle.perfects;
    }

    return 0;
  }

  _activateSkill(player, skill) {
    if (!this._battle || !skill) {
      return;
    }

    const effect = skill.effect;

    if (!effect) {
      return;
    }

    if (effect.type === 'heal') {
      player?.heal?.(effect.value);
    }

    if (effect.type === 'attackBuff') {
      const duration =
        Number(effect.durationSec) || 0;

      this._battle.activeEffects.push({
        type: 'attackBuff',
        value: Number(effect.value) || 0,
        until:
          performance.now() / 1000 +
          duration
      });
    }

    if (effect.type === 'missDamageMult') {
      const duration =
        Number(effect.durationSec) || 0;

      this._battle.activeEffects.push({
        type: 'missDamageMult',
        value: Number(effect.value) || 1,
        until:
          performance.now() / 1000 +
          duration
      });
    }

    this.playVoice('skill');

    bus.emit('character:skill', {
      character: this.selectedCharacter,
      skill
    });
  }

  onJudgement(judgement, combo, player) {
    if (!this._battle) {
      return;
    }

    const previousCombo =
      this._battle.combo;

    const currentCombo =
      Math.max(0, Number(combo) || 0);

    this._battle.hits += 1;

    this._battle.combo = currentCombo;

    if (judgement === 'PERFECT') {
      this._battle.perfects += 1;
    }

    /*
     * comboスキル:
     *
     * 「現在コンボが20」→発動
     * 「現在コンボが40」→発動
     *
     * そしてコンボが切れた場合:
     *
     * 20 → 発動
     * 失敗 → カウンター0
     * 再び20 → 発動
     *
     * という挙動にする。
     */
    if (currentCombo <= 0 || currentCombo < previousCombo) {
      this._battle.comboSkillCounter = 0;
    } else {
      this._battle.comboSkillCounter = currentCombo;
    }

    const skill =
      this.selectedCharacter?.skill;

    const trigger =
      skill?.trigger;

    if (!skill || !trigger) {
      return;
    }

    const triggerValue =
      this._getSkillTriggerValue(skill);

    if (!triggerValue) {
      return;
    }

    /*
     * 演奏中にキャラクターや条件が変わった場合、
     * 安全に現在の条件へ再同期する。
     */
    if (
      this._battle.skillTriggerType !==
        trigger.type ||
      this._battle.skillTriggerValue !==
        triggerValue ||
      !Number.isFinite(
        this._battle.nextSkillTrigger
      )
    ) {
      this._battle.skillTriggerType =
        trigger.type;

      this._battle.skillTriggerValue =
        triggerValue;

      this._battle.nextSkillTrigger =
        triggerValue;
    }

    const metric =
      this._getSkillMetric(trigger.type);

    /*
     * hits / perfect:
     * 20 → 40 → 60 → 80...
     *
     * combo:
     * 20 → 発動
     * 40 → 発動
     * コンボ切断 → カウンター0
     * 再び20 → 発動
     */
    while (
      metric >=
      this._battle.nextSkillTrigger
    ) {
      this._activateSkill(
        player,
        skill
      );

      this._battle.nextSkillTrigger +=
        triggerValue;
    }

    /*
     * comboが切れた場合は、次回の20コンボを
     * 新しい1周目として扱う。
     *
     * 例:
     * 20で発動
     * 30まで行く
     * MISSで0
     * 再び20で発動
     */
    if (
      trigger.type === 'combo' &&
      currentCombo <= 0
    ) {
      this._battle.nextSkillTrigger =
        triggerValue;
    }
  }

  getBattleModifiers() {
    const modifiers = {
      attackMult: 1,
      missDamageMult: 1
    };

    if (!this._battle) {
      return modifiers;
    }

    const now =
      performance.now() / 1000;

    this._battle.activeEffects =
      this._battle.activeEffects.filter(
        (e) => e.until > now
      );

    for (
      const effect of this._battle.activeEffects
    ) {
      if (effect.type === 'attackBuff') {
        modifiers.attackMult *=
          1 + effect.value;
      }

      if (
        effect.type === 'missDamageMult'
      ) {
        modifiers.missDamageMult *=
          effect.value;
      }
    }

    return modifiers;
  }

  addXp(id, amount) {
    const progress =
      this.state.characters[id];

    if (
      !progress ||
      progress.level >= MAX_LEVEL
    ) {
      return;
    }

    progress.xp += Math.max(
      0,
      Math.floor(amount)
    );

    while (
      progress.level < MAX_LEVEL
    ) {
      const need =
        XP_PER_LEVEL_BASE *
        progress.level;

      if (progress.xp < need) {
        break;
      }

      progress.xp -= need;
      progress.level += 1;

      bus.emit('character:levelup', {
        character: this.getCharacter(id),
        level: progress.level
      });
    }

    this._save();
  }

  _addCharacter(id) {
    if (!this.state.characters[id]) {
      this.state.characters[id] = {
        level: 1,
        xp: 0,
        breakthrough: 0,
        owned: 1
      };

      return {
        duplicate: false
      };
    }

    const progress =
      this.state.characters[id];

    progress.owned =
      (progress.owned || 1) + 1;

    progress.xp += DUPLICATE_XP;

    progress.breakthrough = Math.min(
      MAX_BREAKTHROUGH,
      (progress.breakthrough || 0) +
        DUPLICATE_SHARDS
    );

    return {
      duplicate: true
    };
  }

  _rollRarity() {
    const r = Math.random();
    let sum = 0;

    for (
      const row of RARITY_RATES
    ) {
      sum += row.rate;

      if (r < sum) {
        return row.rarity;
      }
    }

    return 1;
  }

  _rollCharacter() {
    const rarity =
      this._rollRarity();

    const candidates =
      this.characters.filter(
        (c) => c.rarity === rarity
      );

    if (candidates.length) {
      return candidates[
        Math.floor(
          Math.random() *
          candidates.length
        )
      ];
    }

    const fallback =
      this.characters.filter(
        (c) => c.rarity === 3
      );

    return fallback[
      Math.floor(
        Math.random() *
        fallback.length
      )
    ];
  }

  pull(count = 1) {
    const cost =
      count === 10
        ? GACHA_COST_TEN
        : GACHA_COST_SINGLE * count;

    if (this.state.currency < cost) {
      throw new Error(
        `ガチャ石が足りません（必要 ${cost}）`
      );
    }

    this.state.currency -= cost;

    const results = [];

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      const character =
        this._rollCharacter();

      const result =
        this._addCharacter(
          character.id
        );

      results.push({
        character,
        ...result
      });
    }

    this._save();

    bus.emit('gacha:result', results);

    return results;
  }

  addCurrency(amount, reason = '') {
    const value = Math.max(
      0,
      Math.floor(amount)
    );

    if (!value) {
      return;
    }

    this.state.currency += value;

    this._save();

    bus.emit('currency:changed', {
      amount: value,
      reason,
      total: this.state.currency
    });
  }

  _achievement(
    id,
    condition,
    reward
  ) {
    if (this.state.achievements[id]) {
      return 0;
    }

    if (!condition) {
      return 0;
    }

    this.state.achievements[id] = {
      claimed: true,
      at: Date.now(),
      reward
    };

    this.addCurrency(
      reward,
      `実績: ${id}`
    );

    return reward;
  }

  claimLogin() {
    if (
      this.state.login.claimedToday
    ) {
      return 0;
    }

    // ログインボーナスは常に100ダイヤ。
    const reward = LOGIN_REWARD;

    this.state.login.claimedToday =
      true;

    this.addCurrency(
      reward,
      'ログインボーナス'
    );

    this._save();

    return reward;
  }

  claimDaily() {
    const m =
      this.state.missions.daily;

    if (
      m.claimed ||
      m.progress < DAILY_GOAL
    ) {
      return 0;
    }

    m.claimed = true;

    this.addCurrency(
      100,
      'デイリーミッション'
    );

    this._save();

    return 100;
  }

  claimWeekly() {
    const m =
      this.state.missions.weekly;

    if (
      m.claimed ||
      m.progress < WEEKLY_GOAL
    ) {
      return 0;
    }

    m.claimed = true;

    this.addCurrency(
      350,
      'ウィークリーミッション'
    );

    this._save();

    return 350;
  }

  claimEvent() {
    if (
      this.state.event.claimed ||
      this.state.event.progress < EVENT_GOAL
    ) {
      return 0;
    }

    this.state.event.claimed = true;

    this.addCurrency(
      500,
      'イベント報酬'
    );

    this._save();

    return 500;
  }

  onPlayFinished(result) {
    if (!result?.stage) {
      return;
    }

    const stageId =
      result.stage.id;

    const difficulty =
      result.stage.difficulty ||
      'NORMAL';

    /*
     * 曲クリア報酬を2倍。
     */
    const clearReward =
      result.cleared
        ? (
            CLEAR_REWARDS[difficulty] ||
            60
          )
        : 0;

    if (clearReward) {
      this.addCurrency(
        clearReward,
        `曲クリア: ${difficulty}`
      );
    }

    this.state.stats.plays += 1;

    if (result.cleared) {
      this.state.stats.clears += 1;
    }

    /*
     * 初回クリア報酬。
     * これは通常クリア報酬とは別枠。
     */
    if (
      result.cleared &&
      !this.state.claimedFirstClears[
        stageId
      ]
    ) {
      this.state.claimedFirstClears[
        stageId
      ] = true;

      this.state.stats.firstClears += 1;

      this.addCurrency(
        50,
        '初回クリア'
      );
    }

    /*
     * フルコンボ報酬。
     * これも通常クリア報酬とは別枠。
     */
    const fullCombo =
      result.cleared &&
      (result.judgeCounts?.MISS || 0) === 0;

    if (
      fullCombo &&
      !this.state.claimedFullCombos[
        stageId
      ]
    ) {
      this.state.claimedFullCombos[
        stageId
      ] = true;

      this.state.stats.fullCombos += 1;

      this.addCurrency(
        80,
        'フルコンボ'
      );
    }

    const notes =
      result.judgeCounts || {};

    this.state.stats.totalNotes +=
      Object.values(notes).reduce(
        (a, b) => a + b,
        0
      );

    this.state.stats.perfects +=
      notes.PERFECT || 0;

    if (
      result.cleared &&
      [
        'HARD',
        'EXPERT',
        'UNKNOWN_SONG'
      ].includes(difficulty)
    ) {
      this.state.stats.highDifficultyClears += 1;
    }

    this.state.missions.daily.progress =
      Math.min(
        DAILY_GOAL,
        this.state.missions.daily.progress +
          (result.cleared ? 1 : 0)
      );

    this.state.missions.weekly.progress =
      Math.min(
        WEEKLY_GOAL,
        this.state.missions.weekly.progress +
          (result.cleared ? 1 : 0)
      );

    this.state.event.progress =
      Math.min(
        EVENT_GOAL,
        this.state.event.progress +
          (result.cleared ? 1 : 0)
      );

    this._achievement(
      'first_clear',
      this.state.stats.firstClears >= 1,
      100
    );

    this._achievement(
      'ten_clears',
      this.state.stats.clears >= 10,
      200
    );

    this._achievement(
      'first_full_combo',
      this.state.stats.fullCombos >= 1,
      150
    );

    this._achievement(
      'hard_clear',
      this.state.stats.highDifficultyClears >= 1,
      150
    );

    this.playVoice(
      result.cleared ? 'win' : 'lose'
    );

    const selectedId =
      this.selectedCharacter.id;

    const xp =
      result.cleared
        ? 80 +
          (
            [
              'HARD',
              'EXPERT',
              'UNKNOWN_SONG'
            ].includes(difficulty)
              ? 60
              : 0
          )
        : 20;

    this.addXp(
      selectedId,
      xp
    );

    this._save();
  }

  playVoice(type) {
    const character =
      this.selectedCharacter;

    if (
      character.rarity !== 5 ||
      !character.voice
    ) {
      return;
    }

    const src =
      character.voice[type];

    if (!src) {
      return;
    }

    try {
      const audio =
        new Audio(src);

      audio.volume = 0.9;

      audio.play().catch(() => {});
    } catch {
      // 音声未設定・ブラウザ制限時はゲームを止めない。
    }
  }

  getSummary() {
    return {
      currency: this.state.currency,

      selected:
        this.selectedCharacter,

      progress:
        this.getProgress(
          this.selectedCharacter.id
        ),

      characters:
        this.characters.map(
          (character) => ({
            character,
            progress:
              this.getProgress(
                character.id
              ),
            owned:
              this.isOwned(
                character.id
              )
          })
        ),

      missions:
        this.state.missions,

      login:
        this.state.login,

      event:
        this.state.event,

      stats:
        this.state.stats,

      achievements:
        this.state.achievements,

      maxLevel:
        MAX_LEVEL,

      maxBreakthrough:
        MAX_BREAKTHROUGH,

      singleCost:
        GACHA_COST_SINGLE,

      tenCost:
        GACHA_COST_TEN,

      rates:
        RARITY_RATES
    };
  }
}

export const characterSystem =
  new CharacterSystem();
