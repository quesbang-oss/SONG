import { LANE_COUNT } from '../utils/constants.js';

/**
 * スマホのタッチ入力を、画面をLANE_COUNT分割したレーンへ変換する（仕様書#47）。
 * マルチタッチ（同時押し=CHAINノーツ対応）にも対応する。
 */
export class TouchInput {
  /**
   * @param {HTMLElement} targetEl
   * @param {(lane:number)=>void} onLaneDown
   * @param {(lane:number)=>void} onLaneUp
   */
  constructor(targetEl, onLaneDown, onLaneUp) {
    this.targetEl = targetEl;
    this.onLaneDown = onLaneDown;
    this.onLaneUp = onLaneUp;
    /** @type {Map<number, number>} touchId -> lane */
    this._activeTouches = new Map();
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
  }

  attach() {
    this.targetEl.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    this.targetEl.addEventListener('touchend', this._handleTouchEnd, { passive: false });
    this.targetEl.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    this.targetEl.addEventListener('touchcancel', this._handleTouchEnd, { passive: false });
  }

  detach() {
    this.targetEl.removeEventListener('touchstart', this._handleTouchStart);
    this.targetEl.removeEventListener('touchend', this._handleTouchEnd);
    this.targetEl.removeEventListener('touchmove', this._handleTouchMove);
    this.targetEl.removeEventListener('touchcancel', this._handleTouchEnd);
    this._activeTouches.clear();
  }

  _laneFromX(clientX) {
    const rect = this.targetEl.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(relX * LANE_COUNT)));
  }

  _handleTouchStart(e) {
    e.preventDefault();
    for (const touch of Array.from(e.changedTouches)) {
      const lane = this._laneFromX(touch.clientX);
      this._activeTouches.set(touch.identifier, lane);
      this.onLaneDown(lane);
    }
  }

  _handleTouchMove(e) {
    // スワイプで画面がスクロールしたり、ブラウザのジェスチャーが発生したりしないようにする。
    e.preventDefault();
  }

  _handleTouchEnd(e) {
    e.preventDefault();
    for (const touch of Array.from(e.changedTouches)) {
      const lane = this._activeTouches.get(touch.identifier);
      this._activeTouches.delete(touch.identifier);
      if (lane !== undefined) this.onLaneUp(lane);
    }
  }
}
