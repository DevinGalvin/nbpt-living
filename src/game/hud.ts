import type { Landmark, WorldData } from '../world/types';
import { SEASON } from '../world/style';

// DOM HUD: street pill, landmark banner, help, attribution, virtual joystick.

const css = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; z-index: 10; }
#hud .pill {
  position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: rgba(24, 32, 42, 0.78); color: #f3f1e8; font-size: 13px; font-weight: 600;
  letter-spacing: 1.5px; padding: 7px 16px 7px 13px; border-radius: 16px;
  display: none; align-items: center; gap: 7px; white-space: nowrap;
}
#hud .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #e8c44f; }
#hud .banner {
  position: absolute; top: 58px; left: 50%; transform: translate(-50%, -8px);
  background: rgba(20, 28, 38, 0.84); border-radius: 12px; padding: 13px 34px 11px;
  text-align: center; opacity: 0; transition: opacity 0.45s ease, transform 0.45s ease;
  border-bottom: 2px solid #d8b94a;
}
#hud .banner.show { opacity: 1; transform: translate(-50%, 0); }
#hud .banner .name { font-family: Georgia, serif; font-size: 23px; color: #f6f3e8; letter-spacing: 0.5px; }
#hud .banner .sub { font-size: 12px; color: #d8cfa8; margin-top: 3px; letter-spacing: 1px; }
#hud .corner { position: absolute; font-size: 11px; color: rgba(30, 34, 30, 0.85); bottom: 6px;
  text-shadow: 0 1px 2px rgba(255,255,255,0.5); }
#hud .help { left: 8px; }
#hud .attr { right: 8px; font-size: 10px; }
#hud .stick-base, #hud .stick-knob { position: absolute; border-radius: 50%; display: none; }
#hud .stick-base { width: 96px; height: 96px; background: rgba(20, 28, 38, 0.22); border: 2px solid rgba(243,241,232,0.5); }
#hud .stick-knob { width: 44px; height: 44px; background: rgba(243,241,232,0.55); }
#hud .compass {
  position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.65); border: 1.5px solid rgba(243,241,232,0.4);
  display: flex; align-items: center; justify-content: center;
}
#hud .compass .needle { font-size: 15px; font-weight: 700; color: #f0d27a; will-change: transform; }
#hud .travel-btn {
  position: absolute; top: 14px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.65); border: 1.5px solid rgba(243,241,232,0.4);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer;
}
#hud .sound-btn {
  position: absolute; top: 66px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.65); border: 1.5px solid rgba(243,241,232,0.4);
  display: flex; align-items: center; justify-content: center; font-size: 19px;
  pointer-events: auto; cursor: pointer;
}
#hud .sound-btn.off { opacity: 0.55; }
#hud .run-btn {
  position: absolute; right: 18px; bottom: 52px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.65); border: 2px solid rgba(243,241,232,0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .run-btn.show { display: flex; }
#hud .run-btn.on { background: rgba(216, 185, 74, 0.45); border-color: #e8c44f; }
#hud .bike-btn {
  position: absolute; right: 18px; bottom: 192px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.65); border: 2px solid rgba(243,241,232,0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .bike-btn.show { display: flex; }
#hud .bike-btn.on { background: rgba(216, 185, 74, 0.45); border-color: #e8c44f; }
#hud .travel-panel {
  position: absolute; inset: 0; background: rgba(12, 17, 24, 0.72); z-index: 60;
  display: none; align-items: center; justify-content: center; pointer-events: auto;
}
#hud .travel-panel.open { display: flex; }
#hud .travel-card {
  position: relative;
  background: rgba(22, 29, 38, 0.97); border-radius: 14px; border-bottom: 3px solid #d8b94a;
  padding: 18px 20px 14px; width: min(560px, 92vw); max-height: 78vh; overflow-y: auto;
}
/* a tappable close on every modal card — mobile has little backdrop to tap */
#hud .modal-x {
  position: absolute; top: 8px; right: 10px; width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;
  color: #cdbf94; background: rgba(0, 0, 0, 0.3); cursor: pointer; z-index: 3;
  user-select: none; -webkit-user-select: none;
}
/* the objective pill steps aside whenever a panel, card, or landmark banner is up */
#hud:has(.travel-panel.open) .objective,
#hud:has(.journey-panel[style*="flex"]) .objective,
#hud:has(.hcard.open) .objective,
#hud:has(.banner.show) .objective { display: none !important; }
#hud .travel-card h2 {
  font-family: Georgia, serif; color: #f6f3e8; font-size: 21px; margin: 0 0 12px;
  letter-spacing: 1px; text-align: center;
}
#hud .travel-search {
  width: 100%; box-sizing: border-box; margin: 0 0 10px; padding: 10px 13px;
  font: 600 15px system-ui, sans-serif; color: #f3f1e8;
  background: rgba(243, 241, 232, 0.09); border: 1px solid rgba(243, 241, 232, 0.25);
  border-radius: 9px; outline: none;
}
#hud .travel-search:focus { border-color: #d8b94a; }
#hud .travel-search::placeholder { color: rgba(216, 207, 168, 0.55); }
#hud .travel-results { display: none; flex-direction: column; gap: 6px; margin-bottom: 12px; }
#hud .travel-results.has { display: flex; }
#hud .travel-results .travel-item.sel { background: rgba(216, 185, 74, 0.24); }
#hud .travel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#hud .travel-item {
  background: rgba(243, 241, 232, 0.07); border: 1px solid rgba(243, 241, 232, 0.14);
  border-radius: 9px; padding: 9px 12px; cursor: pointer; transition: background 0.15s;
}
#hud .travel-item:hover { background: rgba(216, 185, 74, 0.18); }
#hud .travel-item .tn { color: #f3f1e8; font-size: 14px; font-weight: 600; }
#hud .travel-item .ts { color: #c8bd96; font-size: 11px; margin-top: 2px; }
#hud .season-row { display: flex; gap: 8px; margin: 0 0 12px; }
#hud .season-btn {
  flex: 1; text-align: center; padding: 9px 4px; border-radius: 9px; cursor: pointer;
  background: rgba(243, 241, 232, 0.07); border: 1px solid rgba(243, 241, 232, 0.14);
  color: #f3f1e8; font-size: 13px; font-weight: 600; transition: background 0.15s;
}
#hud .season-btn:hover { background: rgba(216, 185, 74, 0.18); }
#hud .season-btn.cur { background: rgba(216, 185, 74, 0.24); border-color: #d8b94a; }
#hud .fade {
  position: absolute; inset: 0; background: #0c1118; opacity: 0; pointer-events: none;
  transition: opacity 0.22s ease;
}
#hud .fade.on { opacity: 1; }
#hud .vignette {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center, transparent 38%, rgba(3, 5, 9, 0.66) 100%);
  transition: opacity 0.7s ease;
}
#hud .vignette.on { opacity: 1; }
#hud .hcard {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -52%);
  width: min(520px, 92vw); background: rgba(22, 28, 37, 0.97); border-radius: 14px;
  border-bottom: 3px solid #d8b94a; padding: 20px 22px 14px; display: none;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
}
#hud .hcard.open { display: block; }
#hud .hcard .ht { font-family: Georgia, serif; font-size: 24px; color: #f6f3e8; }
#hud .hcard .hy { font-size: 11.5px; letter-spacing: 2px; color: #e8c44f; font-weight: 700; text-transform: uppercase; margin: 3px 0 12px; }
#hud .hcard .hb { font-size: 15px; line-height: 1.6; color: #e8e4d8; white-space: pre-line; }
#hud .hcard .hf { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
#hud .hcard .stamp { font-size: 11px; letter-spacing: 1.8px; color: #e8c44f; font-weight: 800; }
#hud .hcard .close { font-size: 10.5px; color: #c8bd96; letter-spacing: 1px; }
#hud .hist-line { text-align: center; font-size: 12.5px; color: #c8bd96; margin-top: 12px; letter-spacing: 0.5px; }
#hud .hist-line b { color: #e8c44f; }
#hud .mini {
  position: absolute; top: 70px; right: 14px; opacity: 0.55; border-radius: 8px;
  overflow: hidden; border: 1px solid rgba(243, 241, 232, 0.35); pointer-events: none;
}
#hud .mini canvas { display: block; }
#hud .mini .me {
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  background: #ff2b2b; transform: translate(-50%, -50%);
  animation: nbpt-meping 1.5s ease-out infinite;
}
@keyframes nbpt-meping {
  0%   { box-shadow: 0 0 4px 1px rgba(255,43,43,0.95), 0 0 0 0 rgba(255,43,43,0.55); }
  70%  { box-shadow: 0 0 4px 1px rgba(255,43,43,0.95), 0 0 0 9px rgba(255,43,43,0); }
  100% { box-shadow: 0 0 4px 1px rgba(255,43,43,0.95), 0 0 0 0 rgba(255,43,43,0); }
}
#hud .objective {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  background: rgba(24, 32, 42, 0.84); border: 1px solid rgba(216, 185, 74, 0.55);
  color: #f3f1e8; font-size: 12.5px; font-weight: 600; letter-spacing: 0.4px;
  padding: 8px 15px; border-radius: 16px; display: none; align-items: center; gap: 8px;
  max-width: 70vw; text-align: center; pointer-events: auto; cursor: pointer;
  user-select: none; -webkit-user-select: none;
}
#hud .objective.show { display: flex; }
#hud .objective .q { color: #e8c44f; font-weight: 800; }
#hud .objective.min { padding: 8px 11px; opacity: 0.75; }
#hud .objective.min .otxt { display: none; }
#hud .dlg {
  position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%);
  width: min(580px, 93vw); background: rgba(20, 27, 36, 0.96); border-radius: 13px;
  border-bottom: 3px solid #d8b94a; padding: 13px 17px 9px; display: none;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .dlg.open { display: block; }
#hud .dlg .who { font-size: 11.5px; letter-spacing: 1.6px; color: #e8c44f; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; min-height: 13px; }
#hud .dlg .line { font-size: 15.5px; line-height: 1.45; color: #f3f1e8; min-height: 46px; }
#hud .dlg .more { text-align: right; font-size: 10.5px; color: #c8bd96; margin-top: 2px; letter-spacing: 1px; }
#hud .talk-btn {
  position: absolute; right: 18px; bottom: 122px; min-width: 58px; height: 58px;
  border-radius: 29px; background: rgba(216, 185, 74, 0.92); color: #1c2430;
  border: 2px solid #f0d27a; display: none; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; letter-spacing: 1px; padding: 0 16px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .talk-btn.show { display: flex; }
#hud .journey-btn {
  position: absolute; top: 118px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(20, 28, 38, 0.78); border: 1.5px solid rgba(216,185,74,0.6);
  display: flex; align-items: center; justify-content: center; font-size: 22px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
#hud .journey-btn:hover { border-color: #e8c44f; }
/* collected items hang beneath the compass as one connected "adventure log" rail */
#hud .chips {
  position: absolute; top: 150px; left: 14px; width: 44px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 22px 0 9px; border-radius: 0 0 22px 22px;
  background: linear-gradient(rgba(20,28,38,0) 12px, rgba(20,28,38,0.5) 30px);
  pointer-events: auto; cursor: pointer;
}
#hud .chips:empty { display: none; }
#hud .chips .chip {
  width: 34px; height: 34px; border-radius: 50%; background: rgba(20, 28, 38, 0.85);
  border: 1.5px solid rgba(216, 185, 74, 0.42); display: flex; align-items: center;
  justify-content: center; font-size: 17px; transition: transform 0.12s ease, border-color 0.12s ease;
}
#hud .chips:hover .chip { border-color: rgba(216, 185, 74, 0.8); }
#hud .chips .chip:hover { transform: scale(1.09); }
#hud .chips .chip.new { animation: nbpt-chippop 0.5s ease-out; }
@keyframes nbpt-chippop {
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); }
}
#hud .chapter {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 0 22px; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(10, 14, 20, 0.84), rgba(10, 14, 20, 0.96));
  opacity: 0; transition: opacity 0.45s ease;
}
#hud .chapter.show { opacity: 1; }
#hud .chapter .kick { font-size: 13px; letter-spacing: 4px; color: #e8c44f; font-weight: 700; margin-bottom: 10px; }
#hud .chapter .big { font-family: Georgia, serif; font-size: clamp(30px, 6vw, 46px); color: #f6f3e8; }
#hud .chapter .small { font-size: 13px; color: #c8bd96; margin-top: 12px; letter-spacing: 1px; }
`;

export class Hud {
  joyActive = false;
  joyX = 0;
  joyY = 0;
  sprintTouch = false;

  // live player position + active beacon target — read by the journey panel's
  // direction hint (set by Game each frame / by the quest when the goal moves)
  pos: { x: number; y: number } | null = null;
  guide: { x: number; z: number } | null = null;
  // true while rowing the boat out at low tide (Chapter 4) — quest UI keys off it
  boating = false;

  private dlgEl!: HTMLElement;
  private dlgWho!: HTMLElement;
  private dlgLine!: HTMLElement;
  private dlgLines: { who: string; text: string }[] = [];
  private dlgIdx = 0;
  private dlgDone: (() => void) | null = null;
  private dlgCool = 0;
  private talkCb: (() => void) | null = null;
  private hcardOpen = false;
  private openJourney: (() => void) | null = null;   // set by initJourney; chips tap it
  private chipKeys: string[] = [];                    // last-rendered chips (for pop-in)

  private pill: HTMLElement;
  private banner: HTMLElement;
  private bannerName: HTMLElement;
  private bannerSub: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private lastShown = new Map<string, number>();
  private joyId = -1;
  private joyBaseX = 0;
  private joyBaseY = 0;
  private bannerTimer = 0;
  private pointers = new Set<number>();

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div class="pill"><span class="dot"></span><span class="txt"></span></div>
      <div class="banner"><div class="name"></div><div class="sub"></div></div>
      <div class="corner help">WASD / arrows · R run · Shift sprint · C camera · M travel &amp; search · wheel zoom</div>
      <div class="corner attr">Map data © OpenStreetMap contributors</div>
      <div class="stick-base"></div><div class="stick-knob"></div>
      <div class="compass"><div class="needle">N</div></div>
      <div class="travel-btn" title="Travel (M)">🗺</div>
      <div class="journey-btn" title="Adventure log (J)">🧭</div>
      <div class="sound-btn" title="Sound">🔊</div>
      <div class="run-btn" title="Run">🏃</div>
      <div class="bike-btn" title="Bike (B)">🚲</div>
      <div class="travel-panel"><div class="travel-card"><div class="modal-x">✕</div><h2>FAST TRAVEL</h2><input class="travel-search" type="text" placeholder="Go anywhere… try “241 High Street” or “The Grog”" /><div class="travel-results"></div><div class="travel-grid"></div></div></div>
      <div class="mini"><canvas></canvas><div class="me"></div></div>
      <div class="objective"><span class="q">◈</span><span class="otxt"></span></div>
      <div class="chips"></div>
      <div class="dlg"><div class="who"></div><div class="line"></div><div class="more">tap · E</div></div>
      <div class="talk-btn">💬 TALK</div>
      <div class="chapter"><div class="kick"></div><div class="big"></div><div class="small"></div></div>
      <div class="hcard"><div class="ht"></div><div class="hy"></div><div class="hb"></div><div class="hf"><div class="stamp">★ A TRUE STORY</div><div class="close">tap to close</div></div></div>
      <div class="vignette"></div>
      <div class="fade"></div>
    `;
    document.body.appendChild(hud);
    this.pill = hud.querySelector('.pill')!;
    this.banner = hud.querySelector('.banner')!;
    this.bannerName = hud.querySelector('.banner .name')!;
    this.bannerSub = hud.querySelector('.banner .sub')!;
    this.stickBase = hud.querySelector('.stick-base')!;
    this.stickKnob = hud.querySelector('.stick-knob')!;
    this.dlgEl = hud.querySelector('.dlg')!;
    this.dlgWho = hud.querySelector('.dlg .who')!;
    this.dlgLine = hud.querySelector('.dlg .line')!;

    this.dlgEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advanceDlg();
    });
    const hcard = hud.querySelector('.hcard') as HTMLElement;
    hcard.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      hcard.classList.remove('open');
      this.hcardOpen = false;
      this.dlgCool = performance.now() + 280;
    });
    // tap the objective pill to tuck the quest away (freelance mode is sacred)
    const obj = hud.querySelector('.objective') as HTMLElement;
    if (localStorage.getItem('nbpt-obj-min') === '1') obj.classList.add('min');
    obj.addEventListener('click', (e) => {
      e.stopPropagation();
      const min = obj.classList.toggle('min');
      localStorage.setItem('nbpt-obj-min', min ? '1' : '0');
    });

    const talk = hud.querySelector('.talk-btn') as HTMLElement;
    talk.addEventListener('click', (e) => {
      e.stopPropagation();
      this.talkCb?.();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.dlgEl.classList.contains('open')) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.advanceDlg();
      }
    });

    window.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private onDown(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    if ((e.target as HTMLElement)?.closest?.('.travel-btn, .travel-panel, .journey-btn, .journey-panel, .chips, .sound-btn, .run-btn, .bike-btn, .talk-btn, .dlg, .objective, .hcard')) return; // UI, not joystick
    this.pointers.add(e.pointerId);
    if (this.joyId === -1) {
      this.joyId = e.pointerId;
      this.joyBaseX = e.clientX;
      this.joyBaseY = e.clientY;
      this.joyActive = true;
      this.placeStick(e.clientX, e.clientY, e.clientX, e.clientY);
    } else {
      this.sprintTouch = true;
    }
  }

  private onMove(e: PointerEvent) {
    if (e.pointerId !== this.joyId) return;
    let dx = e.clientX - this.joyBaseX, dy = e.clientY - this.joyBaseY;
    const d = Math.hypot(dx, dy), max = 48;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.placeStick(this.joyBaseX, this.joyBaseY, this.joyBaseX + dx, this.joyBaseY + dy);
    const dead = 0.16;
    const mag = Math.min(1, Math.hypot(dx, dy) / max);
    if (mag < dead) { this.joyX = 0; this.joyY = 0; }
    else {
      const s = (mag - dead) / (1 - dead);
      const ang = Math.atan2(dy, dx);
      this.joyX = Math.cos(ang) * s;
      this.joyY = Math.sin(ang) * s;
    }
  }

  private onUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.joyId) {
      this.joyId = -1;
      this.joyActive = false;
      this.joyX = 0;
      this.joyY = 0;
      this.stickBase.style.display = 'none';
      this.stickKnob.style.display = 'none';
    }
    if (this.pointers.size <= 1) this.sprintTouch = false;
  }

  private placeStick(bx: number, by: number, kx: number, ky: number) {
    this.stickBase.style.display = 'block';
    this.stickKnob.style.display = 'block';
    this.stickBase.style.left = bx - 48 + 'px';
    this.stickBase.style.top = by - 48 + 'px';
    this.stickKnob.style.left = kx - 22 + 'px';
    this.stickKnob.style.top = ky - 22 + 'px';
  }

  private needle: HTMLElement | null = null;

  setCompass(rot: number) {
    if (!this.needle) this.needle = document.querySelector('#hud .compass .needle');
    if (this.needle) this.needle.style.transform = `rotate(${rot}rad)`;
  }

  // ---------- fast travel ----------

  initTravel(items: { id: string; name: string; sub: string }[], onPick: (id: string) => void) {
    const grid = document.querySelector('#hud .travel-grid')!;
    for (const it of items) {
      const el = document.createElement('div');
      el.className = 'travel-item';
      el.innerHTML = `<div class="tn">${it.name}</div><div class="ts">${it.sub}</div>`;
      el.addEventListener('click', () => {
        this.toggleTravel(false);
        onPick(it.id);
      });
      grid.appendChild(el);
    }
    // season picker — the town dresses for the calendar
    const card = document.querySelector('#hud .travel-card')!;
    const row = document.createElement('div');
    row.className = 'season-row';
    for (const [sn, label] of [['spring', '\u{1F338} Spring'], ['summer', '\u2600\uFE0F Summer'], ['fall', '\u{1F383} Fall'], ['winter', '\u{1F384} Winter']] as const) {
      const btn = document.createElement('div');
      btn.className = 'season-btn' + (SEASON === sn ? ' cur' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (SEASON === sn) return;
        localStorage.setItem('nbpt-season', sn);
        location.reload();
      });
      row.appendChild(btn);
    }
    card.insertBefore(row, card.querySelector('.travel-search'));
    const hist = document.createElement('div');
    hist.className = 'hist-line';
    card.appendChild(hist);
    // secrets line: invisible until the first one is found — that's the rule
    const egg = document.createElement('div');
    egg.className = 'hist-line egg-line';
    egg.style.display = 'none';
    card.appendChild(egg);

    document.querySelector('#hud .travel-btn')!.addEventListener('click', () => this.toggleTravel());
    const panel = document.querySelector('#hud .travel-panel')!;
    panel.addEventListener('click', (e) => {
      if (e.target === panel) this.toggleTravel(false);
    });
    (panel.querySelector('.modal-x') as HTMLElement)?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTravel(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.toggleTravel(false);
    });
  }

  toggleTravel(force?: boolean) {
    const panel = document.querySelector('#hud .travel-panel')!;
    const want = force !== undefined ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', want);
    const input = panel.querySelector('.travel-search') as HTMLInputElement | null;
    if (input) {
      if (want) setTimeout(() => input.focus(), 30);
      else {
        input.value = '';
        input.blur();
        this.renderResults([]);
      }
    }
  }

  // ---------- journey panel (📖 / J): the quest spine, a direction hint to the
  // active beacon, and an album of the history cards you've found ----------

  initJourney(markers: { id: string; title: string; year: string; body: string; stamp?: string }[]) {
    const jp = document.createElement('div');
    jp.className = 'journey-panel';
    jp.style.cssText = 'position:absolute;inset:0;background:rgba(12,17,24,0.72);display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:60;';
    const jc = document.createElement('div');
    jc.style.cssText = 'position:relative;width:min(420px,90vw);max-height:78vh;overflow:auto;background:#141b24;border-radius:14px;border-bottom:3px solid #d8b94a;padding:18px 20px 14px;color:#f3f1e8;';
    jc.innerHTML = '<div class="modal-x">✕</div><div style="font-size:14px;letter-spacing:3px;color:#e8c44f;font-weight:800;margin-bottom:10px;">YOUR JOURNEY</div>'
      + '<div class="j-obj" style="font-size:14.5px;line-height:1.5;margin-bottom:4px;"></div>'
      + '<div class="j-dir" style="font-size:12.5px;color:#9fb8cc;margin-bottom:14px;"></div>'
      + '<div class="j-ch" style="font-size:13px;line-height:2.1;color:#d9d2c0;margin-bottom:8px;"></div>'
      + '<div style="font-size:12px;letter-spacing:2px;color:#e8c44f;font-weight:800;margin:10px 0 8px;">HISTORY CARDS</div>'
      + '<div class="j-album" style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;"></div>';
    // the journey panel keeps its own history-read tally (the travel card has one too)
    const hl = document.createElement('div');
    hl.style.cssText = 'font-size:12.5px;color:#c8bd96;margin:4px 0 14px;';
    jc.appendChild(hl);
    // restart: a two-tap arm so a stray click can't wipe a save
    const rb = document.createElement('div');
    rb.textContent = '↺ Restart journey from the beginning';
    rb.style.cssText = 'text-align:center;padding:10px;border-radius:9px;border:1px solid rgba(216,90,74,0.5);color:#e8a89a;font-size:12.5px;letter-spacing:1px;cursor:pointer;user-select:none;-webkit-user-select:none;';
    rb.addEventListener('click', () => {
      if (rb.dataset.arm !== '1') {
        rb.dataset.arm = '1';
        rb.textContent = '⚠ Erase all progress and restart? Tap again';
        setTimeout(() => { rb.dataset.arm = '0'; rb.textContent = '↺ Restart journey from the beginning'; }, 3500);
        return;
      }
      for (const k of ['nbpt-ch0-step', 'nbpt-ch1-step', 'nbpt-ch1-carded', 'nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike', 'nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells', 'nbpt-historian', 'nbpt-history-read']) localStorage.removeItem(k);
      location.reload();
    });
    jc.appendChild(rb);
    jp.appendChild(jc);
    document.querySelector('#hud')!.appendChild(jp);
    (jc.querySelector('.modal-x') as HTMLElement).addEventListener('click', (e) => { e.stopPropagation(); jp.style.display = 'none'; });

    const num = (k: string) => parseInt(localStorage.getItem(k) || '0', 10) || 0;
    const st = (v: number, d: number) => v >= d
      ? '<span style="color:#9ec98a">✓ complete</span>'
      : v > 0 ? '<span style="color:#e8c44f">● in progress</span>'
              : '<span style="color:#8b8678">○ not started</span>';
    // a per-chapter "replay" chip that clears that chapter onward (two-tap armed)
    const rp = (cN: number, go: boolean) => go
      ? ' <span data-c="' + cN + '" style="color:#8fa8bc;cursor:pointer;font-size:11px;border:1px solid rgba(143,168,188,0.35);border-radius:6px;padding:0 5px;">↻ replay</span>'
      : '';

    const jt = () => {
      const s0 = num('nbpt-ch0-step'), s1 = num('nbpt-ch1-step'), s2 = num('nbpt-ch2-step'), s3 = num('nbpt-ch3-step'), s4 = num('nbpt-ch4-step');
      let sd = 0;
      try { sd = (JSON.parse(localStorage.getItem('nbpt-ch2-stops') || '[]') as unknown[]).length; } catch { /* ignore */ }
      const objTxt = (document.querySelector('#hud .objective .otxt') as HTMLElement | null)?.textContent || '';
      (jc.querySelector('.j-obj') as HTMLElement).textContent = '\u{1F9ED} ' + (objTxt || 'Walk out the door and explore.');
      // direction hint to the active beacon (the beam of light)
      let dl = '';
      if (this.guide && this.pos) {
        const dx = this.guide.x - this.pos.x, dz = this.guide.z - this.pos.y;
        const dm = Math.round(Math.hypot(dx, dz) / 8 / 10) * 10;
        const oc = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round((((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360) / 45) % 8];
        dl = dm < 30
          ? '\u{1F4CD} You’re right there — look for the beam of light.'
          : '\u{1F4CD} About ' + dm + ' m to the ' + oc + ' — the beam of light marks the spot.';
      }
      (jc.querySelector('.j-dir') as HTMLElement).textContent = dl;
      (jc.querySelector('.j-ch') as HTMLElement).innerHTML =
        'CHAPTER 1 · Overdue — ' + st(s0, 6) + rp(0, s0 > 0)
        + '<br>CHAPTER 2 · The Door Under Downtown — ' + st(s1, 6) + rp(1, s1 > 0)
        + '<br>CHAPTER 3 · The Daily News — '
          + (s2 >= 4 ? st(4, 4) : s2 > 0 ? '<span style="color:#e8c44f">● in progress' + (sd ? ' · ' + sd + ' papers delivered' : '') + '</span>' : st(0, 1))
          + rp(2, s2 > 0)
        + '<br>CHAPTER 4 · Low Water — '
          + (s3 >= 4 ? st(4, 4) : (s2 >= 4 || s3 > 0) ? '<span style="color:#e8c44f">● in progress</span>' : st(0, 1))
          + rp(3, s3 > 0)
        + '<br>CHAPTER 5 · The Custom House Star — '
          + (s4 >= 4 ? st(4, 4) : (s3 >= 4 || s4 > 0) ? '<span style="color:#e8c44f">● in progress</span>' : st(0, 1))
          + rp(4, s4 > 0);
      (jc.querySelector('.j-ch') as HTMLElement).onclick = (ev) => {
        const tg = ev.target as HTMLElement;
        const cN = tg && tg.dataset ? tg.dataset.c : null;
        if (cN == null) return;
        ev.stopPropagation();
        if (tg.dataset.arm !== '1') {
          tg.dataset.arm = '1';
          tg.textContent = '↻ tap again';
          setTimeout(() => { tg.dataset.arm = '0'; tg.textContent = '↻ replay'; }, 3000);
          return;
        }
        const cascade = [
          ['nbpt-ch0-step', 'nbpt-ch1-step', 'nbpt-ch1-carded', 'nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike', 'nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells'],
          ['nbpt-ch1-step', 'nbpt-ch1-carded', 'nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike', 'nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells'],
          ['nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike', 'nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells'],
          ['nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells'],
          ['nbpt-ch4-step', 'nbpt-ch4-bells']
        ][+cN];
        for (const kk of cascade) localStorage.removeItem(kk);
        location.reload();
      };
      // history-card album: found ones are gold + tappable, the rest are "???"
      const al = jc.querySelector('.j-album') as HTMLElement;
      al.innerHTML = '';
      let rd: Set<string>;
      try { rd = new Set(JSON.parse(localStorage.getItem('nbpt-history-read') || '[]')); } catch { rd = new Set(); }
      hl.innerHTML = rd.size >= markers.length
        ? '\u{1F3DB} <b style="color:#ffd86a">Town Historian — ' + rd.size + '/' + markers.length + '</b>'
        : '\u{1F3DB} History markers read: <b>' + rd.size + '/' + markers.length + '</b>';
      for (const mk of markers) {
        const got = rd.has(mk.id);
        const cd = document.createElement('div');
        cd.style.cssText = 'flex:1 1 31%;min-width:96px;border-radius:8px;padding:7px 8px;font-size:11px;line-height:1.35;cursor:' + (got ? 'pointer' : 'default') + ';border:1px solid ' + (got ? 'rgba(216,185,74,0.55)' : 'rgba(140,134,120,0.3)') + ';color:' + (got ? '#f3f1e8' : '#6e6a5e') + ';background:' + (got ? 'rgba(216,185,74,0.08)' : 'rgba(20,27,36,0.5)');
        cd.innerHTML = got
          ? '<div style="font-weight:700;">' + mk.title + '</div><div style="color:#c8bd96;">' + mk.year + '</div>'
          : '<div style="font-weight:700;">???</div><div>undiscovered</div>';
        if (got) cd.addEventListener('click', () => {
          jp.style.display = 'none';
          this.historyCard(mk.title, mk.year + ' · Newburyport', mk.body, mk.stamp);
        });
        al.appendChild(cd);
      }
      jp.style.display = 'flex';
    };

    const open = () => { if (jp.style.display === 'flex') jp.style.display = 'none'; else jt(); };
    this.openJourney = open;
    document.querySelector('#hud .journey-btn')!.addEventListener('click', open);
    // the collected-item chips are part of the same log — tapping them opens it
    document.querySelector('#hud .chips')!.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    jp.addEventListener('click', (ev) => { if (ev.target === jp) jp.style.display = 'none'; });
    window.addEventListener('keydown', (ev) => {
      if (jp.style.display === 'flex' && (ev.code === 'Escape' || ev.code === 'KeyJ')) { jp.style.display = 'none'; return; }
      if (ev.code === 'KeyJ' && (ev.target as HTMLElement)?.tagName !== 'INPUT') jt();
    });
  }

  // ---------- sound toggle ----------

  initSound(on: boolean, onToggle: () => boolean) {
    const btn = document.querySelector('#hud .sound-btn') as HTMLElement;
    const paint = (en: boolean) => {
      btn.textContent = en ? '🔊' : '🔇';
      btn.classList.toggle('off', !en);
    };
    paint(on);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      paint(onToggle());
    });
  }

  // ---------- run toggle (shown on touch devices; R does the same on keys) ----------

  initRun(onToggle: () => boolean) {
    const btn = document.querySelector('#hud .run-btn') as HTMLElement;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (touch) btn.classList.add('show');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setRunState(onToggle());
    });
  }

  // bike toggle: appears once the bike is earned (B does the same on keys)
  initBike(onToggle: () => boolean) {
    const btn = document.querySelector('#hud .bike-btn') as HTMLElement;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setBikeState(onToggle());
    });
  }

  showBike(show: boolean) {
    (document.querySelector('#hud .bike-btn') as HTMLElement).classList.toggle('show', show);
  }

  setBikeState(on: boolean) {
    (document.querySelector('#hud .bike-btn') as HTMLElement).classList.toggle('on', on);
  }

  setRunState(on: boolean) {
    const btn = document.querySelector('#hud .run-btn') as HTMLElement | null;
    btn?.classList.toggle('on', on);
  }

  // ---------- address bar ----------

  private searchResults: { label: string; sub: string; x: number; y: number }[] = [];
  private searchSel = 0;
  private onSearchPick: ((r: { label: string; sub: string; x: number; y: number }) => void) | null = null;

  initSearch(
    query: (q: string) => { label: string; sub: string; x: number; y: number }[],
    onPick: (r: { label: string; sub: string; x: number; y: number }) => void
  ) {
    this.onSearchPick = onPick;
    const input = document.querySelector('#hud .travel-search') as HTMLInputElement;
    input.addEventListener('input', () => {
      this.searchSel = 0;
      this.renderResults(query(input.value));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.searchResults.length) {
        e.preventDefault();
        this.pickResult(this.searchResults[Math.min(this.searchSel, this.searchResults.length - 1)]);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = this.searchResults.length;
        if (n) {
          this.searchSel = (this.searchSel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
          this.renderResults(this.searchResults);
        }
      } else if (e.key === 'Escape') {
        this.toggleTravel(false);
      }
      e.stopPropagation();
    });
  }

  private pickResult(r: { label: string; sub: string; x: number; y: number }) {
    this.toggleTravel(false);
    this.onSearchPick?.(r);
  }

  private renderResults(results: { label: string; sub: string; x: number; y: number }[]) {
    this.searchResults = results;
    const box = document.querySelector('#hud .travel-results')!;
    box.classList.toggle('has', results.length > 0);
    box.innerHTML = '';
    results.forEach((r, i) => {
      const el = document.createElement('div');
      el.className = 'travel-item' + (i === this.searchSel ? ' sel' : '');
      el.innerHTML = `<div class="tn"></div><div class="ts"></div>`;
      (el.querySelector('.tn') as HTMLElement).textContent = r.label;
      (el.querySelector('.ts') as HTMLElement).textContent = r.sub;
      el.addEventListener('click', () => this.pickResult(r));
      box.appendChild(el);
    });
  }

  // ---------- minimap (subtle full-city overview + you-are-here dot) ----------

  private miniScale = 0;
  private miniMinX = 0;
  private miniMinY = 0;
  private miniDot: HTMLElement | null = null;

  initMinimap(world: WorldData) {
    // phones: the 190px overlay covers half the screen, and the travel map
    // (🗺 / M) already has the full city — skip the minimap on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      (document.querySelector('#hud .mini') as HTMLElement).style.display = 'none';
      return;
    }
    const b = world.meta.bounds;
    const W = 190;
    const H = Math.max(60, Math.round((W * (b.maxY - b.minY)) / (b.maxX - b.minX)));
    const canvas = document.querySelector('#hud .mini canvas') as HTMLCanvasElement;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;
    const s = Math.min(W / (b.maxX - b.minX), H / (b.maxY - b.minY));
    this.miniScale = s;
    this.miniMinX = b.minX;
    this.miniMinY = b.minY;
    this.miniDot = document.querySelector('#hud .mini .me');

    g.fillStyle = '#b3ba90';
    g.fillRect(0, 0, W, H);
    const tracePoly = (p: number[], holes?: number[][]) => {
      g.beginPath();
      g.moveTo((p[0] - b.minX) * s, (p[1] - b.minY) * s);
      for (let i = 2; i < p.length; i += 2) g.lineTo((p[i] - b.minX) * s, (p[i + 1] - b.minY) * s);
      g.closePath();
      if (holes) {
        for (const h of holes) {
          g.moveTo((h[0] - b.minX) * s, (h[1] - b.minY) * s);
          for (let i = 2; i < h.length; i += 2) g.lineTo((h[i] - b.minX) * s, (h[i + 1] - b.minY) * s);
          g.closePath();
        }
      }
    };
    for (const poly of world.polys) {
      if (poly.k === 'sand' || poly.k === 'island') {
        g.fillStyle = '#dcd0a2';
        tracePoly(poly.p, poly.h);
        g.fill('evenodd');
      }
    }
    for (const poly of world.polys) {
      if (poly.k === 'water' || poly.k === 'ocean') {
        g.fillStyle = '#7099b8';
        tracePoly(poly.p, poly.h);
        g.fill('evenodd');
      }
    }
    g.lineWidth = 0.7;
    g.strokeStyle = 'rgba(72, 74, 78, 0.65)';
    for (const r of world.roads) {
      if (r.c === 'service') continue;
      g.lineWidth = r.c === 'primary' || r.c === 'trunk' || r.c === 'secondary' ? 1.2 : 0.7;
      g.beginPath();
      g.moveTo((r.p[0] - b.minX) * s, (r.p[1] - b.minY) * s);
      for (let i = 2; i < r.p.length; i += 2) g.lineTo((r.p[i] - b.minX) * s, (r.p[i + 1] - b.minY) * s);
      g.stroke();
    }
  }

  setMiniPos(x: number, z: number) {
    if (!this.miniDot || !this.miniScale) return;
    this.miniDot.style.left = (x - this.miniMinX) * this.miniScale + 'px';
    this.miniDot.style.top = (z - this.miniMinY) * this.miniScale + 'px';
  }

  // ---------- quest UI: dialogue, objective pill, talk button, item chips ----------

  // true while a dialogue is showing (plus a short grace so the closing
  // keypress doesn't immediately re-trigger an interact)
  get dialogueOpen(): boolean {
    return this.dlgEl.classList.contains('open') || this.hcardOpen || performance.now() < this.dlgCool;
  }

  // plaque reader: serif card with the true-story stamp
  historyCard(title: string, year: string, body: string, stamp?: string) {
    const el = document.querySelector('#hud .hcard') as HTMLElement;
    (el.querySelector('.ht') as HTMLElement).textContent = title;
    (el.querySelector('.hy') as HTMLElement).textContent = year;
    (el.querySelector('.hb') as HTMLElement).textContent = body;
    (el.querySelector('.stamp') as HTMLElement).textContent = stamp || '★ A TRUE STORY';
    el.classList.add('open');
    this.hcardOpen = true;
  }

  // the secret count stays hidden until something has been found
  setSecretCount(found: number, total: number) {
    const el = document.querySelector('#hud .egg-line') as HTMLElement | null;
    if (!el) return;
    if (found <= 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.innerHTML = found >= total
      ? '✦ <b style="color:#ffd86a">Town Legend — every secret found · ' + found + '/' + total + '</b>'
      : '✦ Secrets found: <b>' + found + '/' + total + '</b>';
  }

  setHistoryCount(read: number, total: number) {
    const el = document.querySelector('#hud .hist-line') as HTMLElement | null;
    if (el) {
      el.innerHTML = read >= total
        ? '\u{1F3DB} <b style="color:#ffd86a">Town Historian \u2014 ' + read + '/' + total + '</b>'
        : '\u{1F3DB} History markers read: <b>' + read + '/' + total + '</b>';
    }
  }

  showDialogue(lines: { who: string; text: string }[], onDone?: () => void) {
    this.dlgLines = lines;
    this.dlgIdx = 0;
    this.dlgDone = onDone || null;
    this.dlgEl.classList.add('open');
    this.renderDlg();
  }

  private renderDlg() {
    const l = this.dlgLines[this.dlgIdx];
    this.dlgWho.textContent = l.who;
    this.dlgLine.textContent = l.text;
  }

  private advanceDlg() {
    if (!this.dlgEl.classList.contains('open')) return;
    this.dlgIdx++;
    if (this.dlgIdx < this.dlgLines.length) {
      this.renderDlg();
      return;
    }
    this.dlgEl.classList.remove('open');
    this.dlgCool = performance.now() + 280;
    const done = this.dlgDone;
    this.dlgDone = null;
    done?.();
  }

  showTalk(label: string | null, cb?: () => void) {
    const btn = document.querySelector('#hud .talk-btn') as HTMLElement;
    if (!label) {
      btn.classList.remove('show');
      this.talkCb = null;
      return;
    }
    btn.textContent = label;
    btn.classList.add('show');
    this.talkCb = cb || null;
  }

  setObjective(text: string | null) {
    const el = document.querySelector('#hud .objective') as HTMLElement;
    if (!text) {
      el.classList.remove('show');
      return;
    }
    (el.querySelector('.otxt') as HTMLElement).textContent = text;
    el.classList.add('show');
  }

  setChips(emojis: string[]) {
    const wrap = document.querySelector('#hud .chips') as HTMLElement;
    const prev = this.chipKeys;
    // a chip that wasn't here last render pops in; all chips open the log on tap
    wrap.innerHTML = emojis.map((e, i) =>
      `<div class="chip${(i >= prev.length || prev[i] !== e) ? ' new' : ''}" title="Open your adventure log (J)">${e}</div>`
    ).join('');
    this.chipKeys = emojis.slice();
  }

  // big serif chapter card: fades in, holds, fades out
  chapterCard(kick: string, big: string, small: string) {
    const el = document.querySelector('#hud .chapter') as HTMLElement;
    (el.querySelector('.kick') as HTMLElement).textContent = kick;
    (el.querySelector('.big') as HTMLElement).textContent = big;
    (el.querySelector('.small') as HTMLElement).textContent = small;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2700);
  }

  // tunnel-dark edges while underground
  setVignette(on: boolean) {
    (document.querySelector('#hud .vignette') as HTMLElement).classList.toggle('on', on);
  }

  // quick fade to black around a teleport
  fadeThrough(action: () => void) {
    const fade = document.querySelector('#hud .fade')!;
    fade.classList.add('on');
    setTimeout(() => {
      action();
      setTimeout(() => fade.classList.remove('on'), 120);
    }, 230);
  }

  setStreet(name: string | null) {
    const txt = this.pill.querySelector('.txt') as HTMLElement;
    if (!name) {
      this.pill.style.display = 'none';
      return;
    }
    const label = name.toUpperCase();
    if (txt.textContent !== label) txt.textContent = label;
    this.pill.style.display = 'flex';
  }

  maybeShowLandmark(lm: Landmark): boolean {
    const now = performance.now();
    const last = this.lastShown.get(lm.id) || -1e9;
    if (now - last < 90_000) return false;
    this.lastShown.set(lm.id, now);
    this.bannerName.textContent = lm.name;
    this.bannerSub.textContent = lm.sub;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 3400);
    return true;
  }
}
