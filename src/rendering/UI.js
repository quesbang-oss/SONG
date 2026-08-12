import { el, escapeHtml, formatTime, clamp } from '../utils/helpers.js';
import { bus } from '../utils/EventBus.js';
import { gameState } from '../core/GameState.js';
import { saveManager } from '../core/SaveManager.js';
import { audioManager } from '../core/AudioManager.js';
import { AudioCache } from '../core/AudioCache.js';
import { safeSongLibrary } from '../music/SafeSongLibrary.js';
import { musicLibrary } from '../music/MusicLibrary.js';
import { NoteGenerator } from '../rhythm/NoteGenerator.js';
import { Beatmap } from '../rhythm/Beatmap.js';
import { ChartEditor } from '../editor/ChartEditor.js';
import { BossManager } from '../boss/BossManager.js';
import { StageValidator } from '../ugc/StageValidator.js';
import { stageManager } from '../ugc/StageManager.js';
import { PlaySession } from '../core/Game.js';
import { DIFFICULTY, NOTE_TYPES, JUDGEMENT } from '../utils/constants.js';

const DIFF_ORDER = ['EASY', 'NORMAL', 'HARD', 'EXPERT'];

/**
 * アプリ全体のDOM画面遷移を管理するクラス。
 * gameState.goto() による画面遷移イベントを購読し、#ui-root の中身を差し替える。
 * 今回のMVPスコープ：MENU / PLAY(選曲) / PLAYING(ゲームプレイHUD) / RESULTS / CREATE(ウィザード)。
 */
export class UI {
  constructor() {
    this.root = document.getElementById('ui-root');
    this.canvas = document.getElementById('game-canvas');
    this.toastRoot = document.getElementById('toast-root');

    /** @type {PlaySession|null} */
    this.session = null;
    /** @type {ChartEditor|null} */
    this.chartEditor = null;

    /** CREATE STAGEウィザードの下書き状態 */
    this.draft = null;

    bus.on('screen:change', ({ screen, params }) => this._render(screen, params));
    bus.on('play:hud', (hud) => this._updateHud(hud));
    bus.on('play:judgement', (data) => this._showJudgePop(data));
    bus.on('play:finished', (result) => this._onPlayFinished(result));

    this._render(gameState.screen, gameState.screenParams);

    // ゲーム中は ESC / P でも一時停止メニューを開閉できる。
    this._handleGlobalKeyDown = (e) => {
      if (!this.session || gameState.screen !== 'PLAYING') return;
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      e.preventDefault();
      this._togglePause();
    };
    window.addEventListener('keydown', this._handleGlobalKeyDown);
  }

  toast(message) {
    const node = el('div', { class: 'toast' }, [message]);
    this.toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 2600);
  }

  _clear() {
    this.root.innerHTML = '';
    this.canvas.style.display = 'none';
  }

  _render(screen, params) {
    if (this.session && screen !== 'PLAYING') {
      this.session.stop();
      this.session = null;
    }
    if (this.chartEditor && screen !== 'CREATE_EDIT') {
      this.chartEditor.destroy();
      this.chartEditor = null;
    }
    this._clear();
    switch (screen) {
      case 'MENU': return this._renderMenu();
      case 'PLAY_SELECT': return this._renderPlaySelect();
      case 'PLAYING': return this._renderPlaying(params);
      case 'RESULTS': return this._renderResults(params);
      case 'CREATE_SONG': return this._renderCreateSong();
      case 'CREATE_CHART': return this._renderCreateChart();
      case 'CREATE_EDIT': return this._renderCreateEdit();
      case 'CREATE_BOSS': return this._renderCreateBoss();
      case 'CREATE_SAVE': return this._renderCreateSave();
      case 'MY_STAGES': return this._renderMyStages();
      default: return this._renderMenu();
    }
  }

  // =====================================================================
  // MENU
  // =====================================================================
  _renderMenu() {
    const screen = el('div', { class: 'screen menu-screen' }, [
      el('div', { class: 'menu-logo' }, [
        el('div', { class: 'jp' }, ['ゆくコミュ']),
        el('div', { class: 'title' }, ['ソングバトル']),
        el('div', { class: 'en' }, ['YUKU COMMU SONG BATTLE'])
      ]),
      el('div', { class: 'menu-list' }, [
        this._menuItem('▶', 'PLAY', '曲を選んでボスを倒す', () => gameState.goto('PLAY_SELECT')),
        this._menuItem('✎', 'CREATE STAGE', '曲を選んで譜面とボスを作る', () => this._startCreateWizard()),
        this._menuItem('🗂', 'MY STAGES', '作成したステージを管理', () => gameState.goto('MY_STAGES')),
      ]),
      el('div', { class: 'menu-footer' }, ['友達と好きな曲・譜面・ボスを持ち寄って遊ぼう'])
    ]);
    this.root.appendChild(screen);
  }

  _menuItem(icon, title, sub, onClick) {
    return el('div', { class: 'menu-item', onclick: onClick }, [
      el('div', { class: 'ic' }, [icon]),
      el('div', {}, [
        title,
        el('small', {}, [sub])
      ])
    ]);
  }

  _topbar(title, onBack) {
    return el('div', { class: 'topbar' }, [
      el('button', { class: 'btn-icon', onclick: onBack || (() => gameState.goto('MENU')) }, ['←']),
      el('h1', {}, [title])
    ]);
  }

  // =====================================================================
  // PLAY SELECT（自分のステージから選んでプレイ）
  // =====================================================================
  _renderPlaySelect() {
    const stages = stageManager.getMyStages();
    const screen = el('div', { class: 'screen' }, [this._topbar('PLAY - ステージを選択')]);
    const content = el('div', { class: 'content' });

    if (stages.length === 0) {
      content.appendChild(el('div', { class: 'empty-hint' }, [
        'まだステージがありません。\n「CREATE STAGE」から最初のステージを作りましょう。'
      ]));
    } else {
      const list = el('div', { class: 'stage-grid' });
      for (const stage of stages) {
        list.appendChild(this._stageCard(stage, () => this._confirmAndStartPlay(stage)));
      }
      content.appendChild(list);
    }
    screen.appendChild(content);
    this.root.appendChild(screen);
  }

  _renderMyStages() {
    const stages = stageManager.getMyStages();
    const screen = el('div', { class: 'screen' }, [this._topbar('MY STAGES')]);
    const content = el('div', { class: 'content' });
    if (stages.length === 0) {
      content.appendChild(el('div', { class: 'empty-hint' }, ['まだステージがありません。']));
    } else {
      const list = el('div', { class: 'stage-grid' });
      for (const stage of stages) {
        const card = this._stageCard(stage, () => this._confirmAndStartPlay(stage));
        const delBtn = el('button', { class: 'btn btn-danger btn-sm', style: 'margin:8px 12px 12px;', onclick: (e) => {
          e.stopPropagation();
          if (confirm(`「${stage.name}」を削除しますか？`)) {
            stageManager.deleteStage(stage.id);
            AudioCache.delete(stage.id);
            this._render('MY_STAGES', {});
          }
        } }, ['削除']);
        card.appendChild(delBtn);
        list.appendChild(card);
      }
      content.appendChild(list);
    }
    screen.appendChild(content);
    this.root.appendChild(screen);
  }

  _stageCard(stage, onClick) {
    const bossImg = stage.boss?.imageDataUrl
      ? el('img', { src: stage.boss.imageDataUrl })
      : '❓';
    const diffLevel = DIFFICULTY[stage.difficulty]?.level || 2;
    return el('div', { class: 'stage-card', onclick: onClick }, [
      el('div', { class: 'stage-boss-img' }, [bossImg]),
      el('div', { class: 'stage-card-body' }, [
        el('div', { class: 'name' }, [escapeHtml(stage.name)]),
        el('div', { class: 'creator' }, [`by ${escapeHtml(stage.creator || 'YOU')} ・ ${escapeHtml(stage.song?.title || '')}`]),
        el('div', { class: 'stage-stats' }, [
          el('span', { class: `diff-pill diff-${diffLevel}` }, [DIFFICULTY[stage.difficulty]?.label || stage.difficulty]),
          el('span', {}, [`♪ ${formatTime(stage.song?.duration || 0)}`]),
          el('span', {}, [`Notes ${stage.beatmap?.notes?.length ?? 0}`])
        ])
      ])
    ]);
  }

  async _confirmAndStartPlay(stage) {
    try {
      await audioManager.ensureContext();
      const buffer = await this._resolveStageAudio(stage);
      if (!buffer) return;
      gameState.goto('PLAYING', { stage, audioBuffer: buffer });
    } catch (err) {
      console.error(err);
      this.toast(`再生できませんでした: ${err.message}`);
    }
  }

  /**
   * ステージの音源を解決する。SAFE SONGなら自動生成、LOCALならまず端末内キャッシュ
   * （IndexedDB）を確認し、キャッシュ済みであればファイル選択なしで即座に再生できる。
   * キャッシュが見つからない場合（初回・キャッシュ削除後など）のみファイル選択を促す。
   * @param {Object} stage
   * @returns {Promise<AudioBuffer|null>}
   */
  async _resolveStageAudio(stage) {
    if (stage.song?.source === 'SAFE' && stage.song.safeSongId) {
      return await safeSongLibrary.loadBuffer(stage.song.safeSongId);
    }
    if (stage.song?.source === 'LOCAL') {
      const cached = await AudioCache.get(stage.id);
      if (cached) {
        return await audioManager.decodeArrayBuffer(cached.arrayBuffer);
      }
      this.toast(`初回のみ：ローカル音源「${stage.song.sourceFileName || stage.song.title}」を選択してください（以後は自動再生されます）`);
      const file = await this._promptFileSelect('audio/*');
      if (!file) return null;
      const result = await musicLibrary.resolve('LOCAL', { file });
      await AudioCache.put(stage.id, result.rawArrayBuffer, result.mimeType, result.sourceFileName);
      return result.buffer;
    }
    throw new Error('曲情報が不正です');
  }

  _promptFileSelect(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files?.[0] || null);
      input.click();
    });
  }

  // =====================================================================
  // PLAYING（ゲームプレイHUD + Canvas）
  // =====================================================================
  async _renderPlaying({ stage, audioBuffer }) {
    this.canvas.style.display = 'block';
    const settings = saveManager.getSettings();

    const hud = el('div', { class: 'hud' }, [
      el('div', { class: 'hud-top' }, [
        el('div', { class: 'boss-name', id: 'hud-boss-name' }, [stage.boss?.name || 'UNKNOWN SONG']),
        el('div', { class: 'hp-bar-wrap' }, [
          el('div', { class: 'hp-bar' }, [el('div', { class: 'fill', id: 'hud-boss-fill', style: 'width:100%' })]),
          el('div', { class: 'hp-pct', id: 'hud-boss-pct' }, ['100%'])
        ]),
        el('div', { class: 'hp-bar-wrap' }, [
          el('div', { class: 'hp-bar player' }, [el('div', { class: 'fill', id: 'hud-player-fill', style: 'width:100%' })]),
          el('div', { class: 'hp-pct', id: 'hud-player-pct' }, ['HP'])
        ]),
        el('div', { class: 'phase-label', id: 'hud-phase' }, ['PHASE 1 - Awakening'])
      ]),
      el('div', { class: 'combo-display', id: 'hud-combo-wrap', style: 'display:none' }, [
        el('div', { class: 'combo-num', id: 'hud-combo-num' }, ['0']),
        el('div', { class: 'combo-label' }, ['COMBO'])
      ]),
      el('div', { class: 'hud-bottom-left', id: 'hud-score' }, ['SCORE 0']),
      el('button', { class: 'btn-icon pause-btn', onclick: () => this._togglePause() }, ['⏸'])
    ]);
    this.root.appendChild(hud);

    this.session = new PlaySession({ stage, audioBuffer, canvas: this.canvas, settings });
    try {
      await this.session.start();
    } catch (err) {
      console.error(err);
      this.toast(`再生開始に失敗しました: ${err.message}`);
      gameState.goto('PLAY_SELECT');
    }
  }

  _togglePause() {
    if (!this.session) return;
    if (this.session._paused) {
      this._resumeFromPauseMenu();
    } else {
      this.session.pause();
      this._showPauseMenu();
    }
  }

  _showPauseMenu() {
    if (document.getElementById('pause-menu-overlay')) return;
    const overlay = el('div', { class: 'pause-menu-overlay', id: 'pause-menu-overlay' }, [
      el('div', { class: 'pause-menu-panel' }, [
        el('div', { class: 'pause-menu-title' }, ['PAUSED']),
        el('div', { class: 'pause-menu-subtitle' }, ['ゲームを一時停止しています']),
        el('div', { class: 'pause-menu-actions' }, [
          el('button', {
            class: 'btn btn-primary btn-block',
            onclick: () => this._resumeFromPauseMenu()
          }, ['▶ ゲームに戻る']),
          el('button', {
            class: 'btn btn-ghost btn-block',
            onclick: () => this._returnToTitleFromPause()
          }, ['⌂ タイトルへ戻る'])
        ])
      ])
    ]);
    this.root.appendChild(overlay);
  }

  async _resumeFromPauseMenu() {
    if (!this.session) return;
    const overlay = document.getElementById('pause-menu-overlay');
    if (overlay) overlay.remove();
    try {
      await this.session.resume();
    } catch (err) {
      console.error(err);
      this.toast(`再開に失敗しました: ${err.message}`);
    }
  }

  _returnToTitleFromPause() {
    const overlay = document.getElementById('pause-menu-overlay');
    if (overlay) overlay.remove();
    if (this.session) {
      this.session.stop();
      this.session = null;
    }
    gameState.goto('MENU');
  }

  _updateHud(hud) {
    const bossFill = document.getElementById('hud-boss-fill');
    const bossPct = document.getElementById('hud-boss-pct');
    const playerFill = document.getElementById('hud-player-fill');
    const playerPct = document.getElementById('hud-player-pct');
    const phase = document.getElementById('hud-phase');
    const score = document.getElementById('hud-score');
    const comboWrap = document.getElementById('hud-combo-wrap');
    const comboNum = document.getElementById('hud-combo-num');
    if (!bossFill) return;

    bossFill.style.width = `${clamp(hud.bossPct, 0, 100)}%`;
    bossPct.textContent = `${Math.round(hud.bossPct)}%`;
    const playerPctVal = clamp((hud.hp / hud.maxHp) * 100, 0, 100);
    playerFill.style.width = `${playerPctVal}%`;
    playerPct.textContent = `${Math.round(playerPctVal)}%`;
    phase.textContent = hud.phaseName;
    score.textContent = `SCORE ${hud.score.toLocaleString()}`;

    if (hud.combo >= 5) {
      comboWrap.style.display = 'block';
      comboNum.textContent = String(hud.combo);
      comboNum.style.animation = 'none';
      void comboNum.offsetWidth;
      comboNum.style.animation = 'combo-pop .12s ease-out';
    } else {
      comboWrap.style.display = 'none';
    }
  }

  _showJudgePop({ judgement }) {
    if (judgement === undefined) return;
    const settings = saveManager.getSettings();
    if (!settings.showJudgeText) return;
    const pop = el('div', { class: `judge-pop judge-${judgement.toLowerCase()}` }, [judgement]);
    this.root.appendChild(pop);
    setTimeout(() => pop.remove(), 380);
  }

  // =====================================================================
  // RESULTS
  // =====================================================================
  _onPlayFinished(result) {
    gameState.goto('RESULTS', result);
  }

  _renderResults(result) {
    if (!result) return this._renderMenu();
    const isDraftTest = String(result.stage?.id).startsWith('__draft') && this.draft;

    const primaryRow = isDraftTest
      ? el('div', { class: 'results-actions' }, [
          el('button', { class: 'btn btn-primary btn-block', onclick: () => gameState.goto('CREATE_EDIT') }, ['編集に戻る'])
        ])
      : el('div', { class: 'results-actions' }, [
          el('button', { class: 'btn btn-primary btn-block', onclick: () => this._confirmAndStartPlay(result.stage) }, ['もう一度プレイ'])
        ]);

    const secondaryRow = isDraftTest
      ? el('div', { class: 'results-actions' }, [
          el('button', { class: 'btn btn-ghost btn-block', onclick: () => gameState.goto('MENU') }, ['メニューへ（編集内容は破棄されます）'])
        ])
      : el('div', { class: 'results-actions' }, [
          el('button', { class: 'btn btn-ghost btn-block', onclick: () => gameState.goto('PLAY_SELECT') }, ['ステージ選択へ']),
          el('button', { class: 'btn btn-ghost btn-block', onclick: () => gameState.goto('MENU') }, ['メニューへ'])
        ]);

    const screen = el('div', { class: 'screen results-screen' }, [
      el('div', {}, [isDraftTest ? 'TEST PLAY 結果' : (result.cleared ? 'STAGE CLEAR' : 'STAGE FAILED')]),
      el('div', { class: 'grade' }, [result.grade]),
      el('div', { class: 'results-stats' }, [
        this._statBox('SCORE', result.score.toLocaleString()),
        this._statBox('ACCURACY', `${result.accuracy.toFixed(2)}%`),
        this._statBox('MAX COMBO', String(result.maxCombo)),
        this._statBox('MISS', String(result.judgeCounts?.MISS ?? 0))
      ]),
      primaryRow,
      secondaryRow
    ]);
    this.root.appendChild(screen);
  }

  _statBox(label, value) {
    return el('div', { class: 'stat' }, [
      el('div', { class: 'v' }, [value]),
      el('div', { class: 'l' }, [label])
    ]);
  }

  // =====================================================================
  // CREATE STAGE ウィザード（曲選択 → 自動譜面 → 編集 → ボス → 保存）
  // =====================================================================
  _startCreateWizard() {
    this.draft = {
      musicSource: 'SAFE',
      resolvedSong: null,   // musicLibrary.resolve() の結果
      difficulty: 'NORMAL',
      bpm: null,            // ユーザーが手動設定したBPM（未設定ならresolvedSong.bpm等から自動決定）
      beatmap: null,        // Beatmapインスタンス
      boss: BossManager.createDefaultConfig(),
      stageName: ''
    };
    gameState.goto('CREATE_SONG');
  }

  _wizardShell(title, stepIndex, bodyNode, footerButtons) {
    const totalSteps = 4;
    const steps = el('div', { class: 'wizard-steps' },
      Array.from({ length: totalSteps }, (_, i) => el('div', { class: `dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}` }))
    );
    const screen = el('div', { class: 'screen' }, [
      this._topbar(title, () => gameState.goto('MENU')),
      steps,
      el('div', { class: 'wizard-body' }, [bodyNode]),
      el('div', { class: 'wizard-footer' }, footerButtons)
    ]);
    this.root.appendChild(screen);
  }

  // ---- STEP 1: SELECT MUSIC ----
  _renderCreateSong() {
    const body = el('div', {});
    const tabRow = el('div', { class: 'chip-select', style: 'margin-bottom:14px;' }, [
      el('div', { class: `opt ${this.draft.musicSource === 'SAFE' ? 'active' : ''}`, onclick: () => { this.draft.musicSource = 'SAFE'; this._render('CREATE_SONG', {}); } }, ['🎵 SAFE SONG LIBRARY']),
      el('div', { class: `opt ${this.draft.musicSource === 'LOCAL' ? 'active' : ''}`, onclick: () => { this.draft.musicSource = 'LOCAL'; this._render('CREATE_SONG', {}); } }, ['📁 LOCAL MUSIC'])
    ]);
    body.appendChild(tabRow);

    if (this.draft.musicSource === 'SAFE') {
      const list = el('div', { class: 'song-list' });
      for (const song of safeSongLibrary.list()) {
        const selected = this.draft.resolvedSong?.safeSongId === song.id;
        list.appendChild(el('div', { class: 'song-row', style: selected ? 'border-color:var(--accent-2)' : '', onclick: () => this._selectSafeSong(song) }, [
          el('span', { class: 'song-badge badge-safe' }, ['SAFE']),
          el('div', { class: 'song-meta' }, [
            el('div', { class: 't' }, [song.title]),
            el('div', { class: 'a' }, [song.artist])
          ]),
          el('div', { class: 'song-info' }, [`${song.bpm}BPM\n${formatTime(song.duration)}`])
        ]));
      }
      body.appendChild(list);
    } else {
      const dz = el('div', { class: 'dropzone' }, [
        this.draft.resolvedSong?.source === 'LOCAL'
          ? `選択済み: ${this.draft.resolvedSong.sourceFileName}`
          : 'タップして音楽ファイルを選択\n(MP3 / WAV / OGG / WebM)'
      ]);
      dz.onclick = () => this._selectLocalMusic();
      body.appendChild(dz);
    }

    const nextBtn = el('button', { class: 'btn btn-primary', disabled: !this.draft.resolvedSong, onclick: () => gameState.goto('CREATE_CHART') }, ['次へ：譜面を自動生成']);
    this._wizardShell('CREATE STAGE - 曲を選択', 0, body, [nextBtn]);
  }

  async _selectSafeSong(song) {
    try {
      await audioManager.ensureContext();
      const resolved = await musicLibrary.resolve('SAFE', { safeSongId: song.id });
      this.draft.resolvedSong = resolved;
      this.draft.bpm = null;
      this.draft.beatmap = null;
      this._render('CREATE_SONG', {});
    } catch (err) {
      this.toast(`読み込み失敗: ${err.message}`);
    }
  }

  async _selectLocalMusic() {
    try {
      await audioManager.ensureContext();
      const file = await this._promptFileSelect('audio/*');
      if (!file) return;
      const resolved = await musicLibrary.resolve('LOCAL', { file });
      this.draft.resolvedSong = resolved;
      this.draft.bpm = null;
      this.draft.beatmap = null;
      this._render('CREATE_SONG', {});
    } catch (err) {
      this.toast(`読み込み失敗: ${err.message}`);
    }
  }

  // ---- STEP 2: AUTO-GENERATE CHART ----
  _renderCreateChart() {
    const song = this.draft.resolvedSong;
    const effectiveBpm = this._effectiveBpm();
    const body = el('div', {});
    body.appendChild(el('div', { class: 'field' }, [
      el('label', {}, ['難易度']),
      el('div', { class: 'chip-select' }, DIFF_ORDER.map((d) =>
        el('div', { class: `opt ${this.draft.difficulty === d ? 'active' : ''}`, onclick: () => { this.draft.difficulty = d; this._render('CREATE_CHART', {}); } }, [DIFFICULTY[d].label])
      ))
    ]));

    if (song.source === 'LOCAL') {
      // LOCAL MUSICは曲ファイル側に信頼できるBPM情報がないため、プレイヤーが手動設定する。
      // ノーツの自動生成の基準やゲーム中の流れる速さに反映される。
      body.appendChild(el('div', { class: 'field' }, [
        el('label', {}, ['BPM（テンポ）－ LOCAL MUSIC用。自分で設定できます']),
        el('input', {
          type: 'number', min: '40', max: '300', step: '1', value: String(effectiveBpm),
          oninput: (e) => {
            const v = parseInt(e.target.value, 10);
            this.draft.bpm = isFinite(v) ? Math.max(40, Math.min(300, v)) : null;
          }
        })
      ]));
    }

    body.appendChild(el('div', { class: 'card' }, [
      el('div', {}, [`曲: ${escapeHtml(song.title)} (${song.source === 'LOCAL' ? 'LOCAL / ' : ''}${effectiveBpm}BPM / ${formatTime(song.duration)})`]),
      this.draft.beatmap
        ? el('div', { style: 'margin-top:8px;color:var(--accent-2);' }, [`自動生成済み：ノーツ数 ${this.draft.beatmap.noteCount}`])
        : el('div', { style: 'margin-top:8px;color:var(--text-dim);' }, ['まだ譜面が生成されていません'])
    ]));

    const genBtn = el('button', { class: 'btn btn-secondary btn-block', onclick: () => this._generateChart() }, ['🎼 自動譜面生成する']);
    body.appendChild(genBtn);

    const nextBtn = el('button', { class: 'btn btn-primary', disabled: !this.draft.beatmap, onclick: () => gameState.goto('CREATE_EDIT') }, ['次へ：譜面を編集']);
    this._wizardShell('CREATE STAGE - 自動譜面生成', 1, body, [nextBtn]);
  }

  /** ユーザーが手動設定したBPM（あれば優先）、なければ曲固有のBPM、それも無ければフォールバック値を返す。 */
  _effectiveBpm() {
    if (this.draft.bpm) return this.draft.bpm;
    if (this.draft.resolvedSong?.bpm) return this.draft.resolvedSong.bpm;
    return this._estimateBpmFallback();
  }

  _generateChart() {
    const song = this.draft.resolvedSong;
    const bpm = this._effectiveBpm();
    try {
      this.draft.beatmap = NoteGenerator.generate(song.buffer, bpm, this.draft.difficulty, 42);
      this.toast(`譜面を生成しました（ノーツ ${this.draft.beatmap.noteCount}個 / ${bpm}BPM）`);
      this._render('CREATE_CHART', {});
    } catch (err) {
      console.error(err);
      this.toast(`譜面生成に失敗しました: ${err.message}`);
    }
  }

  _estimateBpmFallback() {
    return 120;
  }

  // ---- STEP 3: EDIT CHART / TEST PLAY ----
  _renderCreateEdit() {
    this.canvas.style.display = 'none';
    const body = el('div', { class: 'editor-screen', style: 'position:absolute;inset:0;display:flex;flex-direction:column;' });

    const toolbar = el('div', { class: 'editor-toolbar' }, [
      el('button', { class: 'btn-icon', id: 'editor-play-btn', onclick: () => this._toggleEditorPlay() }, ['▶']),
      ...Object.values(NOTE_TYPES).filter((t) => t !== NOTE_TYPES.SPECIAL).map((t) =>
        el('button', { class: `btn btn-sm ${this.chartEditor?.currentNoteType === t ? 'btn-primary' : 'btn-ghost'}`, onclick: (e) => this._setEditorNoteType(t, e) }, [t])
      ),
      el('div', { class: 'grow' }),
      el('span', { style: 'font-size:11px;color:var(--text-dim);', id: 'editor-note-count' }, [`Notes: ${this.draft.beatmap.noteCount}`]),
    ]);

    const main = el('div', { class: 'editor-main' }, [el('canvas', { id: 'editor-canvas' })]);

    const footer = el('div', { class: 'wizard-footer' }, [
      el('button', { class: 'btn btn-secondary', onclick: () => this._testPlayDraft() }, ['▶ TEST PLAY']),
      el('button', { class: 'btn btn-primary', onclick: () => gameState.goto('CREATE_BOSS') }, ['次へ：ボス設定'])
    ]);

    body.appendChild(this._topbar('CREATE STAGE - 譜面編集', () => gameState.goto('CREATE_CHART')));
    body.appendChild(toolbar);
    body.appendChild(main);
    body.appendChild(footer);
    this.root.appendChild(body);

    requestAnimationFrame(() => {
      const canvasEl = document.getElementById('editor-canvas');
      audioManager.setBuffer(this.draft.resolvedSong.buffer);
      this.chartEditor = new ChartEditor(canvasEl, this.draft.beatmap);
      this.chartEditor.onNotesChanged = (count) => {
        const el2 = document.getElementById('editor-note-count');
        if (el2) el2.textContent = `Notes: ${count}`;
      };
      this.chartEditor.render(0);
    });
  }

  _setEditorNoteType(type, e) {
    if (!this.chartEditor) return;
    this.chartEditor.setNoteType(type);
    const toolbar = e.target.parentElement;
    toolbar.querySelectorAll('button').forEach((b) => b.classList.remove('btn-primary'));
    toolbar.querySelectorAll('button').forEach((b) => { if (Object.values(NOTE_TYPES).includes(b.textContent)) b.classList.add('btn-ghost'); });
    e.target.classList.add('btn-primary');
    e.target.classList.remove('btn-ghost');
  }

  async _toggleEditorPlay() {
    if (!this.chartEditor) return;
    const btn = document.getElementById('editor-play-btn');
    if (this.chartEditor.isPlaying) {
      this.chartEditor.pause();
      if (btn) btn.textContent = '▶';
    } else {
      await this.chartEditor.play();
      if (btn) btn.textContent = '⏸';
    }
  }

  async _testPlayDraft() {
    if (!this.draft.beatmap || this.draft.beatmap.noteCount === 0) {
      this.toast('ノーツが1つもありません。先に譜面を作成してください。');
      return;
    }
    this.chartEditor?.pause();
    const tempStage = this._buildStageObject('__draft_test__');
    gameState.goto('PLAYING', { stage: tempStage, audioBuffer: this.draft.resolvedSong.buffer, isDraftTest: true });
  }

  // ---- STEP 4: BOSS SETUP ----
  _renderCreateBoss() {
    const body = el('div', {});
    body.appendChild(el('div', { class: 'field' }, [
      el('label', {}, ['ボス名（未入力の場合は UNKNOWN SONG）']),
      el('input', {
        type: 'text', value: this.draft.boss.name === 'UNKNOWN SONG' ? '' : this.draft.boss.name,
        placeholder: 'UNKNOWN SONG',
        oninput: (e) => { this.draft.boss.name = e.target.value; }
      })
    ]));

    const preview = el('div', { class: 'upload-preview' }, [
      this.draft.boss.imageDataUrl
        ? el('img', { src: this.draft.boss.imageDataUrl })
        : el('div', { class: 'stage-boss-img', style: 'width:64px;height:64px;border-radius:10px;' }, ['❓']),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => this._selectBossImage() }, ['ボス画像を選択 (PNG/JPG/WebP)']),
      this.draft.boss.imageDataUrl ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { this.draft.boss.imageDataUrl = null; this._render('CREATE_BOSS', {}); } }, ['画像を削除']) : null
    ]);
    body.appendChild(el('div', { class: 'field' }, [el('label', {}, ['ボス画像']), preview]));
    body.appendChild(el('div', { style: 'font-size:11px;color:var(--text-dim);' }, ['画像を設定しない場合、自動的にデフォルトボス「UNKNOWN SONG」が使用されます。']));

    const nextBtn = el('button', { class: 'btn btn-primary', onclick: () => gameState.goto('CREATE_SAVE') }, ['次へ：ステージを保存']);
    this._wizardShell('CREATE STAGE - ボス設定', 2, body, [nextBtn]);
  }

  async _selectBossImage() {
    const file = await this._promptFileSelect('image/png,image/jpeg,image/webp');
    if (!file) return;
    try {
      this.draft.boss.imageDataUrl = await BossManager.fileToDataUrl(file);
      this._render('CREATE_BOSS', {});
    } catch (err) {
      this.toast(err.message);
    }
  }

  // ---- STEP 5: SAVE ----
  _renderCreateSave() {
    const body = el('div', {});
    body.appendChild(el('div', { class: 'field' }, [
      el('label', {}, ['ステージ名']),
      el('input', {
        type: 'text', value: this.draft.stageName, placeholder: `${this.draft.resolvedSong.title} - ${this.draft.boss.name}`,
        oninput: (e) => { this.draft.stageName = e.target.value; }
      })
    ]));
    body.appendChild(el('div', { class: 'card' }, [
      el('div', {}, [`曲: ${escapeHtml(this.draft.resolvedSong.title)}`]),
      el('div', {}, [`難易度: ${DIFFICULTY[this.draft.difficulty].label}`]),
      el('div', {}, [`ノーツ数: ${this.draft.beatmap.noteCount}`]),
      el('div', {}, [`ボス: ${escapeHtml(this.draft.boss.name)}`])
    ]));

    const saveBtn = el('button', { class: 'btn btn-primary', onclick: () => this._saveStage() }, ['💾 ステージを保存']);
    this._wizardShell('CREATE STAGE - 保存', 3, body, [saveBtn]);
  }

  _buildStageObject(idOverride) {
    const song = this.draft.resolvedSong;
    const bpm = this._effectiveBpm();
    const songJson = song.source === 'SAFE'
      ? { source: 'SAFE', safeSongId: song.safeSongId, title: song.title, artist: song.artist, duration: song.duration, bpm }
      : { source: 'LOCAL', title: song.title, artist: song.artist, duration: song.duration, sourceFileName: song.sourceFileName, bpm };

    const stage = stageManager.createDraft({
      name: this.draft.stageName?.trim() || `${song.title} - ${this.draft.boss.name}`,
      song: songJson,
      beatmapJson: this.draft.beatmap.toJSON(),
      boss: this.draft.boss,
      difficulty: this.draft.difficulty
    });
    if (idOverride) stage.id = idOverride;
    return stage;
  }

  async _saveStage() {
    const stage = this._buildStageObject();
    const { valid, errors } = StageValidator.validate(stage);
    if (!valid) {
      this.toast(`保存できません: ${errors[0]}`);
      return;
    }
    if (this.draft.resolvedSong.source === 'LOCAL' && this.draft.resolvedSong.rawArrayBuffer) {
      await AudioCache.put(
        stage.id,
        this.draft.resolvedSong.rawArrayBuffer,
        this.draft.resolvedSong.mimeType,
        this.draft.resolvedSong.sourceFileName
      );
    }
    stageManager.saveDraft(stage);
    this.toast('ステージを保存しました！');
    gameState.goto('MY_STAGES');
  }
}
