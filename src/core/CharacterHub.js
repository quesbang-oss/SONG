import { bus } from '../utils/EventBus.js';
import { characterSystem } from './CharacterSystem.js';
import { gameState } from './GameState.js';

// ============================================================
// キャラクター画像
// src/assets から移動する必要はありません。
// Viteがビルド時に正しいURLへ変換します。
// ============================================================

import arukarasu from '../assets/arukarasu.png';
import datyou from '../assets/datyou.png';
import dossunmitta from '../assets/dossunmitta.jpg';
import kangaemitta from '../assets/kangaemitta.jpg';
import keikakudoori from '../assets/keikakudoori.jpg';
import kiokunasi from '../assets/kiokunasi.jpg';
import kureteyaru from '../assets/kureteyaru.jpg';
import mewotuketeru from '../assets/mewotuketeru.png';
import mittasan from '../assets/mittasan.jpg';

// characters.json に書かれているパスと
// Viteが解決した実際の画像URLを対応させる。
const CHARACTER_IMAGES = {
  './src/assets/arukarasu.png': arukarasu,
  './src/assets/datyou.png': datyou,
  './src/assets/dossunmitta.jpg': dossunmitta,
  './src/assets/kangaemitta.jpg': kangaemitta,
  './src/assets/keikakudoori.jpg': keikakudoori,
  './src/assets/kiokunasi.jpg': kiokunasi,
  './src/assets/kureteyaru.jpg': kureteyaru,
  './src/assets/mewotuketeru.png': mewotuketeru,
  './src/assets/mittasan.jpg': mittasan
};

const TYPE_LABEL = {
  HP: 'HP特化',
  ATTACK: '攻撃特化',
  SPECIAL: '特殊特化'
};

const TRIGGER_LABEL = {
  combo: (v) => `${v}コンボ達成で発動`,
  hits: (v) => `合計${v}回ノーツを叩くと発動`,
  perfect: (v) => `PERFECTを${v}回取ると発動`
};

function skillTriggerText(skill) {
  if (!skill?.trigger) {
    return 'スキルなし';
  }

  const fn = TRIGGER_LABEL[skill.trigger.type];

  return fn
    ? fn(skill.trigger.value)
    : '条件達成で発動';
}

export class CharacterHub {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'character-hub-root';

    document.body.appendChild(this.root);

    this.opened = false;

    this._installStyles();
    this._renderButton();

    bus.on(
      'screen:change',
      ({ screen }) => this._updateVisibility(screen)
    );

    bus.on(
      'character:changed',
      () => this._refreshModal()
    );

    bus.on(
      'currency:changed',
      () => this._refreshModal()
    );

    bus.on(
      'character:levelup',
      () => this._refreshModal()
    );

    bus.on(
      'gacha:result',
      () => this._refreshModal()
    );

    bus.on(
      'character:skill',
      ({ skill }) => this._showSkillNotification(skill)
    );

    this._updateVisibility(gameState.screen);
  }

  // ============================================================
  // スタイル
  // ============================================================

  _installStyles() {
    const style = document.createElement('style');

    style.textContent = `
      #character-hub-root {
        position: fixed;
        inset: 0;
        z-index: 10000;
        pointer-events: none;
        font-family: system-ui, sans-serif;
      }

      #character-hub-root .ch-btn {
        position: fixed;
        right: 20px;
        bottom: 78px;
        pointer-events: auto;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(12,10,22,.92);
        color: #fff;
        border-radius: 12px;
        padding: 10px 14px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        -webkit-tap-highlight-color: transparent;
      }

      #character-hub-root .ch-btn:active {
        transform: scale(.97);
      }

      #character-hub-root .ch-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        pointer-events: auto;
        box-sizing: border-box;
      }

      #character-hub-root .ch-panel {
        width: min(900px,96vw);
        max-height: 90vh;
        overflow: auto;
        background: #11101a;
        color: #f4f2ff;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,.55);
        padding: 18px;
        box-sizing: border-box;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      #character-hub-root .ch-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      #character-hub-root .ch-head h2 {
        margin: 0;
      }

      #character-hub-root .ch-close {
        border: 0;
        background: #29263a;
        color: #fff;
        border-radius: 10px;
        padding: 8px 12px;
        cursor: pointer;
      }

      #character-hub-root .ch-tabs {
        display: flex;
        gap: 8px;
        overflow: auto;
        margin-bottom: 12px;
        scrollbar-width: none;
      }

      #character-hub-root .ch-tabs::-webkit-scrollbar {
        display: none;
      }

      #character-hub-root .ch-tab {
        flex: 0 0 auto;
        border: 1px solid #343044;
        background: #1a1825;
        color: #ddd;
        border-radius: 9px;
        padding: 8px 12px;
        cursor: pointer;
      }

      #character-hub-root .ch-tab.active {
        background: #39314f;
        border-color: #7c63c7;
      }

      #character-hub-root .ch-grid {
        display: grid;
        grid-template-columns:
          repeat(auto-fit, minmax(190px, 1fr));
        gap: 10px;
      }

      #character-hub-root .ch-card {
        background: #191722;
        border: 1px solid #302d3d;
        border-radius: 14px;
        padding: 12px;
        box-sizing: border-box;
      }

      #character-hub-root .ch-card.selected {
        border-color: #a887ff;
        box-shadow: 0 0 0 1px #a887ff inset;
      }

      #character-hub-root .ch-img {
        height: 110px;
        border-radius: 10px;
        background: #252232;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 34px;
        margin-bottom: 9px;
        overflow: hidden;
      }

      #character-hub-root .ch-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      #character-hub-root .ch-locked {
        font-size: 42px;
        opacity: .75;
      }

      #character-hub-root .ch-rarity {
        font-weight: 900;
      }

      #character-hub-root .ch-meta {
        font-size: 12px;
        color: #aaa6b7;
        line-height: 1.5;
      }

      #character-hub-root .ch-skill {
        margin-top: 8px;
        padding: 9px;
        border-radius: 10px;
        background: #211d2d;
        border: 1px solid #39314f;
      }

      #character-hub-root .ch-skill-name {
        font-weight: 900;
        color: #d8caff;
      }

      #character-hub-root .ch-skill-trigger {
        margin-top: 3px;
        color: #c4b9d8;
        font-size: 12px;
      }

      #character-hub-root .ch-actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      #character-hub-root .ch-actions button,
      #character-hub-root .ch-bigbtn {
        border: 0;
        border-radius: 9px;
        padding: 8px 10px;
        background: #51416f;
        color: #fff;
        cursor: pointer;
        font-weight: 700;
      }

      #character-hub-root .ch-actions button:disabled,
      #character-hub-root .ch-bigbtn:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      #character-hub-root .ch-bigbtn {
        width: 100%;
        margin-top: 8px;
        padding: 12px;
      }

      #character-hub-root .ch-result {
        display: grid;
        grid-template-columns:
          repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      #character-hub-root .ch-result .ch-card {
        min-height: 120px;
      }

      #character-hub-root .ch-info {
        background: #171520;
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 12px;
      }

      #character-hub-root .ch-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin: 5px 0;
      }

      #character-hub-root .ch-muted {
        color: #aaa6b7;
        font-size: 12px;
      }

      #character-hub-root .ch-list {
        display: grid;
        gap: 8px;
      }

      #character-hub-root .ch-mission {
        background: #191722;
        border: 1px solid #302d3d;
        border-radius: 12px;
        padding: 11px;
      }

      #character-hub-root .ch-progress {
        height: 8px;
        background: #292635;
        border-radius: 99px;
        overflow: hidden;
        margin: 7px 0;
      }

      #character-hub-root .ch-progress > i {
        display: block;
        height: 100%;
        background: #9b7cff;
      }

      /* ========================================================
         スキル発動通知
         ======================================================== */

      #character-hub-root .ch-skill-notice {
        position: fixed;
        top: 13%;
        right: 22px;
        max-width: min(330px, calc(100vw - 44px));
        padding: 10px 15px;
        border-radius: 12px;
        background: rgba(16,13,26,.92);
        border: 1px solid rgba(168,135,255,.55);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        color: #fff;
        text-align: left;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-8px);
        animation: chSkillNotice 2.4s ease both;
      }

      #character-hub-root .ch-skill-notice .skill-label {
        font-size: 11px;
        color: #bca8ff;
        font-weight: 800;
        letter-spacing: .08em;
      }

      #character-hub-root .ch-skill-notice .skill-name {
        font-size: 18px;
        font-weight: 900;
        margin-top: 2px;
      }

      @keyframes chSkillNotice {
        0% {
          opacity: 0;
          transform: translateY(-8px);
        }

        15%, 75% {
          opacity: 1;
          transform: translateY(0);
        }

        100% {
          opacity: 0;
          transform: translateY(-4px);
        }
      }

      /* ========================================================
         トースト
         ======================================================== */

      #character-hub-root .ch-toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 10002;
        background: rgba(15,13,22,.95);
        color: #fff;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 10px;
        padding: 10px 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,.4);
        pointer-events: none;
        white-space: nowrap;
        max-width: calc(100vw - 30px);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @media (max-width: 600px) {
        #character-hub-root .ch-btn {
          right: 12px;
          bottom: 76px;
        }

        #character-hub-root .ch-panel {
          padding: 12px;
          max-height: 94vh;
          width: 98vw;
        }

        #character-hub-root .ch-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        #character-hub-root .ch-card {
          padding: 9px;
        }

        #character-hub-root .ch-img {
          height: 80px;
        }

        #character-hub-root .ch-skill-notice {
          top: 10%;
          right: 10px;
          max-width: calc(100vw - 20px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // キャラクターボタン
  // ============================================================

  _renderButton() {
    this.button = document.createElement('button');

    this.button.className = 'ch-btn';
    this.button.textContent = '👤 キャラクター';

    this.button.onclick = () => this.open();

    this.root.appendChild(this.button);
  }

  _updateVisibility(screen) {
    if (!this.button) {
      return;
    }

    this.button.style.display =
      screen === 'PLAYING'
        ? 'none'
        : '';
  }

  // ============================================================
  // モーダル
  // ============================================================

  open() {
    if (this.opened) {
      return;
    }

    this.opened = true;
    this._renderModal('characters');
  }

  close() {
    this.opened = false;

    this.root
      .querySelector('.ch-overlay')
      ?.remove();
  }

  _refreshModal() {
    if (!this.opened) {
      return;
    }

    const active =
      this.root
        .querySelector('.ch-tab.active')
        ?.dataset.tab ||
      'characters';

    this._renderModal(active);
  }

  _renderModal(tab) {
    this.root
      .querySelector('.ch-overlay')
      ?.remove();

    const overlay =
      document.createElement('div');

    overlay.className = 'ch-overlay';

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.close();
      }
    };

    const panel =
      document.createElement('div');

    panel.className = 'ch-panel';

    const head =
      document.createElement('div');

    head.className = 'ch-head';

    head.innerHTML = `
      <h2>キャラクター</h2>
      <button class="ch-close">閉じる</button>
    `;

    head
      .querySelector('.ch-close')
      .onclick = () => this.close();

    panel.appendChild(head);

    const tabs =
      document.createElement('div');

    tabs.className = 'ch-tabs';

    [
      ['characters', 'キャラクター'],
      ['gacha', 'ガチャ'],
      ['missions', '報酬・ミッション']
    ].forEach(([id, label]) => {
      const button =
        document.createElement('button');

      button.className =
        `ch-tab ${tab === id ? 'active' : ''}`;

      button.dataset.tab = id;
      button.textContent = label;

      button.onclick = () =>
        this._renderModal(id);

      tabs.appendChild(button);
    });

    panel.appendChild(tabs);

    const body =
      document.createElement('div');

    if (tab === 'characters') {
      this._renderCharacters(body);
    } else if (tab === 'gacha') {
      this._renderGacha(body);
    } else {
      this._renderMissions(body);
    }

    panel.appendChild(body);
    overlay.appendChild(panel);
    this.root.appendChild(overlay);
  }

  // ============================================================
  // キャラクター一覧
  // ============================================================

  _renderCharacters(body) {
    const s =
      characterSystem.getSummary();

    const info =
      document.createElement('div');

    info.className = 'ch-info';

    info.innerHTML = `
      <div class="ch-row">
        <b>ガチャ石</b>
        <b>💎 ${s.currency}</b>
      </div>

      <div class="ch-row">
        <span>選択中</span>
        <span>
          ${this._escape(s.selected.name)}
          / Lv.${s.progress.level}
        </span>
      </div>
    `;

    body.appendChild(info);

    const grid =
      document.createElement('div');

    grid.className = 'ch-grid';

    for (const row of s.characters) {
      const c = row.character;
      const p = row.progress;
      const owned = Boolean(row.owned);

      const card =
        document.createElement('div');

      card.className =
        `ch-card ${
          s.selected.id === c.id
            ? 'selected'
            : ''
        }`;

      // ========================================================
      // 画像
      // 未開放なら画像URL自体を使用しない。
      // ========================================================

      const imageUrl =
        owned && c.image
          ? CHARACTER_IMAGES[c.image] || null
          : null;

      const img = imageUrl
        ? `
          <img
            src="${this._escapeAttribute(imageUrl)}"
            alt="${this._escapeAttribute(c.name)}"
            loading="lazy"
            decoding="async"
          >
        `
        : `
          <div class="ch-locked">
            🔒
          </div>
        `;

      // 未開放キャラは名前も隠す
      const name =
        owned
          ? c.name
          : '？？？？？？';

      // スキル情報
      const skillHtml = c.skill
        ? `
          <div class="ch-skill">
            <div class="ch-skill-name">
              スキル：
              ${this._escape(c.skill.name)}
            </div>

            <div class="ch-skill-trigger">
              発動条件：
              ${this._escape(
                skillTriggerText(c.skill)
              )}
            </div>
          </div>
        `
        : `
          <div class="ch-skill">
            <div class="ch-skill-trigger">
              スキル：なし
            </div>
          </div>
        `;

      card.innerHTML = `
        <div class="ch-img">
          ${img}
        </div>

        <div class="ch-rarity">
          ${'★'.repeat(c.rarity)}
         　
          ${this._escape(name)}
        </div>

        <div class="ch-meta">
          ${this._escape(
            TYPE_LABEL[c.type] || c.type
          )}

          <br>

          HP ${c.baseHp}
          /
          攻撃 ${Math.round(
            c.attackMultiplier * 100
          )}%

          <br>

          ${
            owned
              ? this._escape(c.description)
              : '未開放：キャラクターを開放すると詳細が表示されます'
          }

          <br>

          ${
            p
              ? `Lv.${p.level} / 凸${p.breakthrough} / 所持 ${p.owned}`
              : '未所持'
          }
        </div>

        ${skillHtml}
      `;

      const actions =
        document.createElement('div');

      actions.className = 'ch-actions';

      if (owned) {
        const button =
          document.createElement('button');

        button.textContent =
          s.selected.id === c.id
            ? '選択中'
            : '選択';

        button.disabled =
          s.selected.id === c.id;

        button.onclick = () => {
          characterSystem.selectCharacter(c.id);
        };

        actions.appendChild(button);
      }

      card.appendChild(actions);
      grid.appendChild(card);
    }

    body.appendChild(grid);
  }

  // ============================================================
  // ガチャ
  // ============================================================

  _renderGacha(body) {
    const s =
      characterSystem.getSummary();

    const info =
      document.createElement('div');

    info.className = 'ch-info';

    info.innerHTML = `
      <div class="ch-row">
        <b>所持ガチャ石</b>
        <b>💎 ${s.currency}</b>
      </div>

      <div class="ch-muted">
        1回 ${s.singleCost}
        /
        10回 ${s.tenCost}
        （無料入手のみ）
      </div>

      <div class="ch-muted">
        ★5 3%
        /
        ★4 10%
        /
        ★3 27%
        /
        ★2 35%
        /
        ★1 25%
      </div>
    `;

    body.appendChild(info);

    const one =
      document.createElement('button');

    one.className = 'ch-bigbtn';
    one.textContent = '🎲 1回引く（100）';

    one.onclick = () =>
      this._pull(1);

    body.appendChild(one);

    const ten =
      document.createElement('button');

    ten.className = 'ch-bigbtn';
    ten.textContent = '🎲 10回引く（900）';

    ten.onclick = () =>
      this._pull(10);

    body.appendChild(ten);
  }

  _pull(count) {
    try {
      const results =
        characterSystem.pull(count);

      this._showGachaResults(results);
    } catch (e) {
      this._showToast(
        e?.message ||
        'ガチャに失敗しました'
      );
    }
  }

  _showGachaResults(results) {
    const panel =
      this.root.querySelector('.ch-panel');

    if (!panel) {
      return;
    }

    const old =
      panel.querySelector('.ch-result');

    old?.remove();

    const grid =
      document.createElement('div');

    grid.className = 'ch-result';

    for (const r of results) {
      const card =
        document.createElement('div');

      card.className = 'ch-card';

      card.innerHTML = `
        <div class="ch-rarity">
          ${'★'.repeat(r.character.rarity)}
        </div>

        <b>
          ${this._escape(r.character.name)}
        </b>

        <div class="ch-meta">
          ${this._escape(
            TYPE_LABEL[r.character.type]
              || r.character.type
          )}

          <br>

          ${
            r.duplicate
              ? '重複：EXP +120 / 限界突破 +1'
              : '新規獲得'
          }
        </div>
      `;

      grid.appendChild(card);
    }

    panel.appendChild(grid);
  }

  // ============================================================
  // ミッション
  // ============================================================

  _renderMissions(body) {
    const s =
      characterSystem.getSummary();

    const addMission = (
      title,
      progress,
      max,
      claimed,
      claim
    ) => {
      const node =
        document.createElement('div');

      node.className = 'ch-mission';

      const percent =
        max > 0
          ? Math.min(
              100,
              (progress / max) * 100
            )
          : 0;

      node.innerHTML = `
        <b>
          ${this._escape(title)}
        </b>

        <div class="ch-progress">
          <i
            style="width:${percent}%"
          ></i>
        </div>

        <div class="ch-row">
          <span>
            ${progress} / ${max}
          </span>

          <button
            class="ch-mission-claim"
            ${claimed || progress < max
              ? 'disabled'
              : ''}
          >
            ${
              claimed
                ? '受取済み'
                : '受け取る'
            }
          </button>
        </div>
      `;

      const button =
        node.querySelector(
          '.ch-mission-claim'
        );

      button.onclick = () => {
        try {
          claim();
          this._refreshModal();
        } catch (e) {
          this._showToast(
            e?.message ||
            '報酬の受け取りに失敗しました'
          );
        }
      };

      body.appendChild(node);
    };

    addMission(
      'デイリー：曲を3回クリア',
      s.missions.daily.progress,
      3,
      s.missions.daily.claimed,
      () => characterSystem.claimDaily()
    );

    addMission(
      'ウィークリー：曲を10回クリア',
      s.missions.weekly.progress,
      10,
      s.missions.weekly.claimed,
      () => characterSystem.claimWeekly()
    );

    addMission(
      'イベント：曲を7回クリア',
      s.missions.event.progress,
      7,
      s.missions.event.claimed,
      () => characterSystem.claimEvent()
    );

    const login =
      document.createElement('div');

    login.className = 'ch-mission';

    login.innerHTML = `
      <b>ログインボーナス</b>

      <div class="ch-muted">
        連続ログイン
        ${s.login.streak}日
      </div>

      <button
        class="ch-bigbtn"
        ${
          s.login.claimedToday
            ? 'disabled'
            : ''
        }
      >
        ${
          s.login.claimedToday
            ? '本日受取済み'
            : '今日の報酬を受け取る'
        }
      </button>
    `;

    login.querySelector(
      '.ch-bigbtn'
    ).onclick = () => {
      try {
        characterSystem.claimLogin();
        this._refreshModal();
      } catch (e) {
        this._showToast(
          e?.message ||
          'ログイン報酬の受け取りに失敗しました'
        );
      }
    };

    body.appendChild(login);
  }

  // ============================================================
  // スキル発動通知
  // ============================================================

  _showSkillNotification(skill) {
    this.root
      .querySelector('.ch-skill-notice')
      ?.remove();

    if (!skill?.name) {
      return;
    }

    const notice =
      document.createElement('div');

    notice.className =
      'ch-skill-notice';

    notice.innerHTML = `
      <div class="skill-label">
        SKILL ACTIVATED
      </div>

      <div class="skill-name">
        ${this._escape(skill.name)}
      </div>
    `;

    this.root.appendChild(notice);

    window.setTimeout(() => {
      notice.remove();
    }, 2500);
  }

  // ============================================================
  // トースト
  // ============================================================

  _showToast(message) {
    this.root
      .querySelector('.ch-toast')
      ?.remove();

    const toast =
      document.createElement('div');

    toast.className = 'ch-toast';
    toast.textContent = String(message);

    this.root.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2200);
  }

  // ============================================================
  // HTMLエスケープ
  // ============================================================

  _escape(value) {
    const div =
      document.createElement('div');

    div.textContent =
      String(value);

    return div.innerHTML;
  }

  // 属性値用エスケープ
  _escapeAttribute(value) {
    return this._escape(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
