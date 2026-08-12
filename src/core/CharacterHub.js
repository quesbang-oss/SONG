import { bus } from '../utils/EventBus.js';
import { characterSystem } from './CharacterSystem.js';
import { gameState } from './GameState.js';
import img_arukarasu from '../assets/arukarasu.png';
import img_datyou from '../assets/datyou.png';
import img_dossunmitta from '../assets/dossunmitta.jpg';
import img_kangaemitta from '../assets/kangaemitta.jpg';
import img_keikakudoori from '../assets/keikakudoori.jpg';
import img_kiokunasi from '../assets/kiokunasi.jpg';
import img_kureteyaru from '../assets/kureteyaru.jpg';
import img_mewotuketeru from '../assets/mewotuketeru.png';
import img_mittasan from '../assets/mittasan.jpg';

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
 */
function resolveAssetUrl(assetPath) {
  if (!assetPath) {
    return '';
  }

  const value = String(assetPath).trim();

  if (!value) {
    return '';
  }

  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }

  const fileName = value
    .split('/')
    .pop()
    .toLowerCase();

  const imageMap = {
    'arukarasu.png': img_arukarasu,
    'datyou.png': img_datyou,
    'dossunmitta.jpg': img_dossunmitta,
    'kangaemitta.jpg': img_kangaemitta,
    'keikakudoori.jpg': img_keikakudoori,
    'kiokunasi.jpg': img_kiokunasi,
    'kureteyaru.jpg': img_kureteyaru,
    'mewotuketeru.png': img_mewotuketeru,
    'mittasan.jpg': img_mittasan
  };

  return imageMap[fileName] || value;
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

      /*
       * 凸ステータス表示
       */
      #character-hub-root .ch-breakthrough {
        margin-top: 8px;
        padding: 10px;
        border-radius: 10px;
        background: #211d2d;
        border: 1px solid #39314f;
      }

      #character-hub-root .ch-breakthrough-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-weight: 900;
        margin-bottom: 6px;
      }

      #character-hub-root .ch-breakthrough-level {
        color: #d8caff;
        font-size: 15px;
      }

      #character-hub-root .ch-breakthrough-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        margin-top: 4px;
      }

      #character-hub-root .ch-breakthrough-value {
        font-weight: 800;
      }

      #character-hub-root .ch-breakthrough-up {
        color: #8dffae;
      }

      #character-hub-root .ch-breakthrough-base {
        color: #aaa6b7;
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
       * キャラクター画像
       */
      if (owned && character.image) {
        const image =
          document.createElement('img');

        image.src =
          resolveAssetUrl(character.image);

        image.alt =
          character.name;

        image.loading = 'eager';
        image.draggable = false;

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

      /*
       * 凸数
       */
      const breakthrough =
        progress
          ? Math.max(
              0,
              Number(progress.breakthrough) || 0
            )
          : 0;

      /*
       * 元の基礎ステータス
       */
      const baseHp =
        Number(character.baseHp) || 0;

      const baseAttack =
        Number(character.attackMultiplier) || 0;

      /*
       * CharacterSystem.getBattleStats() と同じ
       * 凸ボーナス計算。
       *
       * HP:
       * 1凸につき +4%
       *
       * 攻撃:
       * 1凸につき +2%
       */
      const breakthroughHpBonus =
        baseHp * breakthrough * 0.04;

      const breakthroughAttackBonus =
        baseAttack * breakthrough * 0.02;

      const totalHp =
        Math.round(
          baseHp * (1 + breakthrough * 0.04)
        );

      const totalAttackPercent =
        Math.round(
          baseAttack *
          (1 + breakthrough * 0.02) *
          100
        );

      const baseAttackPercent =
        Math.round(baseAttack * 100);

      const attackIncreasePercent =
        totalAttackPercent -
        baseAttackPercent;

      meta.innerHTML = `
        ${this._escape(
          TYPE_LABEL[character.type] ||
          character.type
        )}
        <br>

        基礎HP：
        ${baseHp}
        <br>

        基礎攻撃：
        ${baseAttackPercent}%
        <br>

        ${this._escape(description)}
      `;

      card.appendChild(meta);

      /*
       * 凸ステータスパネル
       */
      if (owned) {
        const breakthroughBox =
          document.createElement('div');

        breakthroughBox.className =
          'ch-breakthrough';

        const title =
          document.createElement('div');

        title.className =
          'ch-breakthrough-title';

        const titleText =
          document.createElement('span');

        titleText.textContent =
          breakthrough > 0
            ? `${breakthrough}凸`
            : '無凸';

        titleText.className =
          'ch-breakthrough-level';

        const ownedCount =
          document.createElement('span');

        ownedCount.className =
          'ch-muted';

        ownedCount.textContent =
          `所持 ${progress.owned || 1}`;

        title.appendChild(titleText);
        title.appendChild(ownedCount);

        breakthroughBox.appendChild(title);

        /*
         * HP
         */
        const hpRow =
          document.createElement('div');

        hpRow.className =
          'ch-breakthrough-row';

        hpRow.innerHTML = `
          <span>HP</span>
          <span class="ch-breakthrough-value">
            ${totalHp}
            ${
              breakthrough > 0
                ? `<span class="ch-breakthrough-up">
                    (+${Math.round(
                      breakthroughHpBonus
                    )})
                  </span>`
                : `<span class="ch-breakthrough-base">
                    (+0)
                  </span>`
            }
          </span>
        `;

        breakthroughBox.appendChild(hpRow);

        /*
         * 攻撃力
         *
         * attackMultiplier は倍率なので、
         * 「何%増えたか」を表示。
         */
        const attackRow =
          document.createElement('div');

        attackRow.className =
          'ch-breakthrough-row';

        attackRow.innerHTML = `
          <span>攻撃力</span>
          <span class="ch-breakthrough-value">
            ${totalAttackPercent}%
            ${
              breakthrough > 0
                ? `<span class="ch-breakthrough-up">
                    (+${attackIncreasePercent}%)
                  </span>`
                : `<span class="ch-breakthrough-base">
                    (+0%)
                  </span>`
            }
          </span>
        `;

        breakthroughBox.appendChild(attackRow);

        /*
         * 凸による補正率
         */
        const bonusRow =
          document.createElement('div');

        bonusRow.className =
          'ch-breakthrough-row';

        bonusRow.innerHTML = `
          <span>凸ボーナス</span>
          <span class="ch-breakthrough-up">
            HP +${breakthrough * 4}%
            /
            攻撃 +${breakthrough * 2}%
          </span>
        `;

        breakthroughBox.appendChild(bonusRow);

        card.appendChild(breakthroughBox);
      }

      /*
       * スキル
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

      /*
       * 操作
       */
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

      const safeMax =
        Math.max(1, max);

      const percentage =
        Math.min(
          100,
          (progress / safeMax) * 100
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
            ${progress} / ${max}
          </span>

          <button
            class="mission-claim-button"
            ${
              claimed ||
              progress < max
                ? 'disabled'
                : ''
            }
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

    const missions =
      summary.missions || {};

    const daily =
      missions.daily || {
        progress: 0,
        claimed: false
      };

    const weekly =
      missions.weekly || {
        progress: 0,
        claimed: false
      };

    const event =
      summary.event ||
      missions.event || {
        progress: 0,
        claimed: false
      };

    addMission(
      'デイリー：曲を3回クリア',
      Number(daily.progress) || 0,
      3,
      Boolean(daily.claimed),
      () => characterSystem.claimDaily()
    );

    addMission(
      'ウィークリー：曲を10回クリア',
      Number(weekly.progress) || 0,
      10,
      Boolean(weekly.claimed),
      () => characterSystem.claimWeekly()
    );

    addMission(
      'イベント：曲を7回クリア',
      Number(event.progress) || 0,
      7,
      Boolean(event.claimed),
      () => characterSystem.claimEvent()
    );

    const loginData =
      summary.login || {
        streak: 0,
        claimedToday: false
      };

    const login =
      document.createElement('div');

    login.className =
      'ch-mission';

    login.innerHTML = `
      <b>ログインボーナス</b>

      <div class="ch-muted">
        連続ログイン
        ${Number(loginData.streak) || 0}日
      </div>

      <button
        class="ch-bigbtn"
        ${
          loginData.claimedToday
            ? 'disabled'
            : ''
        }
      >
        ${
          loginData.claimedToday
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
