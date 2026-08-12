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
  constructor(targetEl, onLaneDown, onLaneUp) {
    this.targetEl = targetEl;
    this.onLaneDown = onLaneDown;
    this.onLaneUp = onLaneUp;

    this._activeTouches =
      new Map();

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

    this.targetEl.style.touchAction =
      'none';
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

  _eventTimeMs(event) {
    const t =
      Number(event?.timeStamp);

    const now =
      performance.now();

    if (
      !Number.isFinite(t)
    ) {
      return now;
    }

    const diff =
      now - t;

    if (
      diff >= -50 &&
      diff <= 500
    ) {
      return t;
    }

    return now;
  }

  _laneFromX(clientX) {
    const rect =
      this.targetEl.getBoundingClientRect();

    if (rect.width <= 0) {
      return 0;
    }

    const relativeX =
      (clientX - rect.left) /
      rect.width;

    const clampedX =
      Math.max(
        0,
        Math.min(
          0.999999,
          relativeX
        )
      );

    return Math.floor(
      clampedX * LANE_COUNT
    );
  }

  _handleTouchStart(event) {
    event.preventDefault();

    const eventTimeMs =
      this._eventTimeMs(event);

    for (
      const touch of event.changedTouches
    ) {
      const lane =
        this._laneFromX(
          touch.clientX
        );

      if (
        this._activeTouches.has(
          touch.identifier
        )
      ) {
        continue;
      }

      this._activeTouches.set(
        touch.identifier,
        lane
      );

      this.onLaneDown(
        lane,
        eventTimeMs
      );
    }
  }

  _handleTouchMove(event) {
    event.preventDefault();
  }

  _handleTouchEnd(event) {
    event.preventDefault();

    const eventTimeMs =
      this._eventTimeMs(event);

    for (
      const touch of event.changedTouches
    ) {
      this._releaseTouch(
        touch.identifier,
        eventTimeMs
      );
    }
  }

  _handleTouchCancel(event) {
    event.preventDefault();

    const eventTimeMs =
      this._eventTimeMs(event);

    for (
      const touch of event.changedTouches
    ) {
      this._releaseTouch(
        touch.identifier,
        eventTimeMs
      );
    }
  }

  _releaseTouch(
    identifier,
    eventTimeMs
  ) {
    const lane =
      this._activeTouches.get(
        identifier
      );

    if (lane === undefined) {
      return;
    }

    this._activeTouches.delete(
      identifier
    );

    this.onLaneUp(
      lane,
      eventTimeMs
    );
  }
}
