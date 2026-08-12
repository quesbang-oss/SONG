import { saveManager } from '../core/SaveManager.js';

/**
 * ステージへの星評価（仕様書#41）を扱う。
 */
export class RatingManager {
  rate(stageId, stars) {
    const clamped = Math.max(1, Math.min(5, Math.round(stars)));
    return saveManager.rateStage(stageId, clamped);
  }

  getAverage(stageId) {
    return saveManager.getStageRatingAverage(stageId);
  }

  getCount(stageId) {
    return (saveManager.getRatings()[stageId] || []).length;
  }
}

export const ratingManager = new RatingManager();
