const DEFAULT_KEYMAP = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];

/**
 * PCキーボード（D, F, J, K）をレーン入力へ変換する（仕様書#48）。
 */
export class KeyboardInput {
  /**
   * @param {(lane:number)=>void} onLaneDown
   * @param {(lane:number)=>void} onLaneUp
   * @param {string[]} [keymap]
   */
  constructor(onLaneDown, onLaneUp, keymap = DEFAULT_KEYMAP) {
    this.keymap = keymap;
    this.onLaneDown = onLaneDown;
    this.onLaneUp = onLaneUp;
    this._pressed = new Set();
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('keyup', this._handleKeyUp);
  }

  detach() {
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('keyup', this._handleKeyUp);
    this._pressed.clear();
  }

  _handleKeyDown(e) {
    const lane = this.keymap.indexOf(e.code);
    if (lane === -1) return;
    if (this._pressed.has(lane)) return; // オートリピート無効化
    this._pressed.add(lane);
    this.onLaneDown(lane, e.timeStamp);
  }

  _handleKeyUp(e) {
    const lane = this.keymap.indexOf(e.code);
    if (lane === -1) return;
    this._pressed.delete(lane);
    this.onLaneUp(lane, e.timeStamp);
  }
}
