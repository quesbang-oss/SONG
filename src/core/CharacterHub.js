import { bus } from '../utils/EventBus.js';
import { characterSystem } from './CharacterSystem.js';
import { gameState } from './GameState.js';

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

/**
 * Vite の base: './' に対応したアセットURLを生成する。
 *
 * JSON側には例えば
 *   "./assets/arukarasu.png"
 * のようなパスを保存しておく。
 *
 * Viteの公開ルートを基準にして解決するため、
 * 開発環境・build後の相対配置の両方で使用できる。
 */
function resolveAssetUrl(assetPath) {
  if (!assetPath) {
    return '';
  }

  const value = String(assetPath).trim();

  if (!value) {
    return '';
  }

  // data URL / blob URL / 完全なURLはそのまま使用
  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }

  /*
   * Viteのimport.meta.env.BASE_URLを使用する。
   *
   * base: './' の場合、
   * BASE_URL は "./"。
   *
   * JSONに "./assets/xxx.png" が入っている場合、
   * そのまま "./assets/xxx.png" として解決する。
   */
  const base =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : './';

  let cleanPath = value.replace(/^\.?\//, '');

  let cleanBase = String(base);

  if (!cleanBase.endsWith('/')) {
    cleanBase += '/';
  }

  /*
   * baseが "./" の場合:
   *   ./ + assets/xxx.png
   *
   * baseが "/GAME/" 等の場合:
   *   /GAME/ + assets/xxx.png
   */
  return `${cleanBase}${cleanPath}`;
}

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
      ({ screen }) => {
        this._updateVisibility(screen);
      }
    );

    bus.on(
      'character:changed',
      () => {
        this._refreshModal();
      }
    );

    bus.on(
      'currency:changed',
      () => {
        this._refreshModal();
      }
    );

    bus.on(
      'character:levelup',
      () => {
        this._refreshModal();
      }
    );

    bus.on(
      'gacha:result',
      () => {
        this._refreshModal();
      }
    );

    bus.on(
      'character:skill',
      ({ skill }) => {
        this._showSkillNotification(skill);
      }
    );

    this._updateVisibility(gameState.screen);
  }

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
      }

      #character-hub-root .ch-btn:hover {
        background: rgba(30,25,48,.96);
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
      }

      #character-hub-root .ch-tab {
        border: 1px solid #343044;
        background: #1a1825;
        color: #ddd;
        border-radius: 9px;
        padding: 8px 12px;
        cursor: pointer;
        white-space: nowrap;
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
      }

      #character-hub-root .ch-card.selected {
        border-color: #a887ff;
        box-shadow:
          0 0 0 1px #a887ff inset;
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
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
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

      #character-hub-root .ch-actions button:hover,
      #character-hub-root .ch-bigbtn:hover {
        background: #645080;
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

      /*
       * スキル発動通知
       * ゲーム画面中央を避け、右上に表示する。
       */
      #character-hub-root .ch-skill-notice {
        position: fixed;
        top: 13%;
        right: 22px;
        z-index: 10001;
        max-width:
          min(330px, calc(100vw - 44px));
        padding: 10px 15px;
        border-radius: 12px;
        background: rgba(16,13,26,.92);
        border: 1px solid rgba(168,135,255,.55);
        box-shadow:
          0 10px 30px rgba(0,0,0,.35);
        color: #fff;
        text-align: left;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-8px);
        animation:
          chSkillNotice 2.4s ease both;
      }

      #character-hub-root
      .ch-skill-notice .skill-label {
        font-size: 11px;
        color: #bca8ff;
        font-weight: 800;
        letter-spacing: .08em;
      }

      #character-hub-root
      .ch-skill-notice .skill-name {
        font-size: 18px;
        font-weight: 900;
        margin-top: 2px;
      }

      @keyframes chSkillNotice {
        0% {
          opacity: 0;
          transform: translateY(-8px);
        }

        15%,
        75% {
          opacity: 1;
          transform: translateY(0);
        }

        100% {
          opacity: 0;
          transform: translateY(-4px);
        }
      }

      #character-hub-root .ch-toast {
        position: fixed;
        left: 50%;
        bottom: 30px;
        transform: translateX(-50%);
        z-index: 10002;
        background: rgba(16,13,26,.95);
        color: #fff;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 10px;
        padding: 10px 16px;
        box-shadow: 0 8px 25px rgba(0,0,0,.4);
        pointer-events: none;
      }

      @media(max-width:600px) {
        #character-hub-root .ch-btn {
          right: 12px;
          bottom: 76px;
        }

        #character-hub-root .ch-panel {
          padding: 12px !important;
        }

        #character-hub-root .ch-grid {
          grid-template-columns:
            repeat(2, minmax(0,1fr)) !important;
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
          max-width:
            calc(100vw - 20px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  _renderButton() {
    this.button = document.createElement('button');

    this.button.className = 'ch-btn';
    this.button.textContent = '👤 キャラクター';

    this.button.onclick = () => {
      this.open();
    };

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

    overlay.onclick = (event) => {
      if (event.target === overlay) {
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
      .onclick = () => {
        this.close();
      };

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

      button.onclick = () => {
        this._renderModal(id);
      };

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

  _renderCharacters(body) {
    const summary =
      characterSystem.getSummary();

    const info =
      document.createElement('div');

    info.className = 'ch-info';

    info.innerHTML = `
      <div class="ch-row">
        <b>ガチャ石</b>
        <b>💎 ${summary.currency}</b>
      </div>

      <div class="ch-row">
        <span>選択中</span>
        <span>
          ${this._escape(summary.selected.name)}
          / Lv.${summary.progress.level}
        </span>
      </div>
    `;

    body.appendChild(info);

    const grid =
      document.createElement('div');

    grid.className = 'ch-grid';

    for (const row of summary.characters) {
      const character = row.character;
      const progress = row.progress;
      const owned = Boolean(row.owned);

      const card =
        document.createElement('div');

      card.className =
        `ch-card ${
          summary.selected.id === character.id
            ? 'selected'
            : ''
        }`;

      /*
       * 未開放の場合は絶対にキャラクター画像を
       * DOMへ入れない。
       *
       * これにより「未開放なのに画像だけ見える」
       * 状態を防ぐ。
       */
      if (owned && character.image) {
        const image =
          document.createElement('img');

        image.src =
          resolveAssetUrl(character.image);

        image.alt =
          character.name;

        image.loading = 'lazy';
        image.draggable = false;

        /*
         * 画像が存在しない場合も
         * 404画像をそのまま表示せず、
         * プレースホルダーへ切り替える。
         */
        image.onerror = () => {
          image.replaceWith(
            this._createImageFallback(
              character.name
            )
          );
        };

        const imageBox =
          document.createElement('div');

        imageBox.className = 'ch-img';

        imageBox.appendChild(image);
        card.appendChild(imageBox);
      } else {
        const imageBox =
          document.createElement('div');

        imageBox.className = 'ch-img';

        const locked =
          document.createElement('div');

        locked.className = 'ch-locked';
        locked.textContent = '🔒';

        imageBox.appendChild(locked);
        card.appendChild(imageBox);
      }

      const rarity =
        document.createElement('div');

      rarity.className = 'ch-rarity';

      rarity.textContent =
        `${'★'.repeat(character.rarity)}　${
          owned
            ? character.name
            : '？？？？？？'
        }`;

      card.appendChild(rarity);

      const meta =
        document.createElement('div');

      meta.className = 'ch-meta';

      const description =
        owned
          ? character.description
          : '未開放：キャラクターを開放すると詳細が表示されます';

      meta.innerHTML = `
        ${this._escape(
          TYPE_LABEL[character.type] ||
          character.type
        )}
        <br>
        HP ${character.baseHp}
        /
        攻撃 ${Math.round(
          character.attackMultiplier * 100
        )}%
        <br>
        ${this._escape(description)}
        <br>
        ${
          progress
            ? `Lv.${progress.level}
               / 凸${progress.breakthrough}
               / 所持 ${progress.owned}`
            : '未所持'
        }
      `;

      card.appendChild(meta);

      /*
       * スキル情報はキャラクター画面で確認可能。
       *
       * 「未開放でもスキル条件だけ見える」
       * 仕様を維持。
       */
      const skillBox =
        document.createElement('div');

      skillBox.className = 'ch-skill';

      if (character.skill) {
        const skillName =
          document.createElement('div');

        skillName.className =
          'ch-skill-name';

        skillName.textContent =
          `スキル：${character.skill.name}`;

        const trigger =
          document.createElement('div');

        trigger.className =
          'ch-skill-trigger';

        trigger.textContent =
          `発動条件：${
            skillTriggerText(character.skill)
          }`;

        skillBox.appendChild(skillName);
        skillBox.appendChild(trigger);
      } else {
        const noSkill =
          document.createElement('div');

        noSkill.className =
          'ch-skill-trigger';

        noSkill.textContent =
          'スキル：なし';

        skillBox.appendChild(noSkill);
      }

      card.appendChild(skillBox);

      const actions =
        document.createElement('div');

      actions.className =
        'ch-actions';

      if (owned) {
        const selectButton =
          document.createElement('button');

        selectButton.textContent =
          summary.selected.id === character.id
            ? '選択中'
            : '選択';

        selectButton.disabled =
          summary.selected.id === character.id;

        selectButton.onclick = () => {
          characterSystem.selectCharacter(
            character.id
          );
        };

        actions.appendChild(selectButton);
      }

      card.appendChild(actions);

      grid.appendChild(card);
    }

    body.appendChild(grid);
  }

  _createImageFallback(name) {
    const fallback =
      document.createElement('div');

    fallback.className =
      'ch-locked';

    fallback.textContent = '🖼️';

    fallback.title =
      `${name} の画像を読み込めませんでした`;

    return fallback;
  }

  _renderGacha(body) {
    const summary =
      characterSystem.getSummary();

    const info =
      document.createElement('div');

    info.className = 'ch-info';

    info.innerHTML = `
      <div class="ch-row">
        <b>所持ガチャ石</b>
        <b>💎 ${summary.currency}</b>
      </div>

      <div class="ch-muted">
        1回 ${summary.singleCost}
        /
        10回 ${summary.tenCost}
        （無料入手のみ）
      </div>

      <div class="ch-muted">
        ★5 3% / ★4 10% / ★3 27%
        / ★2 35% / ★1 25%
      </div>
    `;

    body.appendChild(info);

    const one =
      document.createElement('button');

    one.className = 'ch-bigbtn';
    one.textContent =
      '🎲 1回引く（100）';

    one.onclick = () => {
      this._pull(1);
    };

    body.appendChild(one);

    const ten =
      document.createElement('button');

    ten.className = 'ch-bigbtn';
    ten.textContent =
      '🎲 10回引く（900）';

    ten.onclick = () => {
      this._pull(10);
    };

    body.appendChild(ten);
  }

  _pull(count) {
    try {
      const results =
        characterSystem.pull(count);

      this._showGachaResults(results);
    } catch (error) {
      this._showToast(
        error?.message ||
        'ガチャに失敗しました。'
      );
    }
  }

  _showGachaResults(results) {
    const panel =
      this.root.querySelector('.ch-panel');

    if (!panel) {
      return;
    }

    panel
      .querySelector('.ch-result')
      ?.remove();

    const grid =
      document.createElement('div');

    grid.className = 'ch-result';

    for (const result of results) {
      const card =
        document.createElement('div');

      card.className = 'ch-card';

      const rarity =
        document.createElement('div');

      rarity.className = 'ch-rarity';

      rarity.textContent =
        '★'.repeat(
          result.character.rarity
        );

      const name =
        document.createElement('b');

      name.textContent =
        result.character.name;

      const meta =
        document.createElement('div');

      meta.className = 'ch-meta';

      meta.innerHTML = `
        ${this._escape(
          TYPE_LABEL[result.character.type] ||
          result.character.type
        )}
        <br>
        ${
          result.duplicate
            ? '重複：EXP +120 / 限界突破 +1'
            : '新規獲得'
        }
      `;

      card.appendChild(rarity);
      card.appendChild(name);
      card.appendChild(meta);

      grid.appendChild(card);
    }

    panel.appendChild(grid);
  }

  _renderMissions(body) {
    const summary =
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

      node.className =
        'ch-mission';

      const safeProgress = Number.isFinite(Number(progress))
        ? Math.max(0, Number(progress))
        : 0;
      const safeMax =
        Math.max(1, Number(max) || 1);
      const safeClaimed = Boolean(claimed);

      const percentage =
        Math.min(
          100,
          (safeProgress / safeMax) * 100
        );

      node.innerHTML = `
        <b>${this._escape(title)}</b>

        <div class="ch-progress">
          <i
            style="width:${percentage}%"
          ></i>
        </div>

        <div class="ch-row">
          <span>
            ${safeProgress} / ${safeMax}
          </span>

          <button
            class="mission-claim-button"
            ${
              safeClaimed ||
              safeProgress < safeMax
                ? 'disabled'
                : ''
            }
          >
            ${
              safeClaimed
                ? '受取済み'
                : '受け取る'
            }
          </button>
        </div>
      `;

      const button =
        node.querySelector(
          '.mission-claim-button'
        );

      button.onclick = () => {
        try {
          claim();
          this._refreshModal();
        } catch (error) {
          this._showToast(
            error?.message ||
            '報酬の受け取りに失敗しました。'
          );
        }
      };

      body.appendChild(node);
    };

    // セーブデータや旧バージョンのデータが残っていても
    // ミッション画面自体がクラッシュしないよう、ここで完全に正規化する。
    // CharacterSystem の現在の仕様では event は missions の外にある。
    const missions = summary?.missions || {};
    const daily = missions.daily || {};
    const weekly = missions.weekly || {};
    const event = summary?.event || missions.event || {};

    const dailyProgress = Number.isFinite(Number(daily.progress))
      ? Number(daily.progress)
      : 0;
    const weeklyProgress = Number.isFinite(Number(weekly.progress))
      ? Number(weekly.progress)
      : 0;
    const eventProgress = Number.isFinite(Number(event.progress))
      ? Number(event.progress)
      : 0;

    const dailyClaimed = Boolean(daily.claimed);
    const weeklyClaimed = Boolean(weekly.claimed);
    const eventClaimed = Boolean(event.claimed);

    addMission(
      'デイリー：曲を3回クリア',
      dailyProgress,
      3,
      dailyClaimed,
      () => characterSystem.claimDaily()
    );

    addMission(
      'ウィークリー：曲を10回クリア',
      weeklyProgress,
      10,
      weeklyClaimed,
      () => characterSystem.claimWeekly()
    );

    addMission(
      'イベント：曲を7回クリア',
      eventProgress,
      7,
      eventClaimed,
      () => characterSystem.claimEvent()
    );

    const loginData = summary?.login || {};
    const loginStreak = Number.isFinite(Number(loginData.streak))
      ? Math.max(0, Number(loginData.streak))
      : 0;
    const loginClaimedToday = Boolean(loginData.claimedToday);

    const login =
      document.createElement('div');

    login.className =
      'ch-mission';

    login.innerHTML = `
      <b>ログインボーナス</b>

      <div class="ch-muted">
        連続ログイン
        ${loginStreak}日
      </div>

      <button
        class="ch-bigbtn"
        ${
          loginClaimedToday
            ? 'disabled'
            : ''
        }
      >
        ${
          loginClaimedToday
            ? '本日受取済み'
            : '今日の報酬を受け取る'
        }
      </button>
    `;

    login
      .querySelector('button')
      .onclick = () => {
        try {
          characterSystem.claimLogin();
          this._refreshModal();
        } catch (error) {
          this._showToast(
            error?.message ||
            'ログイン報酬の受け取りに失敗しました。'
          );
        }
      };

    body.appendChild(login);
  }

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

    const label =
      document.createElement('div');

    label.className =
      'skill-label';

    label.textContent =
      'SKILL ACTIVATED';

    const name =
      document.createElement('div');

    name.className =
      'skill-name';

    name.textContent =
      skill.name;

    notice.appendChild(label);
    notice.appendChild(name);

    this.root.appendChild(notice);

    window.setTimeout(() => {
      notice.remove();
    }, 2500);
  }

  _showToast(message) {
    this.root
      .querySelector('.ch-toast')
      ?.remove();

    const toast =
      document.createElement('div');

    toast.className =
      'ch-toast';

    toast.textContent =
      String(message);

    this.root.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2200);
  }

  _escape(value) {
    const div =
      document.createElement('div');

    div.textContent =
      String(value);

    return div.innerHTML;
  }
}
