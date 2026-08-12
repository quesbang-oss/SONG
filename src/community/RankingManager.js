import { saveManager } from '../core/SaveManager.js';

/**
 * ステージごとのランキング（WORLD RECORD相当）とゴーストデータを扱う（仕様書#42, #45）。
 * サーバーを持たないため、ここでの「ランキング」は端末内に記録された
 * 自己ベスト履歴（インポートしたゴーストを含む）として機能する。
 */
export class RankingManager {
  getLeaderboard(stageId) {
    return saveManager.getStageScores(stageId);
  }

  submitScore(stageId, { playerName, score, accuracy, maxCombo, grade, ghost = null }) {
    return saveManager.recordScore(stageId, {
      playerName: playerName || 'YOU',
      score,
      accuracy: Number(accuracy.toFixed(2)),
      maxCombo,
      grade,
      ghost,
      at: Date.now()
    });
  }

  getBestGhost(stageId) {
    const best = saveManager.getStageBest(stageId);
    return best?.ghost || null;
  }
}

export const rankingManager = new RankingManager();
