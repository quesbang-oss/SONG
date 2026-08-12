/**
 * シンプルなPub/Subイベントバス。モジュール間の循環依存を避けるために使用する。
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe関数
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
  }

  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }
}

export const bus = new EventBus();
