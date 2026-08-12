import { saveManager } from '../core/SaveManager.js';
import { AudioCache } from '../core/AudioCache.js';
import { StageValidator } from './StageValidator.js';
import { StagePublisher } from './StagePublisher.js';
import { StageVersionManager } from './StageVersionManager.js';
import { generateId } from '../utils/helpers.js';

/**
 * ステージ（曲＋譜面＋ボス＋ルール）の作成・保存・公開・インポートを統括するクラス。
 * 実データは全てSaveManagerを介してlocalStorageへ保存される。
 */
export class StageManager {
  /**
   * 新規ステージの下書きを作成する。
   */
  createDraft({ name, song, beatmapJson, boss, rules = {}, difficulty = 'NORMAL', creator = 'YOU' }) {
    return {
      id: generateId('stage'),
      version: StageVersionManager.initial(),
      name,
      song,
      beatmap: beatmapJson,
      boss,
      rules,
      difficulty,
      creator,
      visibility: 'PRIVATE',
      shareCode: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plays: 0,
      clears: 0
    };
  }

  saveDraft(stage) {
    stage.updatedAt = Date.now();
    saveManager.saveStage(stage);
    return stage;
  }

  getMyStages() {
    return saveManager.getStages().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getStage(stageId) {
    return saveManager.getStageById(stageId) || saveManager.getCommunityStages().find((s) => s.id === stageId) || null;
  }

  deleteStage(stageId) {
    saveManager.deleteStage(stageId);
    AudioCache.delete(stageId);
  }

  /**
   * ステージを検証し、問題なければ PUBLIC にしてコミュニティへ公開する。
   * @param {Object} stage
   * @returns {{ success: boolean, errors?: string[], stage?: Object }}
   */
  publish(stage) {
    const { valid, errors } = StageValidator.validate(stage);
    if (!valid) return { success: false, errors };

    stage.visibility = 'PUBLIC';
    stage.version = stage.shareCode ? StageVersionManager.bumpMinor(stage.version) : stage.version;
    StagePublisher.ensureShareCode(stage);
    stage.updatedAt = Date.now();

    saveManager.saveStage(stage);
    saveManager.publishToCommunity(stage);
    return { success: true, stage };
  }

  setPrivate(stage) {
    stage.visibility = 'PRIVATE';
    stage.updatedAt = Date.now();
    saveManager.saveStage(stage);
    saveManager.removeFromCommunity(stage.id);
    return stage;
  }

  getCommunityStages() {
    return saveManager.getCommunityStages();
  }

  /**
   * ステージ共有コードから対象を探す（コミュニティ or 自分のステージ）。
   * @param {string} code
   */
  findByShareCode(code) {
    const normalized = code.trim().toUpperCase();
    const all = [...saveManager.getCommunityStages(), ...saveManager.getStages()];
    return all.find((s) => s.shareCode === normalized) || null;
  }

  /**
   * URLやコードから受け取ったステージデータをローカルへインポートする（複製として保存）。
   * @param {Object} rawStageData StagePublisher.decodeShareableの戻り値
   */
  importShared(rawStageData) {
    const stage = {
      id: generateId('stage'),
      version: rawStageData.v || '1.0',
      name: rawStageData.name,
      song: rawStageData.song,
      beatmap: rawStageData.beatmap,
      boss: rawStageData.boss,
      rules: rawStageData.rules || {},
      difficulty: rawStageData.difficulty || 'NORMAL',
      creator: rawStageData.creator || '???',
      visibility: 'PUBLIC',
      shareCode: rawStageData.shareCode || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plays: 0,
      clears: 0,
      imported: true
    };
    saveManager.publishToCommunity(stage);
    return stage;
  }

  recordPlay(stageId, cleared) {
    const stage = this.getStage(stageId);
    if (!stage) return;
    stage.plays = (stage.plays || 0) + 1;
    if (cleared) stage.clears = (stage.clears || 0) + 1;
    saveManager.saveStage(stage);
    if (stage.visibility === 'PUBLIC') saveManager.publishToCommunity(stage);
  }

  get clearRatePercent() {
    return (stage) => (stage.plays > 0 ? (stage.clears / stage.plays) * 100 : 0);
  }
}

export const stageManager = new StageManager();
