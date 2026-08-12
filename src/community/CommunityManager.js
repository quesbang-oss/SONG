import { stageManager } from '../ugc/StageManager.js';
import { saveManager } from '../core/SaveManager.js';

/**
 * コミュニティ画面（仕様書#39〜#42）向けの検索・並び替えロジック。
 * 本プロジェクトはサーバーを持たないため、「コミュニティ」とは
 * 自分がインポート/公開した、端末上に存在するステージ群を指す。
 * 友達との共有はShare Code / URLを介して行う。
 */
export class CommunityManager {
  list({ category = 'NEW', keyword = '' } = {}) {
    let stages = stageManager.getCommunityStages();

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      stages = stages.filter((s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.song?.title || '').toLowerCase().includes(kw) ||
        (s.creator || '').toLowerCase().includes(kw)
      );
    }

    switch (category) {
      case 'NEW':
        return [...stages].sort((a, b) => b.createdAt - a.createdAt);
      case 'POPULAR':
        return [...stages].sort((a, b) => (b.plays || 0) - (a.plays || 0));
      case 'TRENDING':
        return [...stages].sort((a, b) => (b.plays || 0) + (b.clears || 0) * 2 - ((a.plays || 0) + (a.clears || 0) * 2));
      case 'HARD':
        return [...stages].sort((a, b) => this._clearRate(a) - this._clearRate(b));
      case 'BOSS':
        return stages.filter((s) => s.boss?.imageDataUrl);
      default:
        return stages;
    }
  }

  _clearRate(stage) {
    return stage.plays > 0 ? stage.clears / stage.plays : 1;
  }

  stats(stage) {
    return {
      plays: stage.plays || 0,
      clears: stage.clears || 0,
      clearRatePercent: stage.plays > 0 ? ((stage.clears || 0) / stage.plays) * 100 : 0,
      rating: saveManager.getStageRatingAverage(stage.id)
    };
  }
}

export const communityManager = new CommunityManager();
