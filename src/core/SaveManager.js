import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS
} from '../utils/constants.js';

/**
 * localStorageを介した永続化を一元管理するクラス。
 */
export class SaveManager {
  constructor() {
    this._memoryFallback =
      new Map();

    this._storageAvailable =
      this._checkStorage();
  }

  _checkStorage() {
    try {
      const testKey =
        '__ycsb_test__';

      window.localStorage.setItem(
        testKey,
        '1'
      );

      window.localStorage.removeItem(
        testKey
      );

      return true;
    } catch (err) {
      console.error(
        '[SaveManager] localStorage unavailable, falling back to memory storage.',
        err
      );

      return false;
    }
  }

  _read(
    key,
    fallback
  ) {
    if (
      !this._storageAvailable
    ) {
      return this._memoryFallback.has(key)
        ? this._memoryFallback.get(key)
        : fallback;
    }

    try {
      const raw =
        window.localStorage.getItem(
          key
        );

      if (raw === null) {
        return fallback;
      }

      return JSON.parse(raw);
    } catch (err) {
      console.error(
        `[SaveManager] failed to read "${key}"`,
        err
      );

      return fallback;
    }
  }

  _write(
    key,
    value
  ) {
    if (
      !this._storageAvailable
    ) {
      this._memoryFallback.set(
        key,
        value
      );

      return true;
    }

    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;
    } catch (err) {
      console.error(
        `[SaveManager] failed to write "${key}"`,
        err
      );

      return false;
    }
  }

  // ---------- Settings ----------

  getSettings() {
    return {
      ...DEFAULT_SETTINGS,
      ...this._read(
        STORAGE_KEYS.SETTINGS,
        {}
      )
    };
  }

  saveSettings(settings) {
    return this._write(
      STORAGE_KEYS.SETTINGS,
      settings
    );
  }

  // ---------- Stages ----------

  getStages() {
    return this._read(
      STORAGE_KEYS.STAGES,
      []
    );
  }

  saveStage(stage) {
    const stages =
      this.getStages();

    const idx =
      stages.findIndex(
        (s) => s.id === stage.id
      );

    if (idx >= 0) {
      stages[idx] =
        stage;
    } else {
      stages.push(stage);
    }

    this._write(
      STORAGE_KEYS.STAGES,
      stages
    );

    return stage;
  }

  deleteStage(stageId) {
    const stages =
      this.getStages().filter(
        (s) => s.id !== stageId
      );

    this._write(
      STORAGE_KEYS.STAGES,
      stages
    );
  }

  getStageById(stageId) {
    return (
      this.getStages().find(
        (s) => s.id === stageId
      ) || null
    );
  }

  // ---------- Community ----------

  getCommunityStages() {
    return this._read(
      STORAGE_KEYS.COMMUNITY,
      []
    );
  }

  publishToCommunity(stage) {
    const list =
      this.getCommunityStages();

    const idx =
      list.findIndex(
        (s) => s.id === stage.id
      );

    if (idx >= 0) {
      list[idx] =
        stage;
    } else {
      list.unshift(stage);
    }

    this._write(
      STORAGE_KEYS.COMMUNITY,
      list
    );

    return stage;
  }

  removeFromCommunity(stageId) {
    const list =
      this.getCommunityStages()
        .filter(
          (s) => s.id !== stageId
        );

    this._write(
      STORAGE_KEYS.COMMUNITY,
      list
    );
  }

  // ---------- Scores ----------

  getScores() {
    return this._read(
      STORAGE_KEYS.SCORES,
      {}
    );
  }

  recordScore(
    stageId,
    entry
  ) {
    const all =
      this.getScores();

    const list =
      all[stageId] || [];

    list.push(entry);

    list.sort(
      (a, b) =>
        b.score - a.score
    );

    all[stageId] =
      list.slice(0, 20);

    this._write(
      STORAGE_KEYS.SCORES,
      all
    );

    return all[stageId];
  }

  getStageScores(stageId) {
    return (
      this.getScores()[stageId] ||
      []
    );
  }

  getStageBest(stageId) {
    const list =
      this.getStageScores(
        stageId
      );

    return list.length
      ? list[0]
      : null;
  }

  // ---------- Characters ----------

  getCharacterData() {
    return this._read(
      'ycsb.characters.v1',
      null
    );
  }

  saveCharacterData(data) {
    return this._write(
      'ycsb.characters.v1',
      data
    );
  }

  // ---------- Unlocks ----------

  getUnlocks() {
    return this._read(
      STORAGE_KEYS.UNLOCKS,
      {
        titles: ['ROOKIE'],
        abilitiesSeen: []
      }
    );
  }

  saveUnlocks(unlocks) {
    return this._write(
      STORAGE_KEYS.UNLOCKS,
      unlocks
    );
  }

  // ---------- 評価 ----------

  getRatings() {
    return this._read(
      STORAGE_KEYS.RATINGS,
      {}
    );
  }

  rateStage(
    stageId,
    stars
  ) {
    const ratings =
      this.getRatings();

    ratings[stageId] =
      ratings[stageId] || [];

    ratings[stageId].push(
      stars
    );

    this._write(
      STORAGE_KEYS.RATINGS,
      ratings
    );

    return this.getStageRatingAverage(
      stageId
    );
  }

  getStageRatingAverage(
    stageId
  ) {
    const arr =
      this.getRatings()[stageId] ||
      [];

    if (!arr.length) {
      return 0;
    }

    return (
      arr.reduce(
        (a, b) => a + b,
        0
      ) / arr.length
    );
  }

  // ---------- 通報 ----------

  getReports() {
    return this._read(
      STORAGE_KEYS.REPORTS,
      []
    );
  }

  reportStage(
    stageId,
    reason,
    note
  ) {
    const reports =
      this.getReports();

    reports.push({
      stageId,
      reason,
      note: note || '',
      at: Date.now()
    });

    this._write(
      STORAGE_KEYS.REPORTS,
      reports
    );
  }
}

export const saveManager =
  new SaveManager();
