import { bus } from '../utils/EventBus.js';

/**
 * 画面遷移および一時的なランタイム状態を保持するクラス。
 * 永続データはSaveManagerが担当し、GameStateは「今何をしているか」に専念する。
 */
export class GameState {
  constructor() {
    this.screen = 'MENU';
    this.screenParams = {};
    /** 編集中のステージ（下書き） */
    this.draftStage = null;
  }

  /**
   * @param {string} screen
   * @param {Object} [params]
   */
  goto(screen, params = {}) {
    this.screen = screen;
    this.screenParams = params;
    bus.emit('screen:change', { screen, params });
  }
}

export const gameState = new GameState();
