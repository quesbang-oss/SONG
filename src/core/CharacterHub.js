import { bus } from '../utils/EventBus.js';
import { characterSystem } from './CharacterSystem.js';
import { gameState } from './GameState.js';

const TYPE_LABEL = { HP: 'HP特化', ATTACK: '攻撃特化', SPECIAL: '特殊特化' };

export class CharacterHub {
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'character-hub-root';
    document.body.appendChild(this.root);
    this.opened = false;
    this._installStyles();
    this._renderButton();
    bus.on('screen:change', ({ screen }) => this._updateVisibility(screen));
    bus.on('character:changed', () => this._refreshModal());
    bus.on('currency:changed', () => this._refreshModal());
    bus.on('character:levelup', () => this._refreshModal());
    bus.on('gacha:result', () => this._refreshModal());
    bus.on('character:skill', ({ skill }) => this._showToast(`SKILL: ${skill.name}`));
    this._updateVisibility(gameState.screen);
  }

  _installStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #character-hub-root{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:system-ui,sans-serif}
      #character-hub-root .ch-btn{position:fixed;right:20px;bottom:78px;pointer-events:auto;border:1px solid rgba(255,255,255,.18);background:rgba(12,10,22,.92);color:#fff;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}
      #character-hub-root .ch-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto}
      #character-hub-root .ch-panel{width:min(900px,96vw);max-height:90vh;overflow:auto;background:#11101a;color:#f4f2ff;border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:18px}
      #character-hub-root .ch-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.ch-head h2{margin:0}.ch-close{border:0;background:#29263a;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
      #character-hub-root .ch-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:12px}.ch-tab{border:1px solid #343044;background:#1a1825;color:#ddd;border-radius:9px;padding:8px 12px;cursor:pointer}.ch-tab.active{background:#39314f;border-color:#7c63c7}
      #character-hub-root .ch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.ch-card{background:#191722;border:1px solid #302d3d;border-radius:14px;padding:12px}.ch-card.selected{border-color:#a887ff;box-shadow:0 0 0 1px #a887ff inset}.ch-img{height:110px;border-radius:10px;background:#252232;display:flex;align-items:center;justify-content:center;font-size:34px;margin-bottom:9px;overflow:hidden}.ch-img img{width:100%;height:100%;object-fit:cover}.ch-rarity{font-weight:900}.ch-meta{font-size:12px;color:#aaa6b7;line-height:1.5}.ch-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.ch-actions button,.ch-bigbtn{border:0;border-radius:9px;padding:8px 10px;background:#51416f;color:#fff;cursor:pointer;font-weight:700}.ch-actions button:disabled{opacity:.45;cursor:not-allowed}.ch-bigbtn{width:100%;margin-top:8px;padding:12px}.ch-result{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}.ch-result .ch-card{min-height:120px}.ch-info{background:#171520;border-radius:12px;padding:12px;margin-bottom:12px}.ch-row{display:flex;justify-content:space-between;gap:10px;margin:5px 0}.ch-muted{color:#aaa6b7;font-size:12px}.ch-list{display:grid;gap:8px}.ch-mission{background:#191722;border:1px solid #302d3d;border-radius:12px;padding:11px}.ch-progress{height:8px;background:#292635;border-radius:99px;overflow:hidden;margin:7px 0}.ch-progress>i{display:block;height:100%;background:#9b7cff}.ch-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#15131e;color:#fff;border:1px solid #51416f;border-radius:10px;padding:10px 15px;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.4)}
      @media(max-width:600px){#character-hub-root .ch-btn{right:12px;bottom:76px}.ch-panel{padding:12px!important}.ch-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ch-card{padding:9px}.ch-img{height:80px}}
    `;
    document.head.appendChild(style);
  }

  _renderButton() {
    this.button = document.createElement('button');
    this.button.className = 'ch-btn';
    this.button.textContent = '👤 キャラクター';
    this.button.onclick = () => this.open();
    this.root.appendChild(this.button);
  }

  _updateVisibility(screen) {
    this.button.style.display = screen === 'PLAYING' ? 'none' : '';
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this._renderModal('characters');
  }

  close() {
    this.opened = false;
    this.root.querySelector('.ch-overlay')?.remove();
  }

  _refreshModal() {
    if (!this.opened) return;
    const active = this.root.querySelector('.ch-tab.active')?.dataset.tab || 'characters';
    this._renderModal(active);
  }

  _renderModal(tab) {
    this.root.querySelector('.ch-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ch-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };
    const panel = document.createElement('div');
    panel.className = 'ch-panel';
    const head = document.createElement('div');
    head.className = 'ch-head';
    head.innerHTML = `<h2>キャラクター</h2><button class="ch-close">閉じる</button>`;
    head.querySelector('.ch-close').onclick = () => this.close();
    panel.appendChild(head);
    const tabs = document.createElement('div');
    tabs.className = 'ch-tabs';
    [['characters','キャラクター'],['gacha','ガチャ'],['missions','報酬・ミッション']].forEach(([id,label])=>{
      const b=document.createElement('button'); b.className=`ch-tab ${tab===id?'active':''}`; b.dataset.tab=id; b.textContent=label; b.onclick=()=>this._renderModal(id); tabs.appendChild(b);
    });
    panel.appendChild(tabs);
    const body = document.createElement('div');
    if(tab==='characters') this._renderCharacters(body); else if(tab==='gacha') this._renderGacha(body); else this._renderMissions(body);
    panel.appendChild(body); overlay.appendChild(panel); this.root.appendChild(overlay);
  }

  _renderCharacters(body) {
    const s = characterSystem.getSummary();
    const info=document.createElement('div'); info.className='ch-info'; info.innerHTML=`<div class="ch-row"><b>ガチャ石</b><b>💎 ${s.currency}</b></div><div class="ch-row"><span>選択中</span><span>${s.selected.name} / Lv.${s.progress.level}</span></div>`; body.appendChild(info);
    const grid=document.createElement('div'); grid.className='ch-grid';
    for(const row of s.characters){
      const c=row.character, p=row.progress; const card=document.createElement('div'); card.className=`ch-card ${s.selected.id===c.id?'selected':''}`;
      const img=c.image?`<img src="${c.image}" alt="">`:'👤';
      card.innerHTML=`<div class="ch-img">${img}</div><div class="ch-rarity">${'★'.repeat(c.rarity)}　${c.name}</div><div class="ch-meta">${TYPE_LABEL[c.type]||c.type}<br>HP ${c.baseHp} / 攻撃 ${Math.round(c.attackMultiplier*100)}%<br>${c.description}<br>${p?`Lv.${p.level} / 凸${p.breakthrough} / 所持 ${p.owned}`:'未所持'}</div>`;
      const actions=document.createElement('div'); actions.className='ch-actions';
      if(row.owned){const b=document.createElement('button'); b.textContent=s.selected.id===c.id?'選択中':'選択'; b.disabled=s.selected.id===c.id; b.onclick=()=>{characterSystem.selectCharacter(c.id);}; actions.appendChild(b);}
      card.appendChild(actions); grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  _renderGacha(body) {
    const s=characterSystem.getSummary();
    const info=document.createElement('div'); info.className='ch-info'; info.innerHTML=`<div class="ch-row"><b>所持ガチャ石</b><b>💎 ${s.currency}</b></div><div class="ch-muted">1回 ${s.singleCost} / 10回 ${s.tenCost}（無料入手のみ）</div><div class="ch-muted">★5 3% / ★4 10% / ★3 27% / ★2 35% / ★1 25%</div>`; body.appendChild(info);
    const one=document.createElement('button'); one.className='ch-bigbtn'; one.textContent='🎲 1回引く（100）'; one.onclick=()=>this._pull(1); body.appendChild(one);
    const ten=document.createElement('button'); ten.className='ch-bigbtn'; ten.textContent='🎲 10回引く（900）'; ten.onclick=()=>this._pull(10); body.appendChild(ten);
  }

  _pull(count){
    try{const results=characterSystem.pull(count); this._showGachaResults(results);}catch(e){this._showToast(e.message);}
  }

  _showGachaResults(results){
    const body=this.root.querySelector('.ch-panel'); if(!body) return; const old=body.querySelector('.ch-result'); old?.remove(); const grid=document.createElement('div'); grid.className='ch-result';
    for(const r of results){const card=document.createElement('div'); card.className='ch-card'; card.innerHTML=`<div class="ch-rarity">${'★'.repeat(r.character.rarity)}</div><b>${r.character.name}</b><div class="ch-meta">${TYPE_LABEL[r.character.type]}<br>${r.duplicate?'重複：EXP +120 / 限界突破 +1':'新規獲得'}</div>`; grid.appendChild(card);} body.appendChild(grid);
  }

  _renderMissions(body){
    const s=characterSystem.getSummary();
    const addMission=(title,progress,max,claimed,claim)=>{const n=document.createElement('div');n.className='ch-mission';n.innerHTML=`<b>${title}</b><div class="ch-progress"><i style="width:${Math.min(100,progress/max*100)}%"></i></div><div class="ch-row"><span>${progress} / ${max}</span><button class="ch-actions" style="border:0;background:#51416f;color:#fff;border-radius:9px;padding:7px 9px;cursor:pointer" ${claimed||progress<max?'disabled':''}>${claimed?'受取済み':'受け取る'}</button></div>`;n.querySelector('button').onclick=()=>{claim();this._refreshModal();};body.appendChild(n);};
    addMission('デイリー：曲を3回クリア',s.missions.daily.progress,3,s.missions.daily.claimed,()=>characterSystem.claimDaily());
    addMission('ウィークリー：曲を10回クリア',s.missions.weekly.progress,10,s.missions.weekly.claimed,()=>characterSystem.claimWeekly());
    addMission('イベント：曲を7回クリア',s.event.progress,7,s.event.claimed,()=>characterSystem.claimEvent());
    addMission('ログインボーナス：今日の報酬',s.login.claimedToday?1:0,1,s.login.claimedToday,()=>characterSystem.claimLogin());
    const a=document.createElement('div');a.className='ch-info';a.innerHTML=`<b>実績</b><div class="ch-muted">初回クリア / 10曲クリア / 初フルコン / HARD以上クリアでガチャ石を獲得</div>`;body.appendChild(a);
  }

  _showToast(text){const n=document.createElement('div');n.className='ch-toast';n.textContent=text;this.root.appendChild(n);setTimeout(()=>n.remove(),2200);}
}
