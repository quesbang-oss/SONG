import './style.css';
import { UI } from './rendering/UI.js';
import { gameState } from './core/GameState.js';

/**
 * アプリケーションのブートストラップ。
 * UIマネージャを初期化し、MENU画面から開始する。
 */
function bootstrap() {
  window.addEventListener('error', (e) => {
    console.error('[YCSB] Uncaught error:', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[YCSB] Unhandled promise rejection:', e.reason);
  });

  const ui = new UI();
  window.__ycsbUI = ui; // デバッグ用
  gameState.goto('MENU');
}

bootstrap();
