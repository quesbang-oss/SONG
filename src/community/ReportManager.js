import { saveManager } from '../core/SaveManager.js';

/**
 * ステージ通報機能（仕様書#54）。サーバーを持たないため、通報は端末内に記録され、
 * 通報したステージはコミュニティ一覧から非表示にする自衛的な仕組みとして機能する。
 */
export const REPORT_REASONS = Object.freeze([
  { id: 'INAPPROPRIATE', label: 'Inappropriate' },
  { id: 'SPAM', label: 'Spam' },
  { id: 'BROKEN', label: 'Broken' },
  { id: 'COPYRIGHT', label: 'Copyright' },
  { id: 'OTHER', label: 'Other' }
]);

export class ReportManager {
  report(stageId, reasonId, note = '') {
    saveManager.reportStage(stageId, reasonId, note);
  }

  hasReported(stageId) {
    return saveManager.getReports().some((r) => r.stageId === stageId);
  }

  isHidden(stageId) {
    // 3件以上の通報でローカル表示から自動非表示にする簡易モデレーション
    return saveManager.getReports().filter((r) => r.stageId === stageId).length >= 3;
  }
}

export const reportManager = new ReportManager();
