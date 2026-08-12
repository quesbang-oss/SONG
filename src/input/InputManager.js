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
      (lane) => this._emitDown(lane),
      (lane) => this._emitUp(lane)
    );
    this.touch = new TouchInput(
      touchTargetEl,
      (lane) => this._emitDown(lane),
      (lane) => this._emitUp(lane)
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

  _emitDown(rawLane) {
    bus.emit('input:lanedown', { lane: this._transformLane(rawLane), atSec: performance.now() / 1000 });
  }

  _emitUp(rawLane) {
    bus.emit('input:laneup', { lane: this._transformLane(rawLane), atSec: performance.now() / 1000 });
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
