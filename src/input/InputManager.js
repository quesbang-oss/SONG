import { KeyboardInput } from './KeyboardInput.js';
import { TouchInput } from './TouchInput.js';
import { bus } from '../utils/EventBus.js';

/**
 * PC(キーボード)・スマホ(タッチ)の入力を統合し、共通の
 * 'input:lanedown' / 'input:laneup' イベントとして配信する（仕様書#47〜#48）。
 */
export class InputManager {
  /**
   * @param {HTMLElement} touchTargetEl
   * @param {string[]} [gimmicks] MIRROR等、レーン変換を伴うギミックID配列
   */
  constructor(touchTargetEl, gimmicks = []) {
    this.gimmicks = gimmicks;
    this.keyboard = new KeyboardInput(
      (lane, eventTimeMs) => this._emitDown(lane, eventTimeMs),
      (lane, eventTimeMs) => this._emitUp(lane, eventTimeMs)
    );
    this.touch = new TouchInput(
      touchTargetEl,
      (lane, eventTimeMs) => this._emitDown(lane, eventTimeMs),
      (lane, eventTimeMs) => this._emitUp(lane, eventTimeMs)
    );
  }

  _transformLane(lane) {
    if (this.gimmicks.includes('MIRROR')) {
      return 3 - lane;
    }
    if (this.gimmicks.includes('RANDOM_LANE')) {
      return Math.floor(Math.random() * 4);
    }
    return lane;
  }

  _normalizeEventTimeMs(eventTimeMs) {
    const t = Number(eventTimeMs);
    const now = performance.now();
    if (!Number.isFinite(t)) return now;
    const diff = now - t;
    return diff >= -50 && diff <= 500 ? t : now;
  }

  _emitDown(rawLane, eventTimeMs = performance.now()) {
    bus.emit('input:lanedown', {
      lane: this._transformLane(rawLane),
      eventTimeMs: this._normalizeEventTimeMs(eventTimeMs)
    });
  }

  _emitUp(rawLane, eventTimeMs = performance.now()) {
    bus.emit('input:laneup', {
      lane: this._transformLane(rawLane),
      eventTimeMs: this._normalizeEventTimeMs(eventTimeMs)
    });
  }

  attach() {
    this.keyboard.attach();
    this.touch.attach();
  }

  detach() {
    this.keyboard.detach();
    this.touch.detach();
  }
}
