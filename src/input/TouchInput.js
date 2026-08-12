import { LANE_COUNT } from '../utils/constants.js';

/**
 * スマホのタッチ入力を4レーンへ変換する。
 *
 * 画面を横方向に LANE_COUNT 分割し、
 * タップした位置からレーンを判定する。
 *
 * 対応:
 * - 通常タップ
 * - 長押し
 * - マルチタッチ
 * - タッチキャンセル
 * - スワイプによるブラウザ操作の防止
 */
export class TouchInput {
  /**
   * @param {HTMLElement} targetEl
   * @param {(lane: number) => void} onLaneDown
   * @param {(lane: number) => void} onLaneUp
   */
  constructor(targetEl, onLaneDown, onLaneUp) {
    this.targetEl = targetEl;
    this.onLaneDown = onLaneDown;
    this.onLaneUp = onLaneUp;

    /**
     * touch.identifier -> lane
     * @type {Map<number, number>}
     */
    this._activeTouches = new Map();

    this._handleTouchStart =
      this._handleTouchStart.bind(this);

    this._handleTouchEnd =
      this._handleTouchEnd.bind(this);

    this._handleTouchMove =
      this._handleTouchMove.bind(this);

    this._handleTouchCancel =
      this._handleTouchCancel.bind(this);
  }

  attach() {
    this.targetEl.addEventListener(
      'touchstart',
      this._handleTouchStart,
      { passive: false }
    );

    this.targetEl.addEventListener(
      'touchend',
      this._handleTouchEnd,
      { passive: false }
    );

    this.targetEl.addEventListener(
      'touchmove',
      this._handleTouchMove,
      { passive: false }
    );

    this.targetEl.addEventListener(
      'touchcancel',
      this._handleTouchCancel,
      { passive: false }
    );

    // ブラウザのジェスチャーを防止
    this.targetEl.style.touchAction = 'none';
  }

  detach() {
    this.targetEl.removeEventListener(
      'touchstart',
      this._handleTouchStart
    );

    this.targetEl.removeEventListener(
      'touchend',
      this._handleTouchEnd
    );

    this.targetEl.removeEventListener(
      'touchmove',
      this._handleTouchMove
    );

    this.targetEl.removeEventListener(
      'touchcancel',
      this._handleTouchCancel
    );

    this._activeTouches.clear();
  }

  /**
   * ブラウザ差異を吸収して、performance.now() と同じ時間軸の
   * イベント時刻を返す。異なる時間軸なら現在時刻へフォールバック。
   */
  _eventTimeMs(event) {
    const t = Number(event?.timeStamp);
    const now = performance.now();
    if (!Number.isFinite(t)) return now;
    const diff = now - t;
    // 同一timeOriginなら0〜500ms程度の遅延になる。
    if (diff >= -50 && diff <= 500) return t;
    return now;
  }

  /**
   * タップ位置からレーン番号を取得。
   *
   * 画面全体を横方向に LANE_COUNT 分割する。
   *
   * 例: 4レーン
   *
   * | 0 | 1 | 2 | 3 |
   */
  _laneFromX(clientX) {
    const rect =
      this.targetEl.getBoundingClientRect();

    if (rect.width <= 0) {
      return 0;
    }

    const relativeX =
      (clientX - rect.left) / rect.width;

    const clampedX =
      Math.max(0, Math.min(0.999999, relativeX));

    return Math.floor(
      clampedX * LANE_COUNT
    );
  }

  /**
   * タッチ開始
   */
  _handleTouchStart(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      const lane =
        this._laneFromX(touch.clientX);

      // 同じタッチIDがすでに存在する場合は無視
      if (this._activeTouches.has(touch.identifier)) {
        continue;
      }

      this._activeTouches.set(
        touch.identifier,
        lane
      );

      // ノーツ判定開始
      this.onLaneDown(lane, this._eventTimeMs(event));
    }
  }

  /**
   * タッチ中
   *
   * 長押しノーツでは指を動かしても
   * 「離した」と判定しない。
   *
   * そのため laneUp はここでは呼ばない。
   */
  _handleTouchMove(event) {
    event.preventDefault();
  }

  /**
   * タッチ終了
   */
  _handleTouchEnd(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      this._releaseTouch(touch.identifier);
    }
  }

  /**
   * タッチキャンセル
   */
  _handleTouchCancel(event) {
    event.preventDefault();

    for (const touch of event.changedTouches) {
      this._releaseTouch(touch.identifier);
    }
  }

  /**
   * 指を離したときの共通処理
   */
  _releaseTouch(identifier) {
    const lane =
      this._activeTouches.get(identifier);

    if (lane === undefined) {
      return;
    }

    this._activeTouches.delete(identifier);

    // 長押し終了 / 通常ノーツ終了
    this.onLaneUp(lane, this._eventTimeMs(event));
  }
}
