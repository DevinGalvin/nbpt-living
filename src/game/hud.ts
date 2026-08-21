import type { Landmark, WorldData } from '../world/types';
import type { BagItem, Mission } from './items';
import { SEASON, seasonsUnlocked } from '../world/style';

// DOM HUD: street pill, landmark banner, help, attribution, virtual joystick.

import { TOWN } from '@town';
import { TOWNS } from '../towns/registry';
import { loadShot } from './shots';

// marker titles are authored copy, but they land in innerHTML — keep them literal
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Entrance stagger for any JS-built list — tiles land one after another instead of all
// existing at once. Capped at 14 steps: past that the wave is off the bottom of the
// screen and the tail only reads as lag. The animation itself is nbpt-tile-in, in the
// LIVELY layer at the foot of the stylesheet; this just hands out the delays.
// Call it after filling a container, and a new panel gets the wave for free.
const stagger = (host: Element | HTMLElement[], step = 0.028) => {
  const kids = Array.isArray(host) ? host : (Array.from(host.children) as HTMLElement[]);
  kids.forEach((el, i) => { el.style.animationDelay = Math.min(i, 14) * step + 's'; });
};

const css = `
/* ── Town theme tokens ─────────────────────────────────────────────
   Per-town (src/towns/<id>/index.ts): Newburyport = maroon + gold, Salem =
   plum + amber. The radius/shadow/motion scale below is shared chrome. */
:root {
  --panel: ${TOWN.theme.panel};
  --maroon: ${TOWN.theme.maroon};      /* chrome chips / buttons (use as rgba(var(--maroon), a)) */
  --maroon-lt: ${TOWN.theme.maroonLt};   /* lighter chips & cards */
  /* gold scale — one source of truth for every accent (was 3 stray literals) */
  --gold-rgb: ${TOWN.theme.goldRgb};
  --gold: ${TOWN.theme.gold};           /* base accent (underlines, borders) */
  --gold-mid: ${TOWN.theme.goldMid};       /* labels / kickers */
  --gold-bright: ${TOWN.theme.goldBright};    /* brightest highlight / hovers */
  /* ink (text on the dark panels) — shared, NOT per-town: paper is paper */
  --ink: #f3f1e8;
  --ink-rgb: 243, 241, 232;   /* for rgba(var(--ink-rgb), a) */
  --ink-dim: #c8bd96;
  /* shared chrome: round HUD buttons */
  --chrome-bg: rgba(var(--maroon), 0.6);
  --chrome-bd: rgba(var(--ink-rgb), 0.4);
  /* radius scale */
  --r-sm: 9px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;
  /* material */
  --blur: saturate(1.15) blur(7px);
  --scrim: rgba(8, 12, 20, 0.6);
  --shadow-btn: 0 3px 10px rgba(0, 0, 0, 0.4);
  --shadow-card: 0 20px 56px rgba(0, 0, 0, 0.52), 0 2px 0 rgba(255, 240, 210, 0.06) inset;
  --shadow-pill: 0 4px 16px rgba(0, 0, 0, 0.38);
  /* motion */
  --ease-spring: cubic-bezier(0.2, 0.85, 0.3, 1.12);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-pop: cubic-bezier(0.2, 1.25, 0.4, 1);   /* overshoots — the "tile lands" feel */
}
#hud { position: fixed; pointer-events: none; font-family: system-ui, sans-serif; z-index: 10;
  top: env(safe-area-inset-top, 0px); right: env(safe-area-inset-right, 0px);
  bottom: env(safe-area-inset-bottom, 0px); left: env(safe-area-inset-left, 0px); }
#hud .pill {
  position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: rgba(var(--maroon-lt), 0.78); color: var(--ink); font-size: 13px; font-weight: 600;
  letter-spacing: 1.5px; padding: 7px 16px 7px 13px; border-radius: 16px;
  display: none; align-items: center; gap: 7px; white-space: nowrap;
}
#hud .pill .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gold-mid); }
#hud .banner {
  position: absolute; top: 58px; left: 50%; transform: translate(-50%, -8px);
  background: rgba(var(--maroon), 0.84); border-radius: 12px; padding: 13px 34px 11px;
  text-align: center; opacity: 0; transition: opacity 0.45s ease, transform 0.45s ease;
  border-bottom: 2px solid var(--gold);
}
#hud .banner.show { opacity: 1; transform: translate(-50%, 0); }
#hud .banner .name { font-family: Georgia, serif; font-size: 23px; color: var(--ink); letter-spacing: 0.5px; }
#hud .banner .sub { font-size: 12px; color: #d8cfa8; margin-top: 3px; letter-spacing: 1px; }
#hud .corner { position: absolute; font-size: 11px; color: rgba(var(--ink-rgb), 0.9); bottom: 6px;
  text-shadow: 0 1px 3px rgba(20, 10, 14, 0.9), 0 0 6px rgba(20, 10, 14, 0.55); }
#hud .help { left: 8px; }
#hud .attr { right: 8px; font-size: 10px; }
/* phones: no instruction line at all (Devin: "too distracting" — the controls ARE
   on screen); the OSM attribution must stay (ODbL license) but goes whisper-quiet */
#hud.touch .help { display: none; }
#hud.touch .attr { font-size: 8.5px; opacity: 0.55; }
/* tiny always-on word under every icon-only button — 🧭 vs 🗺 vs 🎒 is a coin-flip
   for a 6-year-old (and TALK, our one labeled button, was always the clearest).
   Worn as a pill on the circle's own bottom rim: the column pitch leaves only an
   8px gap, so a label hung *below* a circle gets painted over by the next button. */
#hud .blab {
  position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
  font-size: 8px; font-weight: 800; letter-spacing: 0.6px; line-height: 1;
  padding: 2.5px 5.5px; border-radius: 7px;
  background: rgba(26, 10, 16, 0.78); border: 1px solid rgba(var(--ink-rgb), 0.18);
  color: rgba(var(--ink-rgb), 0.95);
  white-space: nowrap; pointer-events: none;
}
#hud .stick-base, #hud .stick-knob { position: absolute; border-radius: 50%; display: none; }
#hud .stick-base { width: 128px; height: 128px; background: rgba(var(--maroon), 0.22); border: 2px solid rgba(var(--ink-rgb),0.5); }
#hud .stick-knob { width: 44px; height: 44px; background: rgba(var(--ink-rgb),0.55); }
#hud .compass {
  position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 1.5px solid rgba(var(--ink-rgb),0.4);
  display: flex; align-items: center; justify-content: center;
}
#hud .compass .needle { font-size: 15px; font-weight: 700; color: var(--gold-bright); will-change: transform; }
#hud .travel-btn {
  position: absolute; top: 14px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 1.5px solid rgba(var(--ink-rgb),0.4);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer;
}
#hud .settings-btn {
  position: absolute; top: 78px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
/* a one-time nudge after a fresh visitor picks "just explore", so they know the
   story toggle lives behind the gear; clears the moment they open Settings */
#hud .settings-btn.pulse { animation: nbpt-gear-pulse 1.1s ease-in-out 3; }
@keyframes nbpt-gear-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb),0.0); }
  50% { box-shadow: 0 0 0 7px rgba(var(--gold-rgb),0.32); }
}
#hud .settings-hint {
  position: absolute; top: 84px; left: 66px; z-index: 41; max-width: 200px;
  background: var(--panel); border: 1.5px solid rgba(var(--gold-rgb),0.6); border-radius: 10px;
  padding: 8px 11px; font-size: 12px; line-height: 1.35; color: var(--ink);
  box-shadow: 0 6px 18px rgba(0,0,0,0.4); pointer-events: none;
  opacity: 0; transform: translateX(-6px); transition: opacity 0.3s, transform 0.3s;
}
#hud .settings-hint::before {
  content: ''; position: absolute; top: 12px; left: -7px; width: 0; height: 0;
  border: 6px solid transparent; border-right-color: rgba(var(--gold-rgb),0.6); border-left: 0;
}
#hud .settings-hint.show { opacity: 1; transform: translateX(0); }
#hud .settings-pop {
  position: absolute; top: 78px; left: 66px; min-width: 188px; max-width: 240px;
  background: var(--panel); border: 1.5px solid rgba(var(--gold-rgb),0.5); border-radius: 12px;
  padding: 7px; z-index: 40; display: none; pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
}
#hud .settings-pop.open { display: block; }
#hud .settings-pop .sp-hdr { font-size: 11px; color: var(--gold-mid); font-weight: 700; padding: 2px 5px 6px; letter-spacing: 0.3px; }
#hud .settings-pop .sp-row {
  display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 8px;
  cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .settings-pop .sp-row:hover { background: rgba(var(--gold-rgb),0.16); }
#hud .settings-pop .sp-label { flex: 1; min-width: 0; }
#hud .settings-pop .sp-name { font-size: 13.5px; color: var(--ink); font-weight: 700; }
#hud .settings-pop .sp-sub { font-size: 11px; color: #9fb1c2; line-height: 1.35; margin-top: 2px; }
/* a compact iOS-style switch — gold when on */
#hud .settings-pop .sp-sw {
  position: relative; flex: 0 0 auto; width: 40px; height: 23px; border-radius: 12px;
  background: rgba(var(--ink-rgb),0.18); border: 1px solid rgba(var(--ink-rgb),0.3); transition: background 0.18s ease;
}
#hud .settings-pop .sp-sw::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%;
  background: var(--ink); transition: transform 0.18s var(--ease-out);
}
#hud .settings-pop .sp-row.on .sp-sw { background: rgba(var(--gold-rgb),0.85); border-color: var(--gold-mid); }
#hud .settings-pop .sp-row.on .sp-sw::after { transform: translateX(17px); }
#hud .season-toggle {
  position: absolute; top: 270px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 1.5px solid rgba(var(--ink-rgb),0.4);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  transition: top 0.3s ease;
}
#hud .season-toggle:hover { border-color: var(--gold); }
/* the 🎒 backpack button (top:170) stays hidden until the player earns it; while it's
   absent, slide the season toggle (and its popover) up into that slot so the button sits
   flush under the compass instead of leaving a gap. Both ease back down once it appears. */
#hud .bag-btn:not(.show) ~ .season-toggle,
#hud .bag-btn:not(.show) ~ .season-pop { top: 206px; }
/* explore mode (Story mode off): the story-progress chrome is hidden — the top-right
   compass dial, the 🧭 missions log, and the 🎒 backpack. Travel + settings + season
   stay, and the 🍂 season toggle slides up under ⚙️ settings (the now-empty 🧭 slot) so
   the left column reads flush. Toggled by setStoryChrome() from quest.apply(). */
#hud.no-story .compass,
#hud.no-story .journey-btn,
#hud.no-story .bag-btn { display: none !important; }
#hud.no-story .season-toggle,
#hud.no-story .season-pop { top: 142px !important; }
/* world-only towns (.bare, set once at boot): no story spine at all → also hide
   the Story-mode settings row + its hint. Layout slides reuse .no-story above. */
#hud.bare .settings-pop .sp-row[data-set="story"], #hud.bare .settings-hint { display: none !important; }
#hud .season-pop {
  position: absolute; top: 270px; left: 66px; min-width: 152px;
  transition: top 0.3s ease;
  background: var(--panel); border: 1.5px solid rgba(var(--gold-rgb),0.5); border-radius: 12px;
  padding: 7px; z-index: 40; display: none; pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
}
#hud .season-pop.open { display: block; }
#hud .season-pop .sp-hdr { font-size: 11px; color: var(--gold-mid); font-weight: 700; padding: 2px 5px 7px; letter-spacing: 0.3px; }
#hud .season-pop .sp-item {
  display: flex; align-items: center; padding: 8px 10px; border-radius: 8px;
  font-size: 13.5px; color: var(--ink); cursor: pointer; white-space: nowrap;
}
#hud .season-pop .sp-item:hover { background: rgba(var(--gold-rgb),0.18); }
#hud .season-pop .sp-item.cur { background: rgba(var(--gold-rgb),0.26); color: #fff; font-weight: 700; }
#hud .season-pop.locked .sp-item { opacity: 0.45; cursor: default; }
#hud .season-pop.locked .sp-item:hover { background: none; }
#hud .season-pop .sp-lock { font-size: 11px; color: var(--gold); padding: 7px 5px 2px; line-height: 1.45; max-width: 158px; }
/* ---------- Races 🏁: always-visible button + course picker ----------
   Racing is front-door, not a secret: the 🏁 sits in the left column everywhere
   (story AND explore), and picking a course fades you straight to its start line.
   Column cascade mirrors the season toggle: slide up into whatever slots are empty. */
#hud .race-btn {
  position: absolute; top: 334px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 1.5px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  transition: top 0.3s ease;
}
#hud .race-btn.show { display: flex; }
#hud .bag-btn:not(.show) ~ .race-btn { top: 270px; }
#hud.no-story .race-btn { top: 206px !important; }
#hud .race-pop {
  position: absolute; top: 334px; left: 66px; min-width: 210px; max-width: 260px;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.55); border-radius: 12px;
  padding: 8px; display: none; pointer-events: auto; z-index: 40;
  transition: top 0.3s ease;
}
#hud .bag-btn:not(.show) ~ .race-pop { top: 270px; }
#hud.no-story .race-pop { top: 206px !important; }
#hud .race-pop.open { display: block; }
#hud .race-pop .rp-hdr { font-size: 11px; color: var(--gold-mid); font-weight: 700; padding: 2px 5px 7px; letter-spacing: 0.3px; }
#hud .race-pop .rp-item { padding: 8px 9px; border-radius: 8px; cursor: pointer; }
#hud .race-pop .rp-item:hover { background: rgba(var(--gold-rgb),0.18); }
#hud .race-pop .rp-name { font-size: 13px; font-weight: 700; color: var(--ink); }
#hud .race-pop .rp-sub { font-size: 11px; color: #9fb1c2; margin-top: 1px; }
#hud .race-pop .rp-best { font-size: 11px; color: var(--gold-bright); font-weight: 700; margin-top: 3px; }
#hud .race-pop .rp-hint { font-size: 10.5px; color: var(--ink-dim); padding: 7px 5px 2px; line-height: 1.4; border-top: 1px solid rgba(var(--gold-rgb),0.25); margin-top: 6px; }
#hud .race-pop .rp-err { flex-basis: 100%; font-size: 11px; color: #e8a89a; padding-top: 3px; }
#hud .race-pop .rp-err:empty { display: none; }
#hud .race-pop .rp-cup { float: right; font-size: 15px; padding: 2px 6px; border-radius: 7px; cursor: pointer; }
#hud .race-pop .rp-cup:hover { background: rgba(var(--gold-rgb),0.25); }
/* ---------- 🏆 the town leaderboard modal (post-race results + standings) ---------- */
#hud .board-panel {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(12, 17, 24, 0.72); z-index: 70; pointer-events: none; opacity: 0;
  transition: opacity 0.2s ease;
}
#hud .board-panel.show { pointer-events: auto; opacity: 1; }
#hud .board-card {
  width: min(400px, calc(100vw - 44px)); max-height: 76vh; overflow-y: auto;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.6); border-radius: 16px;
  padding: 16px 18px 14px; box-shadow: 0 12px 44px rgba(0,0,0,0.55);
  transform: translateY(18px) scale(0.95); transition: transform 0.26s cubic-bezier(0.2, 0.85, 0.3, 1.12);
}
#hud .board-panel.show .board-card { transform: translateY(0) scale(1); }
#hud .board-card .bd-x { float: right; cursor: pointer; color: #9fb1c2; font-size: 19px; padding: 12px 15px; margin: -8px -10px 0 0; border-radius: 12px; }
#hud .board-card .bd-x:hover { color: var(--ink); background: rgba(var(--gold-rgb),0.18); }
#hud .bd-kick { font-size: 11px; letter-spacing: 3px; color: var(--gold-mid); font-weight: 700; }
#hud .bd-title { font-family: Georgia, serif; font-size: 22px; color: var(--ink); margin-top: 3px; }
#hud .bd-sub { font-size: 11px; color: #9fb1c2; margin-top: 2px; }
#hud .bd-time { font: 800 34px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gold-bright); margin: 10px 0 1px; }
#hud .bd-line { font-size: 12px; color: var(--ink-dim); margin: 2px 0 6px; }
#hud .bd-rows { margin-top: 8px; }
#hud .bd-row { display: flex; gap: 10px; align-items: center; padding: 7px 10px; border-radius: 9px; font-size: 14px; color: #e8e4d8; border: 1px solid transparent; }
#hud .bd-row .bd-rank { width: 24px; color: #9fb1c2; font-weight: 800; font-size: 12px; }
#hud .bd-row .bd-name { flex: 1; font-weight: 700; letter-spacing: 0.5px; }
#hud .bd-row .bd-t { font: 700 14px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gold-bright); }
#hud .bd-row.me { background: rgba(var(--gold-rgb),0.16); border-color: rgba(var(--gold-rgb),0.4); }
#hud .bd-row.claim { background: rgba(207,234,255,0.07); border: 1px dashed rgba(207,234,255,0.35); padding: 9px 10px; }
#hud .bd-row.claim input {
  flex: 1; min-width: 90px; width: 90px; padding: 7px 10px; border-radius: 8px;
  border: 1px solid rgba(var(--gold-rgb),0.55); background: rgba(10,14,20,0.6);
  color: var(--gold-bright); font: 800 17px system-ui, sans-serif; letter-spacing: 1.5px;
  outline: none; text-transform: uppercase;
}
#hud .bd-row.claim input::placeholder { font-size: 12px; letter-spacing: 0.5px; color: #9fb1c2; }
#hud .bd-row.claim input.bad { border-color: #d85a4a; animation: nbpt-name-shake 0.3s ease; }
#hud .bd-row.claim button {
  padding: 8px 13px; border-radius: 8px; border: none; cursor: pointer;
  color: rgb(var(--maroon)); background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid));
  font: 800 13px system-ui, sans-serif; letter-spacing: 0.5px;
}
#hud .bd-empty { font-size: 12.5px; color: #9fb1c2; padding: 10px 4px 6px; }
#hud .bd-err { font-size: 12px; color: #e8a89a; padding: 4px 10px 0; min-height: 0; }
#hud .bd-err:empty { display: none; }
#hud .bd-again {
  display: block; width: 100%; margin-top: 14px; padding: 13px 10px; border: none; border-radius: 14px;
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid)); color: rgb(var(--maroon)); font-weight: 800; font-size: 16px;
  letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
}
#hud .bd-again:active { transform: translateY(1px); }
/* 🎉 finish-line celebration: confetti rains and balloons rise OVER the results board
   (z 80 > the board panel's 70) — pure decoration, so pointer-events stay off */
#hud .fete { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 80; }
#hud .fete i { position: absolute; top: -16px; border-radius: 2px; opacity: 0; animation: nbpt-confetti linear both; }
@keyframes nbpt-confetti {
  0% { transform: translate(0, -10px) rotate(0); opacity: 0; }
  6% { opacity: 1; }
  100% { transform: translate(var(--drift), 105vh) rotate(var(--spin)); opacity: 0.9; }
}
#hud .fete b { position: absolute; bottom: -48px; opacity: 0; animation: nbpt-balloon 3.8s ease-in both; }
@keyframes nbpt-balloon {
  0% { transform: translateY(0) rotate(-5deg); opacity: 0; }
  12% { opacity: 0.95; }
  50% { transform: translateY(-58vh) rotate(6deg); }
  100% { transform: translateY(-118vh) rotate(-4deg); opacity: 0.85; }
}
/* who's riding — the banner at the TOP of the picker (shared-device rider switching) */
#hud .race-pop .rp-rider {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 10px; margin: 0 0 7px; cursor: pointer; border-radius: 9px;
  background: rgba(var(--gold-rgb),0.13); border: 1px solid rgba(var(--gold-rgb),0.45);
  font-size: 12px; color: var(--gold-bright); font-weight: 700;
}
#hud .race-pop .rp-rider b { font-size: 16px; font-weight: 800; color: var(--gold-bright); letter-spacing: 1px; }
#hud .race-pop .rp-rider span { color: #9fb1c2; font-weight: 600; font-size: 11px; }
/* the "switch rider" affix reads as a link, pushed to the banner's far edge — but the
   unnamed pitch ("add your name…") flows inline after the 🚴 */
#hud .race-pop .rp-rider b ~ span { margin-left: auto; text-decoration: underline; text-underline-offset: 2px; }
#hud .race-pop .rp-rider:hover span { color: #e8e4d8; }
#hud .race-pop .rp-rider input {
  flex: 1; width: 110px; min-width: 90px; padding: 5px 9px; border-radius: 7px;
  border: 1px solid rgba(var(--gold-rgb),0.55); background: rgba(10,14,20,0.6);
  color: var(--gold-bright); font: 800 15px system-ui, sans-serif; letter-spacing: 1px;
  outline: none; text-transform: uppercase;
}
#hud .race-pop .rp-rider input::placeholder { font-size: 11px; letter-spacing: 0.5px; color: #9fb1c2; }
#hud .race-pop .rp-rider input.bad { border-color: #d85a4a; animation: nbpt-name-shake 0.3s ease; }
@keyframes nbpt-name-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
#hud .run-btn {
  position: absolute; right: 18px; bottom: 52px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 2px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .run-btn.show { display: flex; }
#hud .run-btn.on { background: rgba(var(--gold-rgb), 0.45); border-color: var(--gold-mid); }
#hud .bike-btn {
  position: absolute; right: 18px; bottom: 132px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 2px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .bike-btn.show { display: flex; }
/* 🐾 BARK / hold-to-SNIFF — dog-player only (Game gates it). Tap = one woof;
   hold = nose down + the scent glow, so one thumb slot carries both verbs. */
#hud .bark-btn {
  position: absolute; right: 18px; bottom: 288px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 2px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .bark-btn.show { display: flex; }
#hud .bark-btn.on { background: rgba(var(--gold-rgb), 0.45); border-color: var(--gold-mid); }
#hud.indoors .bark-btn { display: none !important; }
/* the scent: a warm bloom pinned to the screen edge in the direction of the
   nearest unfound story. Never a pin, never an arrow — a smell. */
#hud .scent {
  position: fixed; width: 240px; height: 240px; margin: -120px 0 0 -120px;
  border-radius: 50%; pointer-events: none; opacity: 0; z-index: 40;
  background: radial-gradient(circle, rgba(232,194,49,0.55), rgba(232,194,49,0.18) 45%, transparent 70%);
  filter: blur(6px);
  transition: opacity 0.25s ease;
}
#hud .scent.pulse { animation: scent-pulse 1.6s ease-in-out infinite; }
@keyframes scent-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }
/* WOOF! — a bark's little rising shout at the dog's screen spot */
#hud .woof {
  position: fixed; pointer-events: none; z-index: 60; font-weight: 800; font-size: 20px;
  color: #fff7df; text-shadow: 0 2px 8px rgba(0,0,0,0.55), 0 0 18px rgba(232,194,49,0.5);
  animation: woof-rise 0.8s ease-out forwards;
}
@keyframes woof-rise { from { opacity: 1; transform: translateY(0) scale(0.7); }
  30% { transform: translateY(-14px) scale(1.08); } to { opacity: 0; transform: translateY(-44px) scale(1); } }
#hud .dirtclod {
  position: fixed; width: 7px; height: 7px; border-radius: 50%;
  background: #7a5a3a; pointer-events: none; z-index: 55;
  animation: dirt-fly 0.6s ease-out forwards;
}
@keyframes dirt-fly { from { opacity: 1; transform: translate(0, 0) scale(1); }
  to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.5); } }
/* 🐕 collar picker — settings row, dog player only (initCollar reveals it) */
#hud .sp-collar { display: none; padding: 10px 12px 12px; border-top: 1px solid rgba(var(--ink-rgb),0.12); }
#hud .sp-collar.show { display: block; }
#hud .sp-crow { display: flex; gap: 10px; }
#hud .sp-cchip {
  width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
  border: 2px solid rgba(var(--ink-rgb),0.3); transition: transform 0.12s, border-color 0.15s;
}
#hud .sp-cchip:hover { transform: scale(1.12); }
#hud .sp-cchip.cur { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(var(--gold-rgb),0.4); }
#hud .bike-btn.on { background: rgba(var(--gold-rgb), 0.45); border-color: var(--gold-mid); }
/* LOOK UP — the chase camera aims about 26° DOWNWARD, which is right for
   following a kid down a street and hopeless for a city: from the sidewalk in
   Boston you could not see the top of a single tower. This tilts the view up
   and opens the far plane so the skyline is actually there to look at. */
/* ⚠️ bottom: 288px, ABOVE the action button. .talk-btn (KAYAK / TALK / HOP OUT)
   is also right-anchored and sits at 200 — 218 with a dialogue open — so the
   first version of this at 212 was drawn straight underneath it. The right rail
   stacks RUN 52 · BIKE 132 · action 200 · LOOK UP 288. */
#hud .look-btn {
  position: absolute; right: 18px; bottom: 364px; width: 58px; height: 58px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 2px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .look-btn.show { display: flex; }
#hud .look-btn.on { background: rgba(var(--gold-rgb), 0.45); border-color: var(--gold-mid); }
#hud .look-btn .kc {
  position: absolute; right: -5px; bottom: -5px;
  min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box;
  background: var(--ink); color: rgb(var(--maroon));
  border-radius: 5px; border: 1px solid rgba(0,0,0,0.22);
  box-shadow: 0 1.5px 0 rgba(0,0,0,0.3);
  font: 800 11px/1 system-ui, sans-serif;
  display: none; align-items: center; justify-content: center; pointer-events: none;
}
#hud.keys .look-btn .kc { display: flex; }
#hud .look-btn:hover { border-color: var(--gold); }
#hud.indoors .look-btn { display: none !important; }
/* desktop key-hint badge on the action buttons — only shown on keyboard (#hud.keys) */
#hud .run-btn .kc, #hud .bike-btn .kc, #hud .bark-btn .kc {
  position: absolute; right: -5px; bottom: -5px;
  min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box;
  background: var(--ink); color: rgb(var(--maroon));
  border-radius: 5px; border: 1px solid rgba(0,0,0,0.22);
  box-shadow: 0 1.5px 0 rgba(0,0,0,0.3);
  font: 800 11px/1 system-ui, sans-serif;
  display: none; align-items: center; justify-content: center; pointer-events: none;
}
#hud.keys .run-btn .kc, #hud.keys .bike-btn .kc, #hud.keys .bark-btn .kc { display: flex; }
#hud .run-btn:hover, #hud .bike-btn:hover, #hud .bark-btn:hover { border-color: var(--gold); }
/* indoors (tunnels + interiors) is walk-only — hide the run + bike buttons there */
#hud.indoors .run-btn, #hud.indoors .bike-btn { display: none !important; }
#hud .travel-panel {
  position: absolute; inset: 0; background: rgba(12, 17, 24, 0.72); z-index: 60;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; opacity: 0; transition: opacity 0.2s ease;
}
#hud .travel-panel.open { pointer-events: auto; opacity: 1; }
#hud .travel-card {
  position: relative;
  background: var(--panel); border-radius: 14px; border-bottom: 3px solid var(--gold);
  padding: 18px 20px 14px; width: min(560px, 92vw); max-height: 78vh; overflow-y: auto;
}
/* a tappable close on every modal card — mobile has little backdrop to tap.
   44px: the touch-target floor for small hands (the old 30px was missable) */
#hud .modal-x {
  position: absolute; top: 6px; right: 8px; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 19px; line-height: 1;
  color: #cdbf94; background: rgba(0, 0, 0, 0.3); cursor: pointer; z-index: 3;
  user-select: none; -webkit-user-select: none;
}
/* the objective pill steps aside whenever a panel, card, or landmark banner is up */
#hud:has(.travel-panel.open) .objective,
#hud:has(.journey-panel.show) .objective,
#hud:has(.bag-panel.show) .objective,
#hud:has(.hcard-back.open) .objective,
#hud:has(.collect-panel.show) .objective,
#hud:has(.banner.show) .objective { display: none !important; }
/* racing mutes the story: the quest pill yields the top of the screen to the countdown,
   the race clock, and the results board (quest beats + TALK are suppressed game-side) */
#hud:has(.race-count.show) .objective,
#hud:has(.race-timer.show) .objective,
#hud:has(.board-panel.show) .objective { display: none !important; }
/* mid-race landmark banners duck BELOW the clock chip instead of underneath it */
#hud:has(.race-timer.show) .banner { top: 108px; }
/* the off-screen waypoint arrow steps aside whenever a panel/dialogue is up */
#hud:has(.travel-panel.open) .waypoint,
#hud:has(.journey-panel.show) .waypoint,
#hud:has(.bag-panel.show) .waypoint,
#hud:has(.dlg.open) .waypoint { display: none !important; }
/* off-screen objective pointer: a gold arrow at the screen edge + distance,
   shown only when the beam of light is off your screen (you still find the route) */
#hud .waypoint {
  position: absolute; display: none; align-items: center; justify-content: center;
  transform: translate(-50%, -50%); pointer-events: none; z-index: 11; will-change: left, top;
}
#hud .waypoint.show { display: flex; }
#hud .waypoint .wp-arrow {
  font-size: 19px; line-height: 1; color: rgba(var(--gold-rgb),0.7); will-change: transform;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
#hud .travel-card h2 {
  font-family: Georgia, serif; color: var(--ink); font-size: 21px; margin: 0 0 12px;
  letter-spacing: 1px; text-align: center;
}
#hud .travel-search {
  width: 100%; box-sizing: border-box; margin: 0 0 10px; padding: 10px 13px;
  font: 600 15px system-ui, sans-serif; color: var(--ink);
  background: rgba(var(--ink-rgb), 0.09); border: 1px solid rgba(var(--ink-rgb), 0.25);
  border-radius: 9px; outline: none;
}
#hud .travel-search:focus { border-color: var(--gold); }
#hud .travel-search::placeholder { color: rgba(216, 207, 168, 0.55); }
#hud .travel-results { display: none; flex-direction: column; gap: 6px; margin-bottom: 12px; }
#hud .travel-results.has { display: flex; }
#hud .travel-results .travel-item.sel { background: rgba(var(--gold-rgb), 0.24); }
#hud .travel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#hud .travel-item {
  background: rgba(var(--ink-rgb), 0.07); border: 1px solid rgba(var(--ink-rgb), 0.14);
  border-radius: 9px; padding: 9px 12px; cursor: pointer; transition: background 0.15s;
}
/* grid cards lead with a place-emoji (search results stay text-only) */
#hud .travel-grid .travel-item { display: flex; align-items: center; gap: 10px; }
/* The chip material, the pop-in and the lift/squash all live in the LIVELY layer at
   the bottom of this stylesheet now — they started here, then every other panel
   wanted them. Only the travel-specific bits stay. */
#hud .travel-grid .travel-item, #hud .travel-results .travel-item { border-radius: 12px; }
#hud .travel-item .ti-em { line-height: 1; }
#hud .tt-chip { transition: transform 0.12s ease, background 0.15s, border-color 0.15s; }
#hud .tt-chip:hover { transform: translateY(-3px); }
#hud .tt-chip:active { transform: scale(0.95); }
#hud .travel-item .ti-tx { flex: 1; min-width: 0; }
#hud .travel-item:hover { background: rgba(var(--gold-rgb), 0.18); }
#hud .travel-item .tn { color: var(--ink); font-size: 14px; font-weight: 600; }
#hud .travel-item .ts { color: var(--ink-dim); font-size: 11px; margin-top: 2px; }
/* town switcher — hop between Newburyport, Salem (and future towns), at the top of Fast Travel */
/* The switcher started life with two towns and grew to twelve without its layout
   ever being revisited: initTravel computed a FIXED column count from the town
   count (12 → 3), so on a phone three 150 px chips ran clean off the right edge
   of a 340 px panel and the town you were standing in was half off-screen.
   It is now a fluid auto-fill grid — the column count follows the panel, not the
   roster — and the tile shrinks to an emoji over a name on a phone, which is
   what makes three of them fit. Tags are charm, so they come back as soon as
   there is room for them, and the town you are in always says so. */
/* ---------- fast travel: two views, not one long scroll ----------
   The panel used to stack twelve town cards ON TOP of the ~30 landmarks and the
   search, which buried the thing people actually use — travelling inside the town
   they are already in — under a roster they touch once a session. Now the panel
   opens on THIS town (named in the title, so you always know where you are) and the
   town switcher is one tap away behind a footer row. Same panel, two faces. */
#hud .tv-towns { display: none; }
#hud .travel-panel.towns .tv-here { display: none; }
#hud .travel-panel.towns .tv-towns { display: block; }
#hud .tv-back { display: none; cursor: pointer; }
#hud .travel-panel.towns .tv-title { display: none; }
#hud .travel-panel.towns .tv-switch { display: none; }
#hud .travel-panel.towns .tv-back { display: inline; }
#hud .tv-back:hover { color: var(--gold-bright); }
/* ---------- the way UP to the towns ----------
   HIERARCHY: the roster of twelve towns is a level ABOVE this one, so its control
   belongs in line with the title — mirroring the ✕ across the header — not as a
   full-width slab under it. A button below the town name reads as something INSIDE
   Newburyport, which is the opposite of what it does. The town name stays the hero.
   Same idea as a nav bar: the way back up lives top-left, the close lives top-right. */
#hud .tv-switch {
  position: absolute; top: 6px; left: 8px; z-index: 3;
  display: flex; align-items: center; gap: 6px;
  height: 44px; padding: 0 13px 0 9px; border-radius: 22px; cursor: pointer;
  /* THEMED, not hardcoded. This was a fixed rust-to-maroon gradient — Newburyport's
     palette — so in Salem it sat purple-on-rust and in Boston green-on-rust. It is now a
     gold wash over the town's own chrome colour, so it stays a warm headline slab in
     every town while belonging to that town. Swap a theme and this follows. */
  background: linear-gradient(140deg, rgba(var(--gold-rgb), 0.30), rgba(var(--maroon-lt), 0.88));
  border: 1.5px solid rgba(var(--gold-rgb), 0.5);
  overflow: hidden; color: #fff6e2;
  font-size: 14px; font-weight: 800; letter-spacing: 0.2px;
  transition: transform 0.12s ease, filter 0.2s ease, border-color 0.15s ease;
}
#hud .tv-switch:hover { filter: brightness(1.18); border-color: var(--gold-bright); }
#hud .tv-switch:active { transform: scale(0.93); }
/* A control needs a WORD. Emoji alone is decoration nobody can read, and a title
   attribute is desktop-hover only — useless on the phone this is mostly played on. */
#hud .tv-sw-txt { position: relative; z-index: 1; }
/* One glint as the panel opens — same rule as the album (see the LIVELY layer): the
   light crosses once and then the button holds still. It used to shimmer on a 3.8s
   loop at nearly three times this opacity, which is decoration competing with the
   title it sits behind. Scoped to .open so it replays on each open, not on a timer. */
#hud .tv-switch::after {
  content: ''; position: absolute; top: -60%; bottom: -60%; width: 26px; left: -80px;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.16), transparent);
  transform: skewX(-18deg);
}
#hud .travel-panel.open .tv-switch::after {
  --glint-from: -80px;
  animation: nbpt-glint 0.42s ease-out 0.22s 1 backwards;
}
/* the real town emoji, overlapping like a hand of cards — this IS the label */
#hud .tv-sw-faces { position: relative; z-index: 1; display: flex; align-items: center; padding-left: 6px; }
#hud .tv-sw-faces i {
  font-style: normal; font-size: 17px; line-height: 1; margin-left: -6px;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
}
/* they deal themselves in once, then sit — the old version bobbed forever, which is
   motion with nothing to say. The per-face delay is set in JS where they are built. */
#hud .travel-panel.open .tv-sw-faces i { animation: nbpt-face-deal 0.36s var(--ease-pop) backwards; }
@keyframes nbpt-face-deal { from { opacity: 0; transform: translateY(-7px) rotate(-8deg); } to { opacity: 1; transform: none; } }
/* The chevron points LEFT and sits on the LEFT, because this goes UP a level. It
   was a right-pointing arrow on the right edge, which is the universal sign for
   "forward, deeper in" — the exact opposite of what tapping it does. It nudges
   leftward too, toward where it is taking you. */
#hud .tv-sw-arrow { position: relative; z-index: 1; color: var(--gold-bright); font-size: 19px; font-weight: 900; }
/* The one loop left in this panel, and it earns it: it is pointing at where the tap
   goes. Scoped to .open so it is not animating inside a closed panel forever. */
#hud .travel-panel.open .tv-sw-arrow { animation: nbpt-nudge 1.6s ease-in-out infinite; }
@keyframes nbpt-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-3px); } }
/* the emoji are a flourish behind the word, and the first thing to go when narrow */
@media (max-width: 430px) { #hud .tv-sw-faces { display: none; } }
/* the title is the hero — give it room between the two controls */
#hud .travel-card h2 { padding: 0 56px; margin: 0 0 16px; }
#hud .tv-here { padding-top: 4px; }
#hud .travel-towns { margin: 0 0 14px; }
#hud .tt-hdr { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 10.5px; letter-spacing: 1.5px; color: var(--gold); font-weight: 700; margin: 0 0 8px; }
#hud .tt-count { color: #9d9583; font-weight: 600; letter-spacing: 0.6px; }
#hud .tt-row { display: grid; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
#hud .tt-chip { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 8px 5px; border-radius: 10px; background: rgba(var(--ink-rgb),0.07); border: 1px solid rgba(var(--ink-rgb),0.16); cursor: pointer; transition: background 0.15s, border-color 0.15s; }
#hud .tt-chip:hover { background: rgba(var(--gold-rgb),0.18); border-color: rgba(var(--gold-rgb),0.5); }
#hud .tt-chip.cur { background: rgba(var(--gold-rgb),0.16); border-color: var(--gold); }
#hud .tt-chip.cur:hover { background: rgba(var(--gold-rgb),0.28); border-color: var(--gold-bright); }
#hud .tt-emoji { font-size: 22px; line-height: 1; flex: none; }
#hud .tt-info { line-height: 1.18; min-width: 0; }
#hud .tt-name { color: var(--ink); font-size: 11.5px; font-weight: 700; }
#hud .tt-tag { display: none; color: var(--ink-dim); font-size: 11px; margin-top: 1px; }
#hud .tt-here { color: var(--gold-mid); font-size: 10px; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; }
@media (min-width: 560px) {
  #hud .tt-row { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); }
  #hud .tt-chip { flex-direction: row; text-align: left; gap: 10px; padding: 9px 11px; }
  #hud .tt-name { font-size: 14px; }
  #hud .tt-tag { display: block; }
}
/* the five lo-fi styles, as a row of chips inside Settings. Wraps rather than
   scrolls so all five are reachable on a phone without a hidden fifth. */
#hud .sp-music { padding: 10px 12px 12px; border-top: 1px solid rgba(var(--ink-rgb),0.12); }
#hud .sp-mhdr { font-size: 10.5px; letter-spacing: 1.4px; color: var(--gold); font-weight: 700; margin: 0 0 8px; }
#hud .sp-mrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(56px, 1fr)); gap: 6px; }
#hud .sp-mbtn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 3px; border-radius: 9px; cursor: pointer;
  background: rgba(var(--ink-rgb),0.07); border: 1px solid rgba(var(--ink-rgb),0.16);
  transition: background 0.15s, border-color 0.15s;
}
#hud .sp-mbtn:hover { background: rgba(var(--gold-rgb),0.18); border-color: rgba(var(--gold-rgb),0.5); }
#hud .sp-mbtn.cur { background: rgba(var(--gold-rgb),0.22); border-color: var(--gold); }
#hud .sp-mbtn .m-em { font-size: 18px; line-height: 1; }
#hud .sp-mbtn .m-nm { font-size: 9.5px; font-weight: 700; color: var(--ink); text-align: center; line-height: 1.15; }
#hud .sp-msub { margin-top: 8px; font-size: 11.5px; color: var(--ink-dim); line-height: 1.35; min-height: 2.7em; }
#hud .fade {
  position: absolute; inset: 0; background: #0c1118; opacity: 0; pointer-events: none;
  transition: opacity 0.22s ease; z-index: 300;
}
#hud .fade.on { opacity: 1; }
#hud .vignette {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center, transparent 38%, rgba(3, 5, 9, 0.66) 100%);
  transition: opacity 0.7s ease;
}
#hud .vignette.on { opacity: 1; }
/* ---------- the discovery card ----------
   This is the payoff for walking somewhere, so it is built to feel like a prize
   being handed over: the town freezes behind it, the card lands with a bump, and
   the photo at the top is the kid's OWN view of the thing a second ago. Tapping
   the backdrop closes it — but the close button is a real 44px target, because a
   third grader with a trackpad should not have to be precise to get out. */
#hud .hcard-back {
  position: absolute; inset: 0; background: rgba(12, 6, 9, 0.55);
  backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
  display: none; align-items: center; justify-content: center;
  pointer-events: auto; z-index: 60;
}
#hud .hcard-back.open { display: flex; }
/* ---------- the trophy shine ----------
   A discovery is a prize, so the card is edged in light that travels around it
   rather than a static gold rule along the bottom.
   It has to live on a WRAPPER: the card itself is overflow-y:auto (long stories
   scroll), and an overflowing element clips anything drawn outside its padding box,
   so a glow on .hcard would simply never be visible.
   Built as a conic gradient on an oversized square that spins — NOT an animated
   @property angle — so it works without Houdini support; rotate: and translate: are
   separate properties, so the spin and the centring do not fight.
   (Reminder: NO BACKTICKS anywhere in this file's CSS. It is a template literal.) */
#hud .hcard-wrap {
  position: relative; width: min(520px, 92vw); max-height: 88vh;
  border-radius: 18px; padding: 2px; overflow: hidden;
  background: rgba(var(--gold-rgb), 0.34);       /* the rail the highlight rides */
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55), 0 0 30px rgba(var(--gold-rgb), 0.3);
  animation: nbpt-card-in 0.42s cubic-bezier(0.18, 1.3, 0.42, 1) both;
}
#hud .hcard-wrap::before {
  content: ''; position: absolute; left: 50%; top: 50%;
  width: 240%; aspect-ratio: 1; translate: -50% -50%;
  background: conic-gradient(rgba(var(--gold-rgb),0.3) 0deg, rgba(var(--gold-rgb),0.3) 165deg,
    rgba(var(--gold-rgb),0.95) 232deg, #fffdf2 288deg, rgba(var(--gold-rgb),0.95) 344deg, rgba(var(--gold-rgb),0.3) 360deg);
  animation: nbpt-trophy-shine 3.6s linear infinite;
}
@keyframes nbpt-trophy-shine { to { rotate: 360deg; } }
/* not-yet-found: the same sweep, cooled to pewter — you can see it is the same
   object, just not yours yet */
#hud .hcard-wrap:has(.hcard.locked-card) {
  background: rgba(200, 189, 150, 0.26);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55), 0 0 26px rgba(210, 205, 185, 0.2);
}
#hud .hcard-wrap:has(.hcard.locked-card)::before {
  background: conic-gradient(rgba(200,189,150,0.24) 0deg, rgba(200,189,150,0.24) 175deg,
    rgba(226,222,205,0.8) 238deg, #f6f4ea 288deg, rgba(226,222,205,0.8) 338deg, rgba(200,189,150,0.24) 360deg);
  animation-duration: 5.2s;
}
#hud .hcard {
  position: relative; z-index: 1;            /* above the sweep */
  max-height: calc(88vh - 4px); overflow-y: auto;
  background: var(--panel); border-radius: 16px;
  padding: 0 0 14px;
  user-select: none; -webkit-user-select: none;
}
@keyframes nbpt-card-in {
  from { opacity: 0; transform: translateY(26px) scale(0.9); }
  to   { opacity: 1; transform: none; }
}
/* the "you just found one" banner — only on a first find, never on a re-read */
#hud .hcard .hnew {
  display: none; text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 2.4px;
  color: #1d1207; background: linear-gradient(90deg, var(--gold-mid), var(--gold-bright) 55%, var(--gold-mid));
  padding: 8px 10px; border-radius: 16px 16px 0 0;
}
#hud .hcard.fresh .hnew { display: block; }
/* the photo: the kid's own snapshot, or an illustrated fallback tile */
#hud .hcard .hpic {
  position: relative; width: 100%; aspect-ratio: 8 / 5; overflow: hidden;
  background: linear-gradient(155deg, #4a3a1c, rgb(var(--maroon)) 70%);
  display: flex; align-items: center; justify-content: center;
}
#hud .hcard.fresh .hpic { animation: nbpt-pic-in 0.7s ease 0.15s both; }
@keyframes nbpt-pic-in { from { filter: brightness(2.4) saturate(0.2); } to { filter: none; } }
#hud .hcard .hpic img { width: 100%; height: 100%; object-fit: cover; display: block; }
#hud .hcard .hpic .hpic-em { font-size: 62px; opacity: 0.85; }
#hud .hcard .hpic::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to bottom, transparent 55%, rgba(26,13,17,0.9));
}
#hud .hcard .hbody { padding: 14px 22px 0; }
#hud .hcard .ht { font-family: Georgia, serif; font-size: 24px; color: var(--ink); line-height: 1.2; }
#hud .hcard .hy { font-size: 11.5px; letter-spacing: 2px; color: var(--gold-mid); font-weight: 700; text-transform: uppercase; margin: 4px 0 12px; }
#hud .hcard .hb { font-size: 15px; line-height: 1.62; color: #e8e4d8; white-space: pre-line; }
#hud .hcard .hf { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 16px; padding: 0 22px; }
#hud .hcard .stamp { font-size: 11px; letter-spacing: 1.8px; color: var(--gold-mid); font-weight: 800; }
#hud .hcard .hacts { display: flex; align-items: center; gap: 8px; }
/* The card's one button, a 44px pill. This rule used to be shared with a .hsay
   read-aloud button, and the first time read-aloud was pulled the whole SELECTOR LINE
   went with it, orphaning these declarations. CSS gives no warning — the parser reads
   an orphan as a rule prelude and swallows the NEXT rule too, so "Got it" shipped as
   bare 17px text with no pill and no pointer cursor, and nobody saw it on a desktop.
   That is why this is now a single ungrouped selector. See docs/UX-PRINCIPLES.md. */
#hud .hcard .hclose {
  min-width: 44px; height: 44px; padding: 0 14px; border-radius: 22px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 13px; font-weight: 700; cursor: pointer; pointer-events: auto;
  white-space: nowrap; flex: 0 0 auto;
  border: 1.5px solid var(--gold); background: var(--gold); color: rgb(var(--maroon));
}
/* running tally under the card — "that was number 7" */
#hud .hcard .hcount { text-align: center; font-size: 12px; color: var(--ink-dim); margin: 12px 22px 0; letter-spacing: 0.4px; }
#hud .hcard .hcount b { color: var(--gold-mid); }
/* the not-yet-found treatment: same card, all the shine turned down */
#hud .hcard.locked-card .hpic { background: linear-gradient(155deg, #322530, #1d1419); }
#hud .hcard.locked-card .hpic .hpic-em { opacity: 0.55; filter: grayscale(0.6); }
#hud .hcard.locked-card .hpic::after { background: linear-gradient(to bottom, transparent 55%, rgba(26,13,17,0.75)); }
#hud .hcard.locked-card .ht { color: #d9d3c4; }
#hud .hcard.locked-card .stamp { color: #8b8678; }
#hud .hcard .hmore { display: block; margin-top: 10px; font-size: 13.5px; color: #c8a24f; font-style: italic; }
#hud .hcard.locked-card .hclose { background: rgba(var(--gold-rgb),0.18); border-color: rgba(var(--gold-rgb),0.5); color: var(--ink); }
/* an icon does not need a photo-sized frame — the locked card's art area is half
   height, or the glyph floats in an empty pane */
#hud .hcard.locked-card .hpic { aspect-ratio: 16 / 7; }
/* the stamp used to collide with the action buttons on a phone */
#hud .hcard .stamp { flex: 1 1 auto; min-width: 0; }
@media (max-width: 520px) {
  #hud .hcard .hf { flex-wrap: wrap; gap: 8px; padding: 0 16px; }
  #hud .hcard .stamp { flex: 1 0 100%; order: 2; font-size: 10px; letter-spacing: 1.4px; }
  #hud .hcard .hacts { order: 1; width: 100%; justify-content: flex-end; }
  #hud .hcard .hbody { padding: 12px 16px 0; }
  #hud .hcard .hcount { margin: 10px 16px 0; }
}
#hud .hist-line { text-align: center; font-size: 12.5px; color: var(--ink-dim); margin-top: 12px; letter-spacing: 0.5px; }
#hud .hist-line b { color: var(--gold-mid); }

/* ---------- 🏛 the collection ----------
   With the story spine retired this is the main thing to DO, so it gets a
   front-door button rather than living inside the backpack. In a no-story town it
   takes the slot the missions log used to hold, and the season/race buttons
   cascade down past it (scoped to .has-collect so world-only towns are untouched). */
#hud .collect-btn {
  position: absolute; top: 398px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.65); border: 1.5px solid rgba(var(--ink-rgb),0.4);
  display: none; align-items: center; justify-content: center; font-size: 20px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  transition: top 0.3s ease;
}
#hud .collect-btn.show { display: flex; }
#hud.no-story .collect-btn { top: 142px !important; }
#hud.no-story.has-collect .season-toggle, #hud.no-story.has-collect .season-pop { top: 206px !important; }
#hud.no-story.has-collect .race-btn, #hud.no-story.has-collect .race-pop { top: 270px !important; }
/* The gold count rides the TOP-right rim. It used to sit bottom-right, where the
   .blab pill (which is centred on the bottom rim and painted after it) covered it
   completely — the number was invisible on the one button whose whole point is a
   running number. Any future badge on a labelled button belongs up here. */
#hud .collect-btn .cb-n {
  position: absolute; top: -3px; right: -3px; min-width: 20px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: var(--gold); color: rgb(var(--maroon));
  font-size: 10.5px; font-weight: 800; line-height: 18px; text-align: center;
}
#hud .collect-btn.done { border-color: var(--gold-mid); box-shadow: 0 0 12px rgba(var(--gold-rgb),0.6); }
@keyframes nbpt-collect-pop { 0%,100% { transform: scale(1); } 40% { transform: scale(1.28); } }
#hud .collect-btn.bump { animation: nbpt-collect-pop 0.5s ease; }

#hud .collect-panel {
  position: absolute; inset: 0; background: rgba(12, 6, 9, 0.6);
  display: none; align-items: center; justify-content: center; pointer-events: auto; z-index: 55;
}
#hud .collect-panel.show { display: flex; }
/* Sized to read as a CARD ON the town, not a takeover. It was 94vw × 86vh, which on
   a phone is the whole screen with a hairline of backdrop — indistinguishable from a
   new page. Now the backdrop stays visible on every side, and the grid gets tighter
   columns on narrow screens so shrinking the box doesn't mean endless scrolling. */
#hud .collect-card {
  position: relative; width: min(560px, 88vw); max-height: 74vh; overflow-y: auto;
  background: var(--panel); border-radius: 16px; border-bottom: 3px solid var(--gold);
  padding: 16px 16px 14px; color: var(--ink);
  box-shadow: 0 22px 70px rgba(0,0,0,0.6);
}
/* clearing the album is destructive and rare — a quiet footer link, then a confirm */
#hud .collect-foot { margin-top: 2px; text-align: center; font-size: 11.5px; }
/* Deliberately the quietest thing on the panel — but quiet is a COLOR decision, not a
   hit-area one. It was a 14px-tall run of text: too small to hit on purpose and, with
   the arm-then-confirm two-tap behind it, no safer for being hard to hit. */
#hud .collect-foot .cf-reset {
  color: #8b8678; cursor: pointer; letter-spacing: 0.4px;
  display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px;
}
#hud .collect-foot .cf-reset:hover { color: var(--ink-dim); }
#hud .collect-foot.arm .cf-reset { color: #e88b7a; font-weight: 700; }
#hud .collect-card h2 { font-size: 14px; letter-spacing: 3px; color: var(--gold-mid); font-weight: 800; margin: 0 0 10px; }
#hud .collect-prog { height: 10px; border-radius: 5px; background: rgba(var(--ink-rgb),0.13); overflow: hidden; margin: 2px 0 6px; }
#hud .collect-prog i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #b98f2e, var(--gold-mid)); transition: width 0.5s ease; }
#hud .collect-tally { font-size: 13px; color: var(--ink-dim); margin-bottom: 14px; }
#hud .collect-tally b { color: var(--gold-mid); font-size: 15px; }
#hud .collect-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 9px; }
#hud .ctile {
  border-radius: 10px; overflow: hidden; background: rgba(var(--ink-rgb),0.06);
  border: 1px solid rgba(var(--ink-rgb),0.12); cursor: default;
}
#hud .ctile { cursor: pointer; }
#hud .ctile.got { border-color: rgba(var(--gold-rgb),0.55); }
#hud .ctile .cpic { position: relative; width: 100%; aspect-ratio: 8 / 5; background: linear-gradient(155deg, #3a2d18, #241218); display: flex; align-items: center; justify-content: center; }
#hud .ctile .cpic img { width: 100%; height: 100%; object-fit: cover; display: block; }
#hud .ctile .cpic .cem { font-size: 30px; opacity: 0.95; }
/* A locked slot shows ITS OWN icon — never a shared question mark. This used to
   stack a pin emoji AND a "?" ::after in the same box and then grey the pair, which
   read on a phone as one blurry smudge with something behind it. One glyph, dimmed
   but legible, and the tile is dark rather than the icon being crushed.
   (NB: no backticks in this file's CSS — it lives inside a template literal.) */
#hud .ctile.locked .cpic { background: linear-gradient(160deg, #2b2026, #1d1419); }
#hud .ctile.locked .cpic .cem { opacity: 0.5; filter: grayscale(0.7); }
#hud .ctile .ctx { padding: 7px 9px 9px; }
#hud .ctile .cnm { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
/* a locked slot still names its target — dimmer than a found one, but readable:
   the point is that you can go looking for it */
#hud .ctile.locked .cnm { color: #b3ab95; }
#hud .ctile .chint {
  margin-top: 5px; font-size: 10.5px; color: var(--gold-mid); cursor: pointer;
  border-top: 1px solid rgba(var(--gold-rgb),0.22); padding-top: 5px; min-height: 16px;
}
#hud .ctile .chint.shown { color: var(--ink-dim); cursor: default; }
#hud .ctile .cyr { font-size: 10.5px; color: var(--ink-dim); letter-spacing: 0.6px; margin-top: 2px; }
#hud .collect-empty { font-size: 13px; color: var(--ink-dim); line-height: 1.5; }
/* 88px (not 96) is deliberate: the card is 88vw with 16px padding, so 96 + gaps
   overflowed by a few px and collapsed to TWO columns — half the grid per screen. */
@media (max-width: 520px) {
  #hud .collect-grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 6px; }
  #hud .ctile .cpic { aspect-ratio: 4 / 3; }
  #hud .ctile .cpic .cem { font-size: 22px; }
  #hud .ctile .ctx { padding: 5px 7px 7px; }
  #hud .ctile .cnm { font-size: 11px; }
  #hud .ctile .cyr { font-size: 9.5px; }
  #hud .ctile .chint { font-size: 9.5px; margin-top: 4px; padding-top: 4px; }
}

#hud .mini {
  position: absolute; top: 70px; right: 14px; opacity: 0.55; border-radius: 8px;
  overflow: hidden; border: 1px solid rgba(var(--ink-rgb), 0.35); pointer-events: none;
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
  background: rgba(var(--maroon-lt), 0.84); border: 1px solid rgba(var(--gold-rgb), 0.55);
  color: var(--ink); font-size: 12.5px; font-weight: 600; letter-spacing: 0.4px;
  padding: 8px 15px; border-radius: 16px; display: none; align-items: center; gap: 8px;
  /* sized to content, but never wider than the gap between the corner buttons */
  width: max-content; max-width: min(70vw, calc(100vw - 168px)); text-align: center; pointer-events: auto; cursor: pointer;
  user-select: none; -webkit-user-select: none;
}
#hud .objective.show { display: flex; }
#hud .objective .q { color: var(--gold-mid); font-weight: 800; }
/* the pill's leading glyph is now a live steering arrow — it rotates toward the beacon */
#hud .objective .wp-q { display: inline-block; transform-origin: 50% 50%; transition: transform 0.16s linear; font-size: 15px; }
#hud .objective.min { padding: 8px 11px; opacity: 0.75; }
#hud .objective.min .otxt { display: none; }
/* cap the objective to two lines so a long goal can't balloon on narrow phones
   (the full text always lives in the Journey panel); ellipsis if it overruns */
#hud .objective .otxt {
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden; line-height: 1.32; text-align: center;
}
#hud .dlg {
  position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%);
  width: min(580px, 93vw); background: var(--panel); border-radius: 13px;
  border-bottom: 3px solid var(--gold); padding: 13px 17px 9px; display: none;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .dlg.open { display: block; }
#hud .dlg .who { font-size: 11.5px; letter-spacing: 1.6px; color: var(--gold-mid); font-weight: 800; text-transform: uppercase; margin-bottom: 4px; min-height: 13px; }
#hud .dlg .line { font-size: 15.5px; line-height: 1.45; color: var(--ink); min-height: 46px; }
#hud .dlg .dlg-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 7px; }
/* secondary, ghosted next to the gold Next pill; hidden on the first line (no prior to
   go back to), pushed to the far left so Next stays anchored right */
#hud .dlg .dlg-back {
  display: none; margin-right: auto; background: transparent; color: #cdbf9a;
  font-weight: 700; font-size: 13px; letter-spacing: 0.8px; padding: 6px 14px;
  border-radius: 15px; border: 1.5px solid rgba(var(--gold-rgb),0.45); cursor: pointer;
}
#hud .dlg .dlg-back.show { display: inline-block; }
#hud .dlg .dlg-back:hover { background: rgba(var(--gold-rgb),0.14); color: var(--gold-bright); }
#hud .dlg .dlg-next {
  display: inline-block; background: rgba(var(--gold-rgb),0.95); color: rgb(var(--maroon));
  font-weight: 800; font-size: 13px; letter-spacing: 0.8px; padding: 6px 17px;
  border-radius: 15px; border: 1.5px solid var(--gold-bright);
}
#hud .dlg .dlg-next:hover { background: var(--gold-bright); }
#hud .talk-btn {
  position: absolute; right: 18px; bottom: 200px; min-width: 58px; height: 58px;
  border-radius: 29px; background: rgba(var(--gold-rgb), 0.92); color: rgb(var(--maroon));
  border: 2px solid var(--gold-bright); display: none; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 800; letter-spacing: 1px; padding: 0 16px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .talk-btn.show { display: flex; }
/* if an action button (KAYAK / HOP OUT …) is ever live while a dialogue is open,
   lift it clear of the dialogue card instead of letting them overlap */
#hud:has(.dlg.open) .talk-btn { bottom: 218px; transition: bottom 0.18s var(--ease-out); }
#hud .journey-btn {
  position: absolute; top: 142px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.78); border: 1.5px solid rgba(var(--gold-rgb),0.6);
  display: flex; align-items: center; justify-content: center; font-size: 22px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
#hud .journey-btn:hover { border-color: var(--gold-mid); }
/* the journey panel fades the backdrop + slides/scales its card in & out */
#hud .journey-panel {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(12, 17, 24, 0.72); z-index: 60; pointer-events: none; opacity: 0;
  transition: opacity 0.2s ease;
}
#hud .journey-panel.show { pointer-events: auto; opacity: 1; }
#hud .journey-card { transform: translateY(18px) scale(0.95); transition: transform 0.26s cubic-bezier(0.2, 0.85, 0.3, 1.12); }
#hud .journey-panel.show .journey-card { transform: translateY(0) scale(1); }
/* ---------- Backpack 🎒: a button that springs in on your first item ---------- */
#hud .bag-btn {
  position: absolute; top: 206px; left: 14px; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(var(--maroon), 0.78); border: 1.5px solid rgba(var(--gold-rgb),0.6);
  display: none; align-items: center; justify-content: center; font-size: 22px;
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
#hud .bag-btn.show { display: flex; }
#hud .bag-btn:hover { border-color: var(--gold-mid); }
#hud .bag-badge {
  position: absolute; top: -6px; right: -8px; background: var(--gold-mid); color: rgb(var(--maroon));
  font: 800 8.5px system-ui, sans-serif; letter-spacing: 0.5px; padding: 1px 4px;
  border-radius: 7px; display: none; pointer-events: none;
}
#hud .bag-btn.has-new .bag-badge { display: block; }
@keyframes nbpt-bag-pop {
  0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
  55%  { transform: scale(1.35) rotate(8deg); opacity: 1; }
  72%  { transform: scale(0.9) rotate(-4deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes nbpt-bag-glow {
  0%   { box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 0 rgba(var(--gold-rgb),0.85); }
  60%  { box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 16px 11px rgba(var(--gold-rgb),0); }
  100% { box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 0 0 0 rgba(var(--gold-rgb),0); }
}
#hud .bag-btn.pop { animation: nbpt-bag-pop 0.7s cubic-bezier(0.2,0.85,0.3,1.2) both, nbpt-bag-glow 0.95s ease-out both; }
@keyframes nbpt-bag-wiggle {
  0%,100% { transform: rotate(0); }
  20% { transform: rotate(-12deg) scale(1.08); }
  40% { transform: rotate(10deg) scale(1.08); }
  60% { transform: rotate(-7deg); }
  80% { transform: rotate(5deg); }
}
#hud .bag-btn.wiggle { animation: nbpt-bag-wiggle 0.55s ease-in-out; }
#hud .bag-tip {
  position: absolute; top: 214px; left: 66px; background: rgba(var(--maroon-lt),0.94);
  border: 1px solid rgba(var(--gold-rgb),0.55); color: var(--ink); font-size: 12.5px; font-weight: 600;
  padding: 7px 12px; border-radius: 14px; white-space: nowrap; pointer-events: none;
  opacity: 0; transform: translateX(-8px); z-index: 12;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
#hud .bag-tip b { color: var(--gold-bright); }
#hud .bag-tip.show { opacity: 1; transform: translateX(0); }
/* the bag panel reuses the journey-panel modal pattern (full-screen on mobile) */
#hud .bag-panel {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(12, 17, 24, 0.72); z-index: 60; pointer-events: none; opacity: 0;
  transition: opacity 0.2s ease;
}
#hud .bag-panel.show { pointer-events: auto; opacity: 1; }
#hud .bag-card {
  position: relative; width: min(420px, 90vw); max-height: 82vh; overflow: auto;
  background: var(--panel); border-radius: 14px; border-bottom: 3px solid var(--gold);
  padding: 18px 20px 16px; color: var(--ink);
  transform: translateY(18px) scale(0.95); transition: transform 0.26s cubic-bezier(0.2, 0.85, 0.3, 1.12);
}
#hud .bag-panel.show .bag-card { transform: translateY(0) scale(1); }
#hud .bag-head { display: flex; align-items: center; gap: 10px; font-size: 14px; letter-spacing: 3px; color: var(--gold-mid); font-weight: 800; margin-bottom: 4px; }
#hud .bag-head .bag-emoji { font-size: 34px; line-height: 1; letter-spacing: 0; }
#hud .bag-empty { font-size: 12.5px; color: #8b8678; line-height: 1.5; margin-top: 10px; }
#hud .bag-sec.empty { display: none; }
#hud .bag-sectitle { font-size: 11.5px; letter-spacing: 2px; color: var(--gold-mid); font-weight: 800; margin: 13px 0 7px; }
#hud .bag-grid { display: flex; flex-wrap: wrap; gap: 6px; }
#hud .bag-grid .jitem {
  flex: 1 1 46%; min-width: 132px; display: flex; align-items: center; gap: 9px;
  border-radius: 9px; padding: 7px 10px; font-size: 11.5px; line-height: 1.3;
  border: 1px solid rgba(var(--gold-rgb),0.4); background: rgba(var(--gold-rgb),0.08); color: var(--ink);
}
#hud .bag-grid .jitem .ic { font-size: 19px; flex: none; }
#hud .bag-grid .jitem .tx { flex: 1; }
#hud .bag-grid .jitem b { color: var(--gold-bright); }
#hud .bag-grid .jitem .cnt {
  flex: none; font: 800 12px system-ui, sans-serif; color: var(--gold-bright);
  background: rgba(var(--gold-rgb),0.16); border-radius: 8px; padding: 1px 8px;
}
#hud .bag-grid .jitem.tappable { cursor: pointer; }
#hud .bag-grid .jitem.tappable:hover { background: rgba(var(--gold-rgb),0.18); }
#hud .bag-grid .jitem.fresh { animation: nbpt-item-flash 1.5s ease-out; }
@keyframes nbpt-item-flash {
  0%, 100% { border-color: rgba(var(--gold-rgb),0.4); background: rgba(var(--gold-rgb),0.08); }
  25% { border-color: var(--gold-mid); background: rgba(var(--gold-rgb),0.22); }
}
/* ---------- Missions cards: grouped, tappable, with a sub-step checklist ---------- */
#hud .m-group { font-size: 11.5px; letter-spacing: 2px; color: var(--gold-mid); font-weight: 800; margin: 15px 0 7px; }
/* a named Level header above its chapters (Story tab) */
#hud .m-level { font-size: 13.5px; color: var(--gold-bright); font-weight: 800; margin: 16px 0 8px; letter-spacing: 0.3px; border-bottom: 1px solid rgba(var(--gold-rgb),0.25); padding-bottom: 6px; }
#hud .m-level:first-child { margin-top: 4px; }
#hud .m-level .m-lk { font-size: 10.5px; letter-spacing: 2px; color: var(--gold); }
/* Story | Collections tab toggle */
#hud .j-tabs { display: flex; gap: 6px; margin: 0 0 12px; }
#hud .j-tab { flex: 1; text-align: center; padding: 7px 0; border-radius: 8px; font-size: 12.5px; letter-spacing: 0.6px; cursor: pointer; user-select: none; -webkit-user-select: none; border: 1px solid rgba(var(--gold-rgb),0.28); color: var(--gold); }
#hud .j-tab.on { background: rgba(var(--gold-rgb),0.16); border-color: var(--gold-mid); color: #f6e9b0; font-weight: 700; }
#hud .m-card {
  border: 1px solid rgba(var(--gold-rgb),0.28); background: rgba(var(--gold-rgb),0.06);
  border-radius: 10px; padding: 8px 11px; margin: 0 0 6px;
}
#hud .m-card.locked { opacity: 0.5; border-color: rgba(var(--ink-rgb),0.14); background: rgba(var(--ink-rgb),0.04); }
#hud .m-card.active { border-color: var(--gold); background: rgba(var(--gold-rgb),0.13); }
#hud .m-card.done { border-color: rgba(158,201,138,0.4); }
#hud .m-row { display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; }
#hud .m-card.locked .m-row { cursor: default; }
#hud .m-dot { font-size: 12px; flex: none; }
#hud .m-title { color: var(--ink); flex: 1; }
#hud .m-card.locked .m-title { color: #787e8a; }
#hud .m-card.done .m-title { color: #c4ccbb; }
#hud .m-prog { font: 800 12px system-ui, sans-serif; color: var(--gold-bright); flex: none; }
#hud .m-rep { color: #e8a89a; font-size: 10.5px; font-weight: 600; letter-spacing: 0.3px; cursor: pointer; flex: none; white-space: nowrap; border: 1px solid rgba(216,90,74,0.45); border-radius: 7px; padding: 3px 8px; }
#hud .m-rep:hover, #hud .m-rep[data-arm="1"] { background: rgba(216,90,74,0.2); border-color: rgba(216,90,74,0.7); }
#hud .m-lrep { float: right; color: #e8a89a; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; cursor: pointer; white-space: nowrap; border: 1px solid rgba(216,90,74,0.45); border-radius: 7px; padding: 3px 9px; margin-top: -2px; }
#hud .m-lrep:hover, #hud .m-lrep[data-arm="1"] { background: rgba(216,90,74,0.2); border-color: rgba(216,90,74,0.7); }
#hud .m-caret { color: #8fa8bc; font-size: 10px; flex: none; transition: transform 0.18s ease; }
#hud .m-card.expanded .m-caret { transform: rotate(90deg); }
#hud .m-card.locked .m-caret, #hud .m-card.locked .m-rep { display: none; }
#hud .m-steps { display: none; margin: 8px 0 2px 20px; }
#hud .m-card.expanded .m-steps { display: block; }
#hud .m-step { font-size: 12.5px; line-height: 1.6; color: #9aa1ad; }
#hud .m-step.done { color: #c4ccbb; }
#hud .m-step b { color: var(--gold-bright); }
#hud .m-reward { font-size: 11.5px; color: var(--ink-dim); margin: 6px 0 0 20px; }
#hud .m-reward b { color: var(--gold-bright); }
#hud .chapter {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; padding: 0 22px; pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(10, 14, 20, 0.84), rgba(10, 14, 20, 0.96));
  opacity: 0; transition: opacity 0.45s ease;
}
#hud .chapter.show { opacity: 1; }
#hud .chapter .kick { font-size: 13px; letter-spacing: 4px; color: var(--gold-mid); font-weight: 700; margin-bottom: 10px; }
#hud .chapter .big { font-family: Georgia, serif; font-size: clamp(30px, 6vw, 46px); color: var(--ink); }
#hud .chapter .small { font-size: 13px; color: var(--ink-dim); margin-top: 12px; letter-spacing: 1px; }
/* the finish card's name box (unnamed riders): the save-your-time moment IS the finish */
#hud .chapter .namer { display: none; margin-top: 18px; gap: 8px; pointer-events: auto; }
#hud .chapter .namer.show { display: flex; }
#hud .chapter .namer input {
  width: 168px; padding: 9px 12px; border-radius: 10px;
  border: 1px solid rgba(var(--gold-rgb),0.55); background: rgba(10,14,20,0.6);
  color: var(--ink); font: 700 14px system-ui, sans-serif; letter-spacing: 0.5px;
  outline: none; text-transform: uppercase; text-align: center;
}
#hud .chapter .namer input.bad { border-color: #d85a4a; animation: nbpt-name-shake 0.3s ease; }
#hud .chapter .namer button {
  padding: 9px 16px; border-radius: 10px; border: none; cursor: pointer;
  color: rgb(var(--maroon)); background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid));
  font: 800 13px system-ui, sans-serif; letter-spacing: 0.6px;
}
#hud .chapter .namer button:hover { transform: scale(1.04); }
/* ---------- Races 🏁: countdown overlay + live timer chip ----------
   NOT gated by .no-story — racing is the play tier, explore mode races too. */
#hud .race-count {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: none; opacity: 0;
}
#hud .race-count.show { opacity: 1; }
#hud .race-count .rc-num {
  font-family: Georgia, serif; font-size: clamp(72px, 18vw, 150px); font-weight: 700;
  color: var(--gold-bright); text-shadow: 0 4px 30px rgba(0,0,0,0.65), 0 0 60px rgba(var(--gold-rgb),0.35);
  animation: nbpt-race-pop 0.9s cubic-bezier(0.2, 0.85, 0.3, 1.15) both;
}
@keyframes nbpt-race-pop { 0% { transform: scale(1.7); opacity: 0; } 25% { opacity: 1; } 100% { transform: scale(0.92); opacity: 0.95; } }
#hud .race-timer {
  /* rides the very TOP of the screen — the objective pill hides during races so the
     slot is free, and landmark banners (top: 58px) stop colliding with the clock */
  position: absolute; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  display: none; align-items: baseline; gap: 9px; flex-wrap: wrap;
  max-width: min(400px, calc(100vw - 24px));
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.55); border-radius: 12px;
  padding: 7px 14px 9px; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
}
#hud .race-timer.show { display: flex; }
/* course progress: a little 🚴 rides the gold bar toward the 🏁 — and the 👻 marker
   shows the ghost's spot on the same bar, so "am I ahead?" is readable at a glance */
#hud .race-timer .rt-track {
  flex-basis: 100%; min-width: 190px; position: relative; height: 12px; margin-top: 2px;
  border-radius: 6px; background: rgba(159,177,194,0.25);
}
#hud .race-timer .rt-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
  border-radius: 6px; background: linear-gradient(90deg, rgba(var(--gold-rgb),0.45), var(--gold-mid));
}
/* the 🚴 emoji faces LEFT in every emoji font — mirror it so it rides toward the 🏁 */
#hud .race-timer .rt-bike { position: absolute; left: 0%; top: 50%; transform: translate(-55%, -56%) scaleX(-1); font-size: 16px; line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
#hud .race-timer .rt-ghost { position: absolute; left: 0%; top: 50%; transform: translate(-50%, -56%); font-size: 12px; line-height: 1; opacity: 0.8; display: none; }
#hud .race-timer .rt-flag { position: absolute; right: -3px; top: 50%; transform: translateY(-58%); font-size: 12px; line-height: 1; }
#hud .race-timer .rt-cur { font: 800 20px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ink); letter-spacing: 0.5px; }
#hud .race-timer .rt-best { font: 600 11px system-ui, sans-serif; color: var(--ink-dim); letter-spacing: 0.4px; }
/* the tap-out ✕: the one interactive part of the chip; arms red, second tap quits */
#hud .race-timer .rt-quit {
  pointer-events: auto; cursor: pointer; user-select: none; -webkit-user-select: none;
  font: 700 12px system-ui, sans-serif; color: #9fb1c2; padding: 3px 7px; margin: -2px -6px -2px 0;
  border-radius: 8px; border: 1px solid transparent; transition: color 0.15s ease, background 0.15s ease;
}
#hud .race-timer .rt-quit:hover { color: #e8a89a; }
#hud .race-timer .rt-quit.arm { color: #fff; background: rgba(216,90,74,0.55); border-color: rgba(216,90,74,0.8); }
/* the end-of-Level-1 "Seasons Unlocked" reward — a richer take on the chapter card */
#hud .chapter.reward { background: radial-gradient(ellipse at center, rgba(14, 22, 34, 0.9), rgba(8, 12, 20, 0.97)); }
#hud .chapter.reward .big { animation: rewardBloom 0.7s cubic-bezier(.2, .85, .25, 1) both; }
#hud .chapter.reward .schips { display: block; font-size: 32px; letter-spacing: 8px; margin: 2px 0 14px; animation: rewardBloom 0.6s 0.12s ease both; }
#hud .chapter.reward .schips b { font-style: normal; animation: chipPulse 1.5s ease-in-out infinite; }
@keyframes rewardBloom { from { transform: scale(0.72); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes chipPulse { 0%, 100% { filter: drop-shadow(0 0 1px #bfe3ff); } 50% { filter: drop-shadow(0 0 10px #cdeeff); } }
/* ── Level 2 promo: the cinematic "next level" reveal the moment Level 1 is finished.
   A night harbor sky with a sweeping lighthouse beam (the L2 motif — "The Light That
   Walks") and drifting snow (winter is coming), the LEVEL 2 title blooming in, then a
   Begin button that carries you into the winter Level 2. */
#hud .levelpromo {
  position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; padding: 0 24px;
  overflow: hidden; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at 50% 34%, #1b2c46 0%, #0c1422 56%, #060a12 100%);
  transition: opacity 0.55s ease;
}
#hud .levelpromo.show { opacity: 1; pointer-events: auto; }
/* This panel hides with opacity, NOT display:none — which means every animation inside
   it ran from boot to quit on something nobody could see, including a 160vmax
   mix-blend-mode conic gradient sweeping every 5.5s. Paused rather than removed so the
   entrance still plays from frame one when .show lands (a paused animation holds its
   currentTime, and these were parked at 0). Catches anything added here later too. */
#hud .levelpromo:not(.show) * { animation-play-state: paused !important; }
#hud .levelpromo .lp-beam {
  position: absolute; top: -6%; left: 50%; width: 160vmax; height: 160vmax;
  transform-origin: 50% 0; pointer-events: none; mix-blend-mode: screen;
  background: conic-gradient(from -24deg at 50% 0, transparent 6deg,
    rgba(255,243,200,0.06) 12deg, rgba(255,248,214,0.40) 24deg, rgba(255,243,200,0.06) 36deg, transparent 42deg);
  animation: lpSweep 5.5s ease-in-out infinite;
}
#hud .levelpromo .lp-lamp {
  position: absolute; top: -4%; left: 50%; width: 26px; height: 26px; transform: translate(-50%,-50%);
  border-radius: 50%; background: #fff7d2; box-shadow: 0 0 46px 20px rgba(255,240,190,0.7);
  pointer-events: none; animation: lpFlare 5.5s ease-in-out infinite;
}
#hud .levelpromo .lp-snow { position: absolute; inset: 0; pointer-events: none; }
#hud .levelpromo .lp-snow i {
  position: absolute; top: -6%; border-radius: 50%; background: #eef4ff;
  animation: lpFall linear infinite;
}
#hud .levelpromo .lp-inner { position: relative; z-index: 2; max-width: 580px; }
#hud .levelpromo .lp-kick {
  font-size: 13px; letter-spacing: 6px; font-weight: 800; color: #8fe0c2;
  text-shadow: 0 0 14px rgba(120,230,190,0.5); margin-bottom: 6px; animation: lpUp 0.6s 0.05s both;
}
#hud .levelpromo .lp-lvl {
  font-family: Georgia, serif; font-weight: 800; line-height: 0.95; white-space: nowrap;
  font-size: clamp(46px, 13vw, 92px); letter-spacing: 2px;
  background: linear-gradient(180deg, #fff6db 0%, var(--gold-bright) 50%, var(--gold) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 4px 20px rgba(0,0,0,0.55)); animation: lpBloom 0.85s 0.2s cubic-bezier(.18,.9,.22,1) both;
}
#hud .levelpromo .lp-title {
  font-family: Georgia, serif; font-style: italic; font-size: clamp(20px, 5.4vw, 34px);
  color: #f3ead2; margin-top: 4px; animation: lpUp 0.6s 0.52s both;
}
#hud .levelpromo .lp-tag {
  font-size: clamp(13px, 3.5vw, 15px); line-height: 1.5; color: #bccddf;
  margin: 14px auto 0; max-width: 26em; animation: lpUp 0.6s 0.72s both;
}
#hud .levelpromo .lp-go {
  /* inherit pointer-events from .levelpromo (none until .show) — an explicit auto
     here would leave this invisible, screen-centered button eating touches and
     dead-zoning the joystick after the level-up promo is dismissed */
  margin-top: 24px; cursor: pointer; border: 0; font-family: inherit;
  font-weight: 800; font-size: 16px; letter-spacing: 2px; color: rgb(var(--maroon));
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid)); padding: 14px 32px; border-radius: 30px;
  animation: lpAppear 0.5s 0.92s both, lpBtn 2.2s 1.6s ease-in-out infinite; transition: transform 0.12s ease;
}
#hud .levelpromo .lp-go:hover { transform: scale(1.05); }
#hud .levelpromo .lp-go:active { transform: scale(0.96); }
#hud .levelpromo .lp-hint { font-size: 11.5px; letter-spacing: 0.4px; color: #8aa0b8; margin-top: 16px; animation: lpAppear 0.6s 1.15s both; }
@keyframes lpSweep { 0%, 100% { transform: translateX(-50%) rotate(-25deg); } 50% { transform: translateX(-50%) rotate(25deg); } }
@keyframes lpFlare { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes lpFall { to { transform: translateY(112vh) translateX(24px); } }
@keyframes lpUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lpAppear { from { opacity: 0; } to { opacity: 1; } }
@keyframes lpBloom { 0% { opacity: 0; transform: scale(0.6); } 62% { opacity: 1; transform: scale(1.06); } 100% { transform: scale(1); } }
@keyframes lpBtn { 0%, 100% { box-shadow: 0 6px 18px rgba(0,0,0,0.4); } 50% { box-shadow: 0 0 24px rgba(var(--gold-rgb),0.65), 0 6px 18px rgba(0,0,0,0.4); } }
@media (prefers-reduced-motion: reduce) {
  #hud .levelpromo .lp-beam, #hud .levelpromo .lp-lamp, #hud .levelpromo .lp-snow i,
  #hud .levelpromo .lp-go { animation-duration: 0.01ms; animation-iteration-count: 1; }
}
/* ── feature promo: a reusable "what's new" card for a freshly-shipped feature.
   A compact popover (NOT the full-screen level promo) — badge + icon + title +
   blurb + a CTA. featurePromo() fills it in and shows it once per feature key. */
#hud .promo {
  position: absolute; inset: 0; z-index: 58; display: flex; align-items: flex-end; justify-content: center;
  padding: 0 16px 92px; pointer-events: none; opacity: 0; transition: opacity 0.25s ease;
}
#hud .promo.show { opacity: 1; pointer-events: auto; }
#hud .promo-card {
  position: relative; width: min(380px, 92vw); text-align: center;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.55); border-bottom: 3px solid var(--gold);
  border-radius: 16px; padding: 20px 20px 16px; box-shadow: var(--shadow-card);
  transform: translateY(22px) scale(0.96); opacity: 0;
}
#hud .promo.show .promo-card { animation: nbpt-promo-in 0.4s var(--ease-spring) forwards; }
@keyframes nbpt-promo-in { to { transform: translateY(0) scale(1); opacity: 1; } }
/* Small on purpose, but only to LOOK at: the box is a full 44px target and the dark
   circle is painted on the 30px content box inside it, so a thumb that lands near the
   corner still closes the card. Visual size is a design choice, hit area never is. */
#hud .promo-x {
  position: absolute; top: 1px; right: 3px; width: 44px; height: 44px; padding: 7px;
  box-sizing: border-box; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1;
  color: #cdbf94; background: rgba(0,0,0,0.3); background-clip: content-box;
  cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .promo-badge {
  display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: 2px; color: rgb(var(--maroon));
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid)); padding: 3px 11px; border-radius: 11px; margin-bottom: 10px;
}
#hud .promo-icon { font-size: 40px; line-height: 1; margin-bottom: 8px; }
#hud .promo-title {
  font-family: Georgia, serif; font-weight: 800; font-size: 22px; color: #f6efda; margin-bottom: 7px;
}
#hud .promo-body { font-size: 13.5px; line-height: 1.5; color: #c8d2dd; margin: 0 auto 16px; max-width: 30em; }
#hud .promo-acts { display: flex; flex-direction: column; align-items: center; gap: 8px; }
#hud .promo-cta {
  /* No explicit pointer-events here: inherit from the parent .promo, which is
     none until it has .show. Otherwise the invisible CTA stays clickable after
     dismissal and, sitting bottom-center, steals taps from the talk button
     (e.g. pressing RIBBIT teleported you to the airport). */
  cursor: pointer; border: 0; font-family: inherit; font-weight: 800;
  font-size: 14.5px; letter-spacing: 0.6px; color: rgb(var(--maroon));
  background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid)); padding: 12px 26px; border-radius: 24px;
  transition: transform 0.12s var(--ease-out); width: 100%; max-width: 260px; min-height: 44px;
}
#hud .promo-cta:hover { transform: scale(1.04); }
#hud .promo-cta:active { transform: scale(0.96); }
/* "Maybe later" stays visually quiet, but it is the escape hatch from a card that
   covers the screen — it gets the same 44px of thumb as the CTA it sits under. */
#hud .promo-skip {
  font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: #9aa7b4; cursor: pointer;
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px;
}
#hud .promo-skip:hover { color: #cdbf9a; }
/* first-run mode pick — explore vs play. Reuses the promo card look; two stacked
   choices, Explore framed as the gentle default (dismiss/backdrop = explore too). */
#hud .modepick {
  position: absolute; inset: 0; z-index: 59; display: flex; align-items: center; justify-content: center;
  padding: 0 16px; pointer-events: none; opacity: 0; transition: opacity 0.25s ease;
  background: rgba(12, 17, 24, 0.45);
}
#hud .modepick.show { opacity: 1; pointer-events: auto; }
#hud .modepick-card {
  position: relative; width: min(380px, 92vw); text-align: center;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.55); border-bottom: 3px solid var(--gold);
  border-radius: 16px; padding: 22px 20px 18px; box-shadow: var(--shadow-card);
  transform: translateY(22px) scale(0.96); opacity: 0;
}
#hud .modepick.show .modepick-card { animation: nbpt-promo-in 0.4s var(--ease-spring) forwards; }
#hud .modepick-icon { font-size: 38px; line-height: 1; margin-bottom: 6px; }
#hud .modepick-title { font-family: Georgia, serif; font-weight: 800; font-size: 22px; color: #f6efda; margin-bottom: 6px; }
#hud .modepick-body { font-size: 13.5px; line-height: 1.5; color: #c8d2dd; margin: 0 auto 16px; max-width: 30em; }
#hud .modepick-acts { display: flex; flex-direction: column; align-items: stretch; gap: 9px; }
#hud .modepick-acts button {
  pointer-events: none; cursor: pointer; border: 0; font-family: inherit; font-weight: 800;
  font-size: 14.5px; letter-spacing: 0.4px; padding: 13px 18px; border-radius: 13px;
  transition: transform 0.12s var(--ease-out);
}
/* only live while the modal is actually up — otherwise these flex-centered, invisible
   buttons keep eating touches mid-screen and dead-zone the joystick (pointer-events:auto
   on a child overrides the dismissed parent's pointer-events:none) */
#hud .modepick.show .modepick-acts button { pointer-events: auto; }
#hud .modepick-acts button:active { transform: scale(0.97); }
#hud .modepick-acts .mp-explore { color: rgb(var(--maroon)); background: linear-gradient(180deg, var(--gold-bright), var(--gold-mid)); }
#hud .modepick-acts .mp-explore:hover { transform: scale(1.03); }
#hud .modepick-acts .mp-story {
  color: var(--ink); background: rgba(var(--ink-rgb),0.06); border: 1.5px solid rgba(var(--ink-rgb),0.32);
}
#hud .modepick-acts .mp-story:hover { border-color: var(--gold); }
#hud .modepick-acts .mp-sub { display: block; font-weight: 600; font-size: 11.5px; opacity: 0.8; margin-top: 2px; letter-spacing: 0; }
#hud .modepick-foot { font-size: 11px; color: #8b97a4; margin-top: 13px; line-height: 1.4; }
/* one-time nudge that you can run — shown a few seconds into the first walk */
#hud .runtip {
  position: absolute; bottom: 104px; left: 50%; transform: translate(-50%, 10px);
  background: rgba(var(--maroon-lt),0.92); border: 1px solid rgba(var(--gold-rgb),0.55);
  color: var(--ink); font-size: 13px; font-weight: 600; letter-spacing: 0.3px;
  padding: 9px 16px; border-radius: 18px; white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease; z-index: 12;
}
#hud .runtip b { color: var(--gold-bright); }
#hud .runtip.show { opacity: 1; transform: translate(-50%, 0); }
/* first-visit nudge: the real map — tap to find your street (replaces the old welcome gate) */
#hud .streettip {
  position: absolute; top: 60px; left: 50%; transform: translate(-50%, -8px);
  max-width: min(360px, 88vw); text-align: center;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.6); border-bottom: 3px solid var(--gold);
  color: var(--ink); font-size: 13px; font-weight: 600; letter-spacing: 0.3px; line-height: 1.5;
  padding: 11px 18px; border-radius: 14px; pointer-events: auto; cursor: pointer;
  opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; z-index: 30;
}
#hud .streettip b { color: var(--gold-bright); }
#hud .streettip.show { opacity: 1; transform: translate(-50%, 0); }

/* ════════════════════════════════════════════════════════════════════
   DESIGN-SYSTEM POLISH LAYER — loaded last so it refines the base rules
   above. Base owns layout + position; this owns the *material* (blur +
   depth), the *tactile feel* (hover/press), and *cohesive motion*. */

/* ── round chrome buttons: one shared material + feel ──────────────── */
#hud .compass, #hud .travel-btn, #hud .settings-btn, #hud .season-toggle,
#hud .journey-btn, #hud .bag-btn, #hud .race-btn {
  background: var(--chrome-bg);
  border: 1.5px solid var(--chrome-bd);
  -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  box-shadow: var(--shadow-btn);
  transition: transform 0.14s var(--ease-out), border-color 0.18s ease,
    background 0.18s ease, box-shadow 0.18s ease, top 0.3s ease;
}
/* the 5 interactive ones lift on hover + press in on tap (compass is read-only) */
#hud .travel-btn:hover, #hud .settings-btn:hover, #hud .season-toggle:hover,
#hud .journey-btn:hover, #hud .bag-btn:hover, #hud .race-btn:hover {
  transform: scale(1.07); border-color: var(--gold);
  background: rgba(var(--maroon), 0.82);
  box-shadow: 0 6px 18px rgba(0,0,0,0.46), 0 0 0 1px rgba(var(--gold-rgb), 0.28);
}
#hud .travel-btn:active, #hud .settings-btn:active, #hud .season-toggle:active,
#hud .journey-btn:active, #hud .bag-btn:active, #hud .race-btn:active,
#hud .run-btn:active, #hud .bike-btn:active, #hud .bark-btn:active, #hud .talk-btn:active,
#hud .modal-x:active { transform: scale(0.9); }
/* journey + bag open panels — keep their gold ring after the group reset above */
#hud .journey-btn, #hud .bag-btn { border-color: rgba(var(--gold-rgb), 0.6); }

/* ── action buttons (run / bike / talk): material + press ──────────── */
#hud .run-btn, #hud .bike-btn, #hud .bark-btn {
  -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  box-shadow: var(--shadow-btn);
  transition: transform 0.14s var(--ease-out), border-color 0.18s ease, background 0.18s ease;
}
#hud .talk-btn {
  box-shadow: 0 4px 14px rgba(0,0,0,0.4), 0 0 22px rgba(var(--gold-rgb), 0.34);
  transition: transform 0.14s var(--ease-out), box-shadow 0.2s ease;
}
#hud .talk-btn.show { animation: nbpt-talk-in 0.34s var(--ease-spring) backwards; }
@keyframes nbpt-talk-in { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ── modals: blur the world behind, unified scrim ──────────────────── */
#hud .travel-panel, #hud .journey-panel, #hud .bag-panel {
  background: var(--scrim);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
}
/* travel card now springs in like journey/bag (panel converted to the fade pattern) */
#hud .travel-card {
  box-shadow: var(--shadow-card); opacity: 0;
  transform: translateY(18px) scale(0.96);
  transition: transform 0.28s var(--ease-spring), opacity 0.2s ease;
}
#hud .travel-panel.open .travel-card { transform: translateY(0) scale(1); opacity: 1; }

/* ── cards: unified depth + a soft-spring popover ──────────────────── */
#hud .hcard, #hud .bag-card, #hud .journey-card, #hud .streettip { box-shadow: var(--shadow-card); }
#hud .season-pop { box-shadow: var(--shadow-card); transform-origin: top left; animation: nbpt-pop-in 0.2s var(--ease-spring); }
@keyframes nbpt-pop-in { from { transform: scale(0.86) translateY(-4px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

/* ── modal close: a real, high-contrast 44px target (kid-hand floor) ── */
#hud .modal-x {
  width: 44px; height: 44px; font-size: 19px; color: var(--ink-dim);
  background: rgba(0,0,0,0.3); border: 1px solid rgba(var(--ink-rgb),0.12);
  transition: transform 0.14s var(--ease-out), background 0.18s ease, color 0.18s ease;
}
#hud .modal-x:hover { background: rgba(var(--gold-rgb), 0.24); color: var(--gold-bright); border-color: rgba(var(--gold-rgb), 0.5); }

/* ── pills: material + tactile (no entrance — they're persistent) ──── */
#hud .objective {
  -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  box-shadow: var(--shadow-pill);
  transition: transform 0.13s var(--ease-out), box-shadow 0.18s ease, opacity 0.2s ease, padding 0.2s ease;
}
#hud .objective:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.42), 0 0 0 1px rgba(var(--gold-rgb), 0.45); }
#hud .objective:active { transform: translateX(-50%) scale(0.97); }
#hud .pill { -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); box-shadow: var(--shadow-pill); }
/* small floating prompts + the landmark banner share the pill depth */
#hud .banner, #hud .runtip, #hud .bag-tip { box-shadow: var(--shadow-pill); }

/* ── dialogue: slides up on open; livelier Next / Back ─────────────── */
#hud .dlg { box-shadow: var(--shadow-card); }
#hud .dlg.open { animation: nbpt-dlg-in 0.3s var(--ease-spring); }
@keyframes nbpt-dlg-in { from { transform: translateX(-50%) translateY(16px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
#hud .dlg .dlg-next { box-shadow: 0 0 16px rgba(var(--gold-rgb), 0.42); transition: transform 0.12s var(--ease-out), background 0.16s ease; }
#hud .dlg .dlg-next:active, #hud .dlg .dlg-back:active { transform: scale(0.94); }

/* ── list rows everywhere: gentle press + smooth hover ─────────────── */
#hud .travel-item, #hud .sp-item, #hud .j-tab, #hud .bag-grid .jitem, #hud .m-row {
  transition: background 0.15s ease, transform 0.1s var(--ease-out), border-color 0.15s ease;
}
#hud .travel-item:active, #hud .sp-item:active,
#hud .j-tab:active, #hud .bag-grid .jitem.tappable:active, #hud .m-row:active { transform: scale(0.98); }

/* ── input focus: a clear gold ring ────────────────────────────────── */
#hud .travel-search:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(var(--gold-rgb), 0.22); }

/* ── the LIVELY layer: promoted out of the fast-travel panel ─────────
   Fast travel got this vocabulary first (dc120da) and it was the panel Devin
   actually liked, so it lives here now rather than in one panel's private CSS.
   Four pieces, and every one is transform/opacity only — no layout thrash:

     nbpt-tile-in   a list arrives one tile at a time instead of all at once
     .nb-chip       an emoji in a raised rimmed box reads as an OBJECT, not text
     lift + squash  hover raises, press physically presses
     .nb-slab       a headline button: gradient, own shadow, sheen, chunky press

   Anything grid-shaped should use all four. Stagger delays come from stagger()
   in the class below, so a new panel gets the wave for free. */
@keyframes nbpt-tile-in { from { opacity: 0; transform: translateY(14px) scale(0.94); } to { opacity: 1; transform: none; } }

/* Every JS-built list/grid in the HUD, arriving.
   backwards, NOT both: a forwards/both fill keeps the final keyframe applied forever,
   and an animation outranks normal declarations — so "both" silently kills the
   :hover lift and :active squash below. (It was doing exactly that to the travel
   tiles.) backwards holds the from-state through the stagger delay, then lets go. */
#hud .travel-panel.open .travel-grid .travel-item,
#hud .travel-panel.towns .tt-chip,
#hud .collect-panel.show .ctile,
#hud .race-pop.open .rp-item,
#hud .season-pop.open .sp-item,
#hud .settings-pop.open .sp-row,
#hud .settings-pop.open .sp-mbtn {
  animation: nbpt-tile-in 0.34s var(--ease-pop) backwards;
}

/* the raised chip that turns an emoji into an object */
#hud .nb-chip, #hud .travel-item .ti-em, #hud .sp-mbtn .m-em, #hud .season-pop .sp-item .nb-chip {
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: linear-gradient(150deg, rgba(var(--gold-rgb), 0.26), rgba(var(--gold-rgb), 0.07));
  border: 1px solid rgba(var(--gold-rgb), 0.28);
  box-shadow: inset 0 1px 0 rgba(255,245,210,0.22);
}
#hud .travel-item .ti-em { flex: none; width: 34px; height: 34px; font-size: 19px; }
#hud .sp-mbtn .m-em { width: 30px; height: 30px; font-size: 17px; margin: 0 auto; }
#hud .season-pop .sp-item { display: flex; align-items: center; gap: 9px; }
#hud .season-pop .sp-item .nb-chip { flex: none; width: 30px; height: 30px; font-size: 16px; }

/* lift on hover, squash on press — the whole tactile family in one place */
#hud .ctile, #hud .rp-item, #hud .sp-mbtn, #hud .sp-item, #hud .sp-row, #hud .travel-item {
  transition: transform 0.13s var(--ease-out), background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
#hud .ctile:hover, #hud .rp-item:hover, #hud .sp-mbtn:hover, #hud .travel-item:hover,
#hud .season-pop:not(.locked) .sp-item:hover, #hud .sp-row:hover { transform: translateY(-2px); }
#hud .ctile:active, #hud .rp-item:active, #hud .sp-mbtn:active, #hud .travel-item:active,
#hud .season-pop:not(.locked) .sp-item:active, #hud .sp-row:active { transform: scale(0.96); }

/* ── the album, as a trophy case ─────────────────────────────────────
   36 flat rectangles was a spreadsheet of the thing you collect. A FOUND tile sits on
   a shadow and keeps its gold rim; a locked one stays deliberately quiet and flat, so
   the difference between "mine" and "still out there" is visible across the room. */
#hud .ctile.got {
  box-shadow: 0 4px 12px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,240,200,0.14);
}
#hud .ctile.got .cpic { position: relative; }
/* ── picking a card up off the shelf ─────────────────────────────────
   These are the main thing in the game you actually touch, so hovering one should
   feel like reaching for it: the whole tile lifts (shared rule above), the picture
   pushes in slightly under the frame, the rim warms, and the title brightens.
   The zoom is on the picture's CONTENTS, not the .cpic box — scaling the box would
   push it over the title underneath, since transforms do not re-flow. */
#hud .ctile .cpic { overflow: hidden; }
#hud .ctile .cpic img, #hud .ctile .cpic .cem { transition: transform 0.22s var(--ease-out); }
#hud .ctile:hover .cpic img { transform: scale(1.07); }
#hud .ctile:hover .cpic .cem { transform: scale(1.12); }
#hud .ctile.got:hover {
  border-color: var(--gold-mid);
  box-shadow: 0 9px 22px rgba(0,0,0,0.46), 0 0 0 1px rgba(var(--gold-rgb),0.55);
}
#hud .ctile.got:hover .cnm { color: #fff8e6; }
/* a locked slot is clickable too (it opens the teaser + where to look), so it has to
   answer the pointer — just in cool grey rather than gold, keeping the found/unfound
   distinction intact even mid-hover */
#hud .ctile.locked:hover {
  border-color: rgba(var(--ink-rgb),0.4); background: rgba(var(--ink-rgb),0.1);
  box-shadow: 0 8px 18px rgba(0,0,0,0.38);
}
#hud .ctile.locked:hover .cpic .cem { opacity: 0.78; filter: grayscale(0.35); }
#hud .ctile.locked:hover .cnm { color: #ded7c4; }
/* found tiles catch the light again on touch — one pass, and a SEPARATE keyframe name
   from the arrival glint on purpose: re-declaring the same animation-name on :hover
   would let the finished animation sit there, not restart it. */
#hud .ctile.got:hover .cpic::before { animation: nbpt-glint-hover 0.45s ease-out backwards; }
@keyframes nbpt-glint-hover { from { left: var(--glint-from, -50px); } to { left: 118%; } }
/* ONE glint per tile, as it lands — never a loop.
   A permanent shimmer is noise: 36 tiles quietly strobing behind whatever you are
   actually reading. This fires once when the grid opens, chases each tile's own
   entrance (--sheen-lag = that tile's stagger delay + a beat), and is over in a third
   of a second. The point is that the wall catches the light as it arrives, then holds
   still. Deliberately faint — if you can watch it, it is too strong. */
#hud .ctile.got .cpic::before {
  content: ''; position: absolute; top: -60%; bottom: -60%; width: 30px; left: -50px; z-index: 1;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.16), transparent);
  transform: skewX(-18deg);
  animation: nbpt-glint 0.34s ease-out var(--sheen-lag, 0s) 1 backwards;
}
@keyframes nbpt-glint { from { left: var(--glint-from, -50px); } to { left: 118%; } }
/* the count is the payoff line — it lands after the card, not with it */
#hud .hcard.fresh .hcount { animation: nbpt-tile-in 0.4s var(--ease-pop) 0.45s backwards; }
/* and the progress bar fills rather than appearing already full */
#hud .collect-prog i { transition: width 0.7s var(--ease-out); }

/* ── the HUD arrives, instead of being there ─────────────────────────
   First impression: the left column deals itself in like a hand of cards. One
   time, on boot only — .booted is added a frame after the HUD mounts. */
#hud.booted .travel-btn, #hud.booted .settings-btn, #hud.booted .collect-btn,
#hud.booted .season-toggle, #hud.booted .race-btn, #hud.booted .compass {
  animation: nbpt-chrome-in 0.42s var(--ease-pop) backwards;
}
@keyframes nbpt-chrome-in { from { opacity: 0; transform: scale(0.6) translateY(-8px); } to { opacity: 1; transform: none; } }

/* ── respect reduced-motion ────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  #hud *, #hud *::before, #hud *::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.08s !important;
    /* stagger() writes inline animation-delay, and zeroing only the DURATION would
       leave a reduced-motion user watching tiles snap in one at a time over 0.4s —
       the cascade, just uglier. Kill the delay too, and the grid simply is there. */
    animation-delay: 0s !important;
  }
}
`;

// The Fast-Travel town switcher reads the shared registry (src/towns/registry.ts)
// — every town's bundle lists its siblings, so adding a town there updates all builds.

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
  flying = false;   // ✈️ scenic flight — the quest yields its action button so LAND owns it
  kayaking = false; // 🛶 free-roam kayak — quest yields so HOP OUT owns the action button
  sweeping = false; // 🔦 Level 2 finale beam-sweep — quest reads beamAz + yields its action button
  beamAz = Math.PI; // live lighthouse-beam compass direction (Game writes it; the quest rotates the beam + catches boats)

  private dlgEl!: HTMLElement;
  private dlgWho!: HTMLElement;
  private dlgLine!: HTMLElement;
  private dlgNext!: HTMLElement;
  private dlgBack!: HTMLElement;
  private dlgLines: { who: string; text: string }[] = [];
  private dlgIdx = 0;
  private dlgDone: (() => void) | null = null;
  private dlgCool = 0;
  private talkCb: (() => void) | null = null;
  private hcardOpen = false;

  // ---- Backpack (🎒) state — all session-only, never persisted ----
  private bagItems: BagItem[] = [];                   // last set by the quest (carry/treasure/collection)
  private bagMounted = false;                         // the constructor's first apply() is a silent mount
  private bagEverShown = false;                       // has the 🎒 button been revealed yet?
  private bagSeen = new Set<string>();                // item ids the player has already had
  private bagNewIds = new Set<string>();              // ids to badge "NEW" / flash until the bag is opened
  private bagTipShown = false;                        // one-time "this is your backpack" toast
  private bagPanelOpen = false;
  // ---- Missions (🧭) state ----
  private missions: Mission[] = [];
  private journeyTab: 'story' | 'collections' = 'story';   // journey panel: Story | Collections
  // history markers (for the Town-stories collection + its album), shared by bag + missions
  private histMarkers: { id: string; title: string; year: string; body: string; stamp?: string; hint?: string | null; icon?: string }[] = [];
  private albumPanel: HTMLElement | null = null;

  private root: HTMLElement;            // the #hud element itself (for explore-mode class toggling)
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
  // a touch that began on the run/bike button: held here until it either lifts (a tap — the
  // button's own click toggles it) or drags far enough to become the joystick (so the lower-right
  // steering thumb isn't a dead zone). Anchored at the original down point.
  private joyPend: { id: number; x: number; y: number } | null = null;
  private bannerTimer = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  // PINCH TO ZOOM. Two fingers already meant SPRINT, so the gesture has to be shared: a
  // sprint is two fingers HELD, a pinch is two fingers whose SEPARATION CHANGES. The second
  // finger stays a sprint until the gap moves past PINCH_SLOP, at which point it commits to
  // a pinch for as long as both fingers are down — and cancels the sprint and the steering
  // stick it had already started, so the kid doesn't bolt across the street while zooming.
  private pinch: { last: number; from: number; active: boolean } | null = null;
  onPinch?: (mult: number) => void;         // multiplier on camZoom: >1 pulls back, <1 moves in
  onTap?: (x: number, y: number) => void;   // a quick tap/click on the world (drives tap-to-pet)
  private tapDown: { x: number; y: number; id: number; t: number; moved: boolean } | null = null;

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div class="pill"><span class="dot"></span><span class="txt"></span></div>
      <div class="banner"><div class="name"></div><div class="sub"></div></div>
      <div class="corner help">WASD / arrows · R run · Shift sprint · F bark (hold to sniff) · V look up · C camera · M travel &amp; search · wheel zoom</div>
      <div class="corner attr">Map data © OpenStreetMap contributors</div>
      <div class="stick-base"></div><div class="stick-knob"></div>
      <div class="compass"><div class="needle">N</div></div>
      <div class="travel-btn" title="Travel (M)">🗺<span class="blab">MAP</span></div>
      <div class="journey-btn" title="Missions (J)">🧭<span class="blab">QUESTS</span></div>
      <div class="bag-btn" title="Backpack (I)">🎒<span class="bag-badge">NEW</span><span class="blab">BAG</span></div>
      <div class="bag-tip"></div>
      <div class="settings-btn" title="Settings">⚙️<span class="blab">SETTINGS</span></div>
      <div class="settings-hint">📖 Story mode lives here — tap ⚙️ anytime</div>
      <div class="settings-pop">
        <div class="sp-hdr">SETTINGS</div>
        <div class="sp-row" data-set="story">
          <div class="sp-label"><div class="sp-name">📖 Story mode</div><div class="sp-sub">Follow the town's story, with a guide. Off = free explore.</div></div>
          <div class="sp-sw"></div>
        </div>
        <div class="sp-row" data-set="sound">
          <div class="sp-label"><div class="sp-name">🔊 Sound</div><div class="sp-sub">Music &amp; effects</div></div>
          <div class="sp-sw"></div>
        </div>
        <div class="sp-row" data-set="ghost">
          <div class="sp-label"><div class="sp-name">👻 Ghost rider</div><div class="sp-sub">Race the town's best line. Off = just you and the clock.</div></div>
          <div class="sp-sw"></div>
        </div>
        <div class="sp-music">
          <div class="sp-mhdr">🎵 MUSIC</div>
          <div class="sp-mrow"></div>
          <div class="sp-msub"></div>
        </div>
        <div class="sp-collar">
          <div class="sp-mhdr">🐕 CLIPPER'S COLLAR</div>
          <div class="sp-crow"></div>
        </div>
      </div>
      <div class="run-btn" title="Run (R)">🏃<span class="kc">R</span><span class="blab">RUN</span></div>
      <div class="bark-btn" title="Bark (F) — hold to sniff">🐾<span class="kc">F</span><span class="blab">BARK</span></div>
      <div class="bike-btn" title="Bike (B)"><svg viewBox="0 0 36 24" width="30" height="20" fill="none" stroke="#f3f1e8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="16" r="6"/><circle cx="28" cy="16" r="6"/><path d="M8 16 L16 16 L13 6 L8 16 M16 16 L22 6 L13 6 M22 6 L28 16"/><path d="M11 6 L15 6"/><path d="M22 6 L25 5"/></svg><span class="kc">B</span><span class="blab">BIKE</span></div>
      <div class="look-btn" title="Look up (V)">👀<span class="kc">V</span><span class="blab">LOOK UP</span></div>
      <div class="season-toggle" title="Season"><span class="s-em">🍂</span><span class="blab">SEASON</span></div>
      <div class="season-pop"></div>
      <div class="race-btn" title="Races">🏁<span class="blab">RACE</span></div>
      <div class="race-pop"></div>
      <div class="board-panel"><div class="board-card"></div></div>
      <div class="travel-panel"><div class="travel-card"><div class="modal-x">✕</div>
        <h2><span class="tv-title">${TOWN.name}</span><span class="tv-back">‹ ${TOWN.name}</span></h2>
        <div class="tv-switch"><span class="tv-sw-arrow">‹</span><span class="tv-sw-txt">Towns</span><span class="tv-sw-faces"></span></div>
        <div class="tv-here"><input class="travel-search" type="text" placeholder="${TOWN.searchPlaceholder}" /><div class="travel-results"></div><div class="travel-grid"></div></div>
        <div class="tv-towns"><div class="tt-hdr"><span>EXPLORE ANOTHER TOWN</span><span class="tt-count"></span></div><div class="tt-row"></div></div>
      </div></div>
      <div class="mini"><canvas></canvas><div class="me"></div></div>
      <div class="objective"><span class="q wp-q">➤</span><span class="otxt"></span></div>
      <div class="waypoint"><div class="wp-arrow">➤</div></div>
      <div class="race-count"></div>
      <div class="race-timer"><span class="rt-cur"></span><span class="rt-best"></span><span class="rt-quit">✕</span><div class="rt-track"><div class="rt-fill"></div><span class="rt-ghost">👻</span><span class="rt-bike">🚴</span><span class="rt-flag">🏁</span></div></div>
      <div class="runtip"></div>
      <div class="streettip"></div>
      <div class="dlg"><div class="who"></div><div class="line"></div><div class="dlg-foot"><span class="dlg-back">◂ Back</span><span class="dlg-next">Next ▸</span></div></div>
      <div class="talk-btn">💬 TALK</div>
      <div class="chapter"><div class="kick"></div><div class="big"></div><div class="small"></div><div class="namer"><input maxlength="12" placeholder="YOUR NAME"><button>SAVE</button></div></div>
      <div class="promo"><div class="promo-card"><div class="promo-x">✕</div><div class="promo-badge"></div><div class="promo-icon"></div><div class="promo-title"></div><div class="promo-body"></div><div class="promo-acts"><button class="promo-cta"></button><span class="promo-skip">Maybe later</span></div></div></div>
      <div class="levelpromo"><div class="lp-beam"></div><div class="lp-lamp"></div><div class="lp-snow"></div><div class="lp-inner"><div class="lp-kick">✦ LEVEL 1 COMPLETE ✦</div><div class="lp-lvl">LEVEL 2</div><div class="lp-title">The Light That Walks</div><div class="lp-tag">A lamp walks the shore at night, and the winter harbor needs its keeper. Your story sails on.</div><button class="lp-go">BEGIN ❄️</button><div class="lp-hint">❄️ Winter has come · change the season any time from the 🎄 button</div></div></div>
      <div class="hcard-back"><div class="hcard-wrap"><div class="hcard">
        <div class="hnew">✦ NEW DISCOVERY ✦</div>
        <div class="hpic"><span class="hpic-em">🏛</span></div>
        <div class="hbody"><div class="ht"></div><div class="hy"></div><div class="hb"></div></div>
        <div class="hcount"></div>
        <div class="hf"><div class="stamp">★ A TRUE STORY</div><div class="hacts"><div class="hclose">Got it ✓</div></div></div>
      </div></div></div>
      <div class="collect-btn" title="Your discoveries">🏛<span class="cb-n">0</span><span class="blab">DISCOVER</span></div>
      <div class="collect-panel"><div class="collect-card">
        <div class="modal-x">✕</div>
        <h2>🏛 YOUR DISCOVERIES</h2>
        <div class="collect-prog"><i style="width:0%"></i></div>
        <div class="collect-tally"></div>
        <div class="collect-grid"></div>
        <div class="collect-foot"><span class="cf-reset">Start the collection over</span></div>
      </div></div>
      <div class="modepick"><div class="modepick-card">
        <div class="modepick-icon">🧭</div>
        <div class="modepick-title">Welcome to Clipper Town</div>
        <div class="modepick-body">This is a living model of Newburyport — wander the real streets and harbor however you like. There's also a story woven through town, if you want one.</div>
        <div class="modepick-acts">
          <button class="mp-explore">Just explore<span class="mp-sub">roam free — no goals</span></button>
          <button class="mp-story">Follow the story<span class="mp-sub">a guided journey through town</span></button>
        </div>
        <div class="modepick-foot">You can switch any time under ⚙️ Settings.</div>
      </div></div>
      <div class="vignette"></div>
      <div class="fade"></div>
    `;
    document.body.appendChild(hud);
    // The left column deals itself in on boot rather than simply being there — the
    // first thing a kid sees the app do. Gated on a class added a frame LATER, and
    // added once, so the entrance can never replay when a button is shown or hidden
    // mid-session (the story chrome toggles .journey-btn / .bag-btn constantly).
    requestAnimationFrame(() => {
      const col = ['.travel-btn', '.settings-btn', '.collect-btn', '.season-toggle', '.race-btn', '.compass'];
      col.forEach((sel, i) => {
        const el = hud.querySelector(sel) as HTMLElement | null;
        if (el) el.style.animationDelay = i * 0.055 + 's';
      });
      hud.classList.add('booted');
    });
    // the bottom hint defaults to desktop keys; on a phone/tablet there's no
    // keyboard or mouse wheel, so show the on-screen touch controls instead.
    // Kept compact (icon + verb, no "Tap…to") so it clears the OSM attribution
    // on the same bottom line at phone widths.
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // tag the root so CSS can show keycap hints (R / B) on the action buttons
    // for keyboard players, and skip them on touch where the icon is the control.
    hud.classList.add(touch ? 'touch' : 'keys');
    if (touch) {
      (hud.querySelector('.help') as HTMLElement).textContent =
        'Drag to move · 🏃 Run · 💬 Talk';
    }
    this.root = hud;
    this.pill = hud.querySelector('.pill')!;
    this.banner = hud.querySelector('.banner')!;
    this.bannerName = hud.querySelector('.banner .name')!;
    this.bannerSub = hud.querySelector('.banner .sub')!;
    this.stickBase = hud.querySelector('.stick-base')!;
    this.stickKnob = hud.querySelector('.stick-knob')!;
    this.dlgEl = hud.querySelector('.dlg')!;
    this.dlgWho = hud.querySelector('.dlg .who')!;
    this.dlgLine = hud.querySelector('.dlg .line')!;
    this.dlgNext = hud.querySelector('.dlg .dlg-next')!;
    this.dlgBack = hud.querySelector('.dlg .dlg-back')!;
    this.dlgBack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();   // intercept before the dlg box's tap-to-advance handler
      this.backDlg();
    });
    this.dlgEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advanceDlg();
    });
    // Discovery card: the backdrop closes it, but the card body does NOT — a kid
    // dragging a finger down a long story shouldn't dismiss what they're reading.
    // Getting out is the explicit "Got it ✓" button (or the backdrop).
    const hback = hud.querySelector('.hcard-back') as HTMLElement;
    hback.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === hback) this.closeHistoryCard();
    });
    (hud.querySelector('.hcard .hclose') as HTMLElement).addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.closeHistoryCard();
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
      } else if (e.code === 'Backspace' || e.code === 'ArrowLeft') {
        e.preventDefault();
        this.backDlg();   // step back to re-read the previous line
      }
    });

    window.addEventListener('pointerdown', (e) => this.onDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private onDown(e: PointerEvent) {
    const tgt = e.target as HTMLElement;
    const onUI = !!tgt?.closest?.('.bark-btn, .travel-btn, .travel-panel, .journey-btn, .journey-panel, .bag-btn, .bag-panel, .bag-tip, .settings-btn, .settings-pop, .modepick, .talk-btn, .dlg, .objective, .hcard, .hcard-back, .collect-btn, .collect-panel, .race-btn, .race-pop');
    // run/bike sit right under the steering thumb: don't dead-zone them. A tap toggles (their own
    // click handler); a drag promotes to the joystick (handled in onMove). Defer either way.
    const onSoftBtn = !onUI && !!tgt?.closest?.('.run-btn, .bike-btn');
    // remember a press on the world (not UI, not a button) for tap-to-pet
    this.tapDown = (onUI || onSoftBtn) ? null : { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), moved: false };
    if (e.pointerType !== 'touch') return;
    if (onUI) return; // UI, not joystick
    if (onSoftBtn) {
      if (this.joyId === -1) this.joyPend = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return; // wait for a drag (onMove) before claiming the joystick
    }
    // a genuine steering touch: claim the gesture so iOS/Android browsers don't
    // hijack it as a scroll / toolbar swipe (which cancels the pointer mid-drag
    // and leaves a dead band near the bottom of the screen)
    e.preventDefault();
    // unlatch a dead joystick: iOS can swallow a pointer's up/cancel when it
    // tries to steal the drag, leaving joyId stuck so every later touch falls
    // through to the sprint branch and nothing steers. A fresh *primary* touch
    // means the old "first finger" is gone — reclaim instead of latching.
    if (this.joyId !== -1 && e.isPrimary) this.clearStick();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.joyId === -1) {
      this.joyId = e.pointerId;
      this.joyBaseX = e.clientX;
      this.joyBaseY = e.clientY;
      this.joyActive = true;
      this.placeStick(e.clientX, e.clientY, e.clientX, e.clientY);
    } else {
      this.sprintTouch = true;
      this.armPinch();
    }
  }

  // a second finger is a sprint UNTIL the gap between the two changes — see `pinch`
  private armPinch() {
    if (this.pointers.size !== 2) { this.pinch = null; return; }
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    this.pinch = { last: d, from: d, active: false };
  }

  private static readonly PINCH_SLOP = 26;   // px of separation change before it stops being a sprint

  private stepPinch() {
    if (!this.pinch || this.pointers.size !== 2) return;
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 1) return;
    if (!this.pinch.active) {
      if (Math.abs(d - this.pinch.from) < Hud.PINCH_SLOP) return;   // still just a two-finger sprint
      this.pinch.active = true;
      this.sprintTouch = false;   // it was never a sprint — don't leave the kid running
      // ⚠️ hideStick, NOT clearStick: clearStick DELETES the steering finger from `pointers`,
      // which drops the count to 1 and makes the next stepPinch bail — the pinch would kill
      // itself on the very frame it started. Both fingers must stay tracked until they lift.
      this.hideStick();           // stop steering, keep the finger
      this.pinch.last = d;
    }
    // fingers APART (d rising) pulls the camera IN, which is a smaller camZoom
    this.onPinch?.(this.pinch.last / d);
    this.pinch.last = d;
  }

  private onMove(e: PointerEvent) {
    // a deferred run/bike-button touch that's now clearly dragging takes over as the joystick,
    // anchored where the thumb first landed (so the throw direction reads from the real origin)
    if (this.joyPend && e.pointerId === this.joyPend.id) {
      if (Math.hypot(e.clientX - this.joyPend.x, e.clientY - this.joyPend.y) <= 10) return;
      this.joyId = e.pointerId;
      this.joyBaseX = this.joyPend.x;
      this.joyBaseY = this.joyPend.y;
      this.joyActive = true;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.joyPend = null;
    }
    if (this.tapDown && e.pointerId === this.tapDown.id && Math.hypot(e.clientX - this.tapDown.x, e.clientY - this.tapDown.y) > 12) this.tapDown.moved = true;
    // track every live finger, then test for a pinch — this must run BEFORE the joystick
    // bail-out below, since the pinch's second finger is not the steering pointer
    if (this.pointers.has(e.pointerId)) {
      this.pointers.get(e.pointerId)!.x = e.clientX;
      this.pointers.get(e.pointerId)!.y = e.clientY;
      this.stepPinch();
    }
    if (this.pinch?.active) { e.preventDefault(); return; }   // zooming, not steering
    if (e.pointerId !== this.joyId) return;
    e.preventDefault();   // keep the steering drag from becoming a browser gesture
    let dx = e.clientX - this.joyBaseX, dy = e.clientY - this.joyBaseY;
    // a bigger throw = finer steering (small finger moves no longer swing the
    // heading), and a wider walk→run range so you can creep through tight streets
    const d = Math.hypot(dx, dy), max = 64;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.placeStick(this.joyBaseX, this.joyBaseY, this.joyBaseX + dx, this.joyBaseY + dy);
    const dead = 0.1;
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
    // a deferred button touch that lifted without dragging was just a tap — drop the candidate
    // and let the button's own click toggle it
    if (this.joyPend && e.pointerId === this.joyPend.id) this.joyPend = null;
    if (this.tapDown && e.pointerId === this.tapDown.id) {
      const td = this.tapDown; this.tapDown = null;
      if (!td.moved && performance.now() - td.t < 500) this.onTap?.(e.clientX, e.clientY);
    }
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.joyId) {
      this.joyId = -1;
      this.joyActive = false;
      this.joyX = 0;
      this.joyY = 0;
      this.stickBase.style.display = 'none';
      this.stickKnob.style.display = 'none';
    }
    if (this.pointers.size !== 2) this.pinch = null;
    if (this.pointers.size <= 1) this.sprintTouch = false;
  }

  // tear down the active joystick without the tap/sprint bookkeeping in onUp —
  // used to unlatch a stale pointer so a new touch can take over steering
  private clearStick() {
    if (this.joyId !== -1) this.pointers.delete(this.joyId);
    this.hideStick();
    if (this.pointers.size <= 1) this.sprintTouch = false;
  }

  // stop steering but keep the finger tracked — the pinch needs both pointers alive
  private hideStick() {
    this.joyId = -1;
    this.joyActive = false;
    this.joyX = 0;
    this.joyY = 0;
    this.stickBase.style.display = 'none';
    this.stickKnob.style.display = 'none';
  }

  private placeStick(bx: number, by: number, kx: number, ky: number) {
    this.stickBase.style.display = 'block';
    this.stickKnob.style.display = 'block';
    this.stickBase.style.left = bx - 64 + 'px';
    this.stickBase.style.top = by - 64 + 'px';
    this.stickKnob.style.left = kx - 22 + 'px';
    this.stickKnob.style.top = ky - 22 + 'px';
  }

  private needle: HTMLElement | null = null;

  setCompass(rot: number) {
    if (!this.needle) this.needle = document.querySelector('#hud .compass .needle');
    if (this.needle) this.needle.style.transform = `rotate(${rot}rad)`;
  }

  // Explore mode (Story mode off) hides the story-progress chrome — the compass dial,
  // the 🧭 missions log, and the 🎒 backpack — via the #hud.no-story class (see CSS).
  // Driven from quest.apply()'s HUD sync point, so it tracks the initial state, the
  // first-run mode pick, and the settings-gear toggle alike.
  // world-only towns: tag #hud once at boot so CSS hides story-only chrome
  // (compass/missions/bag via the .no-story rules + the Story settings row)
  setBare(on: boolean) {
    const el = document.getElementById('hud');
    el?.classList.toggle('bare', on);
    el?.classList.toggle('no-story', on);
  }

  setStoryChrome(on: boolean) {
    this.root.classList.toggle('no-story', !on);
  }

  // ---------- races 🏁: countdown overlay + live timer chip ----------

  private raceGoT: ReturnType<typeof setTimeout> | null = null;
  private rtEl: HTMLElement | null = null;
  private rtCur: HTMLElement | null = null;
  private rtBest: HTMLElement | null = null;
  private rtQuit: HTMLElement | null = null;
  private rtFill: HTMLElement | null = null;
  private rtBike: HTMLElement | null = null;
  private rtGhost: HTMLElement | null = null;
  private fmtRace(s: number): string {
    const m = Math.floor(s / 60), sec = s - m * 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
  }

  /** 🏆 the town leaderboard modal — post-race results AND the picker's standings view.
   *  With `pendingTime` + `onName`, a dashed "claim" row sits at the run's would-be rank
   *  carrying an inline name box; a valid name re-renders the board with the rider on it. */
  private boardWired = false;
  raceBoard(opts: {
    course: string; sub: string;
    rows: { n: string; t: number }[];
    you: string | null;
    time?: string;             // this run, formatted (results mode)
    line?: string;             // flavor: placement call / claim prompt
    pendingTime?: number;      // unconfirmed run to claim
    prefill?: string;          // last rider's name, pre-typed in the claim box — one tap
                               // keeps it, typing over it switches riders (shared iPad)
    onName?: (raw: string) => { name: string; rows: { n: string; t: number }[]; line?: string } | null;
    onAgain?: () => void;      // results mode: RACE AGAIN — the most-wanted button after any finish
  }) {
    const panel = this.root.querySelector('.board-panel') as HTMLElement;
    const card = this.root.querySelector('.board-card') as HTMLElement;
    const hide = () => panel.classList.remove('show');
    if (!this.boardWired) {
      this.boardWired = true;
      panel.addEventListener('pointerdown', (e) => { if (e.target === panel) hide(); });
    }
    const render = (o: typeof opts) => {
      card.innerHTML = '';
      const mk = (cls: string, text?: string) => { const d = document.createElement('div'); d.className = cls; if (text !== undefined) d.textContent = text; return d; };
      const x = mk('bd-x', '✕');
      x.addEventListener('click', hide);
      card.appendChild(x);
      card.appendChild(mk('bd-kick', '🏆 TOWN LEADERBOARD'));
      card.appendChild(mk('bd-title', o.course));
      card.appendChild(mk('bd-sub', o.sub));
      if (o.time) card.appendChild(mk('bd-time', o.time));
      if (o.line) card.appendChild(mk('bd-line', o.line));
      const list = mk('bd-rows');
      card.appendChild(list);
      const rows = o.rows.slice(0, 8);
      if (!rows.length && o.pendingTime === undefined) list.appendChild(mk('bd-empty', 'No times yet — this board is waiting for a first rider.'));
      // where would the pending run slot in?
      const claimAt = o.pendingTime !== undefined ? rows.filter((r) => r.t <= o.pendingTime!).length : -1;
      let rank = 0;
      const addRow = (r: { n: string; t: number }) => {
        rank++;
        const row = mk('bd-row' + (o.you && r.n === o.you ? ' me' : ''));
        row.appendChild(mk('bd-rank', String(rank)));
        row.appendChild(mk('bd-name', (rank === 1 ? '👑 ' : '') + r.n));
        row.appendChild(mk('bd-t', this.fmtRace(r.t)));
        list.appendChild(row);
      };
      const addClaim = () => {
        rank++;
        const row = mk('bd-row claim');
        row.appendChild(mk('bd-rank', String(rank)));
        const inp = Object.assign(document.createElement('input'), { maxLength: 12, placeholder: 'TYPE YOUR NAME', value: o.prefill || '' });
        row.appendChild(inp);
        const btn = Object.assign(document.createElement('button'), { textContent: 'SAVE' });
        row.appendChild(btn);
        row.appendChild(mk('bd-t', this.fmtRace(o.pendingTime!)));
        // rejection needs WORDS: the silent shake read as "the game is broken", and a
        // kid whose name got filtered deserves to know it's the name, not them
        const err = mk('bd-err');
        const commit = () => {
          const res = o.onName ? o.onName(inp.value) : null;
          if (res) render({ ...o, you: res.name, rows: res.rows, pendingTime: undefined, onName: undefined, line: res.line || '★ saved — you’re on the board!' });
          else {
            err.textContent = inp.value.trim() ? 'that name isn’t allowed — try another!' : 'type a name first!';
            inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); inp.select();
          }
        };
        inp.addEventListener('input', () => { err.textContent = ''; });
        // tapping a prefilled box means "not me" — select it all so typing replaces
        inp.addEventListener('focus', () => { if (inp.value) inp.select(); });
        btn.addEventListener('click', (e) => { e.stopPropagation(); commit(); });
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') hide(); });
        list.appendChild(row);
        list.appendChild(err);
        // prefilled = the common case is one tap on SAVE — don't pop the keyboard over it
        if (!o.prefill) setTimeout(() => inp.focus(), 300);
      };
      rows.forEach((r, i) => { if (i === claimAt && o.onName) addClaim(); addRow(r); });
      if (claimAt >= rows.length && o.onName && o.pendingTime !== undefined) addClaim();
      if (o.onAgain) {
        const again = Object.assign(document.createElement('button'), { className: 'bd-again', textContent: '🏁 RACE AGAIN' });
        again.addEventListener('click', (e) => { e.stopPropagation(); hide(); o.onAgain!(); });
        card.appendChild(again);
      }
      panel.classList.add('show');
    };
    render(opts);
  }

  /** 🎉 crossing the finish line earns a party: confetti down, balloons up. Fire-and-
   *  forget; a re-fire (RACE AGAIN loops) replaces the last one so pieces never stack. */
  celebrate() {
    this.root.querySelector('.fete')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'fete';
    const colors = ['#e8c44f', '#8e2f3c', '#4f9de8', '#58c470', '#f3f1e8', '#e8884f'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      const w = 6 + Math.random() * 6;
      p.style.width = w + 'px';
      p.style.height = w * 0.45 + 'px';
      p.style.animationDelay = Math.random() * 0.7 + 's';
      p.style.animationDuration = 1.9 + Math.random() * 1.6 + 's';
      p.style.setProperty('--drift', (Math.random() * 160 - 80).toFixed(0) + 'px');
      p.style.setProperty('--spin', (360 + Math.random() * 900).toFixed(0) + 'deg');
      wrap.appendChild(p);
    }
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('b');
      b.textContent = '🎈';
      b.style.left = 5 + i * 17 + Math.random() * 8 + '%';
      b.style.fontSize = 22 + Math.random() * 16 + 'px';
      b.style.animationDelay = 0.15 + Math.random() * 0.9 + 's';
      wrap.appendChild(b);
    }
    this.root.appendChild(wrap);
    setTimeout(() => wrap.remove(), 5200);   // past the longest delay+duration — no mid-air cutoffs
  }

  /** big center countdown; each call re-pops the number. null clears; 'GO!' self-clears. */
  raceCountdown(text: string | null) {
    const el = this.root.querySelector('.race-count') as HTMLElement;
    if (this.raceGoT) { clearTimeout(this.raceGoT); this.raceGoT = null; }
    if (text === null) { el.classList.remove('show'); el.innerHTML = ''; return; }
    el.innerHTML = '<div class="rc-num"></div>';        // fresh node re-runs the pop animation
    (el.firstChild as HTMLElement).textContent = text;
    el.classList.add('show');
    if (text === 'GO!') this.raceGoT = setTimeout(() => { el.classList.remove('show'); el.innerHTML = ''; }, 850);
  }

  /** live race clock (top of screen while story yields); cur=null hides it.
   *  `prog`/`ghost` are 0..1 course fractions for the progress bar's 🚴 and 👻. */
  setRaceTimer(cur: number | null, best: number | null, prog = 0, ghost: number | null = null) {
    if (!this.rtEl) {
      this.rtEl = this.root.querySelector('.race-timer');
      this.rtCur = this.root.querySelector('.race-timer .rt-cur');
      this.rtBest = this.root.querySelector('.race-timer .rt-best');
      this.rtQuit = this.root.querySelector('.race-timer .rt-quit');
      this.rtFill = this.root.querySelector('.race-timer .rt-fill');
      this.rtBike = this.root.querySelector('.race-timer .rt-bike');
      this.rtGhost = this.root.querySelector('.race-timer .rt-ghost');
    }
    if (!this.rtEl || !this.rtCur || !this.rtBest) return;
    if (cur === null) {
      this.rtEl.classList.remove('show');
      if (this.rtQuit) { this.rtQuit.classList.remove('arm'); this.rtQuit.textContent = '✕'; }   // disarm for the next run
      return;
    }
    this.rtEl.classList.add('show');
    this.rtCur.textContent = this.fmtRace(cur);
    this.rtBest.textContent = best !== null ? '★ ' + this.fmtRace(best) : 'first ride';
    const pc = Math.max(0, Math.min(1, prog)) * 100 + '%';
    if (this.rtFill) this.rtFill.style.width = pc;
    if (this.rtBike) this.rtBike.style.left = pc;
    if (this.rtGhost) {
      if (ghost === null) this.rtGhost.style.display = 'none';
      else { this.rtGhost.style.display = 'block'; this.rtGhost.style.left = Math.max(0, Math.min(1, ghost)) * 100 + '%'; }
    }
  }

  /** the front-door 🏁 button + course picker: always visible, no discovery needed.
   *  `rows` is re-read on every open so best times stay fresh; picking a course
   *  hands its id to the game, which fades you to the start line and begins. */
  initRaces(
    rows: () => { id: string; name: string; sub: string; miles: number; est: number; best: number | null; leader: { n: string; t: number } | null }[],
    onPick: (id: string) => void,
    rider: { get: () => string; set: (raw: string) => { ok: boolean; name: string }; has: () => boolean },
    onQuit: () => void,
    onBoard: (id: string) => void,
    refresh?: (onFresh: () => void) => void,
  ) {
    if (!rows().length) return;                       // townless build: keep the button hidden
    const btn = this.root.querySelector('.race-btn') as HTMLElement;
    const pop = this.root.querySelector('.race-pop') as HTMLElement;
    btn.classList.add('show');
    // the race clock's ✕: arm on the first tap (so a stray tap can't kill a 2-minute
    // run), quit on the second; auto-disarms after a beat
    const quit = this.root.querySelector('.race-timer .rt-quit') as HTMLElement;
    let quitT: ReturnType<typeof setTimeout> | null = null;
    quit.addEventListener('click', (e) => {
      e.stopPropagation();
      if (quitT) clearTimeout(quitT);
      if (quit.classList.contains('arm')) {
        quit.classList.remove('arm'); quit.textContent = '✕';
        onQuit();
      } else {
        quit.classList.add('arm'); quit.textContent = 'QUIT?';
        // generous window: a kid taps, reads "QUIT?", thinks it over, taps again —
        // 2.6s silently un-armed under them and the second tap re-armed instead of quitting
        quitT = setTimeout(() => { quit.classList.remove('arm'); quit.textContent = '✕'; }, 6000);
      }
    });
    const rebuild = () => {
      pop.innerHTML = '';
      pop.appendChild(Object.assign(document.createElement('div'), { className: 'rp-hdr', textContent: '🏁 RACES — beat the clock' }));
      // WHO'S RIDING leads the popup — on a shared family device the first question
      // before any race is "is that MY name up there?". Tap to switch; the box comes
      // prefilled with the last rider so a returning kid just types over it.
      const row = document.createElement('div');
      row.className = 'rp-rider';
      const showName = () => {
        row.innerHTML = '';
        // unnamed riders get the pitch (times only save with a name on them)
        if (!rider.has()) { row.appendChild(Object.assign(document.createElement('span'), { textContent: '🚴 add your name — save your times!' })); return; }
        row.appendChild(Object.assign(document.createElement('b'), { textContent: '🚴 ' + rider.get() }));
        row.appendChild(Object.assign(document.createElement('span'), { textContent: 'switch rider' }));
      };
      row.addEventListener('click', () => {
        if (row.querySelector('input')) return;
        row.innerHTML = '🚴 ';
        const inp = Object.assign(document.createElement('input'), { maxLength: 12, value: rider.has() ? rider.get() : '', placeholder: 'TYPE YOUR NAME' });
        // same words-not-just-shake rule as the results board's claim row
        const err = Object.assign(document.createElement('div'), { className: 'rp-err' });
        const commit = () => {
          const res = rider.set(inp.value);
          if (res.ok) showName();
          else {
            err.textContent = inp.value.trim() ? 'that name isn’t allowed — try another!' : '';
            inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); inp.select();
          }
        };
        inp.addEventListener('input', () => { err.textContent = ''; });
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') showName(); });
        inp.addEventListener('blur', () => commit());
        inp.addEventListener('click', (e) => e.stopPropagation());
        row.appendChild(inp);
        row.appendChild(err);
        inp.focus(); inp.select();
      });
      showName();
      pop.appendChild(row);
      for (const r of rows()) {
        const it = document.createElement('div');
        it.className = 'rp-item';
        const nameLine = Object.assign(document.createElement('div'), { className: 'rp-name', textContent: r.name });
        const cup = Object.assign(document.createElement('span'), { className: 'rp-cup', textContent: '🏆', title: 'Leaderboard' });
        cup.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.remove('open'); onBoard(r.id); });
        nameLine.appendChild(cup);
        it.appendChild(nameLine);
        // miles for the grown-ups, ride time for the kids — "3.8 mi" means nothing at 7
        const estTxt = r.est < 75 ? '~' + Math.max(10, Math.round(r.est / 5) * 5) + ' sec ride' : '~' + Math.round(r.est / 60) + ' min ride';
        it.appendChild(Object.assign(document.createElement('div'), { className: 'rp-sub', textContent: r.sub + ' · ' + r.miles.toFixed(1) + ' mi · ' + estTxt }));
        // the town board leads the line — the leaderboard is the point
        let bestLine: string;
        if (r.leader && r.leader.n === rider.get() && r.best !== null) bestLine = '👑 you lead the town — ' + this.fmtRace(r.leader.t);
        else if (r.leader) bestLine = '👑 ' + r.leader.n + ' ' + this.fmtRace(r.leader.t) + (r.best !== null ? ' · you ' + this.fmtRace(r.best) : ' · no time yet');
        else bestLine = r.best !== null ? '★ best ' + this.fmtRace(r.best) : 'no time yet — set one!';
        it.appendChild(Object.assign(document.createElement('div'), { className: 'rp-best', textContent: bestLine }));
        it.addEventListener('click', () => { pop.classList.remove('open'); onPick(r.id); });
        pop.appendChild(it);
      }
      pop.appendChild(Object.assign(document.createElement('div'), { className: 'rp-hint', textContent: 'The flags show the way, but any route counts — first to the finish line. Shortcuts welcome.' }));
      stagger(pop, 0.05);
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pop.classList.contains('open')) {
        rebuild();
        // freshen the leader lines from the cloud board; re-render when it lands —
        // unless the rider is mid-typing their name (rebuild would eat the input)
        refresh?.(() => { if (pop.classList.contains('open') && !pop.querySelector('input')) rebuild(); });
      }
      pop.classList.toggle('open');
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    window.addEventListener('click', () => pop.classList.remove('open'));
  }

  // ---------- fast travel ----------

  initTravel(items: { id: string; name: string; sub: string }[], onPick: (id: string) => void) {
    // town switcher row — current town highlighted, the others navigate on tap
    const ttRow = document.querySelector('#hud .tt-row') as HTMLElement | null;
    const swRow = document.querySelector('#hud .tv-switch') as HTMLElement | null;
    if (swRow && TOWNS.length <= 1) swRow.style.display = 'none';
    if (ttRow && TOWNS.length > 1) {
      // ⚠️ No inline gridTemplateColumns. This used to derive a fixed column
      // count from the number of towns (12 → 3), which is a roster property, not
      // a layout one — so it overrode the stylesheet and overflowed the panel on
      // a phone. The CSS auto-fill grid fits whatever the panel is wide enough
      // for, and keeps fitting as more towns are added.
      const cnt = document.querySelector('#hud .tt-count');
      if (cnt) cnt.textContent = `${TOWNS.length} TOWNS`;
      // the footer row that leads to the roster, and the title that leads back
      const panel = document.querySelector('#hud .travel-panel') as HTMLElement;
      const sw = panel.querySelector('.tv-switch') as HTMLElement;
      sw.title = `Explore ${TOWNS.length - 1} other towns`;
      sw.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.add('towns'); });
      (panel.querySelector('.tv-back') as HTMLElement)
        .addEventListener('click', (e) => { e.stopPropagation(); panel.classList.remove('towns'); });
      const here = ((window as unknown as { __townPath?: string }).__townPath || location.pathname).replace(/\/+$/, '');
      const cur = TOWNS.filter((t) => t.path !== '/').sort((a, b) => b.path.length - a.path.length)
        .find((t) => { const p = t.path.replace(/\/+$/, ''); return here === p || here.startsWith(p + '/'); })
        || TOWNS.find((t) => t.path === '/');
      // show the actual towns' emoji, stacked like cards, so the button previews
      // its own contents instead of just claiming a number
      const faces = sw.querySelector('.tv-sw-faces') as HTMLElement;
      TOWNS.filter((t) => t !== cur).slice(0, 5).forEach((t) => {
        const e = document.createElement('i');
        e.textContent = t.emoji;
        faces.appendChild(e);
      });
      // 0.16s each was the old bob's phase offset, which as a deal-in would take most
      // of a second for five faces. Fast enough to read as one gesture.
      stagger(faces, 0.045);
      for (const t of TOWNS) {
        const isCur = t === cur;
        const chip = document.createElement('div');
        chip.className = 'tt-chip' + (isCur ? ' cur' : '');
        chip.innerHTML = `<span class="tt-emoji">${t.emoji}</span><div class="tt-info"><div class="tt-name">${t.name}</div>`
          + `<div class="tt-tag">${t.tag}</div>${isCur ? '<div class="tt-here">you’re here</div>' : ''}</div>`;
        chip.title = isCur ? `Back to ${t.name}` : `${t.name} — ${t.tag}`;   // the tag is hidden on a phone; keep it reachable
        // Every chip in this grid does something. The current town's used to be inert —
        // the only way back to its landmarks was the small chevron in the title, and a
        // kid who taps the big highlighted card with their own town on it expects it to
        // take them there. It does: back to this town's list, not a page reload.
        chip.addEventListener('click', () => {
          if (isCur) panel.classList.remove('towns');
          else location.href = t.path;
        });
        ttRow.appendChild(chip);
      }
      stagger(ttRow);
    }
    const grid = document.querySelector('#hud .travel-grid')!;
    // a picture on every destination card: pre-readers navigate by icon, and even
    // fluent kids scan a grid of emoji faster than a wall of names. Keyword-matched
    // from name+sub so it stays data-driven — new towns get icons for free.
    const placeEmoji = (name: string, sub: string): string => {
      const s = (name + ' ' + sub).toLowerCase();
      // ORDER IS THE RULE ENGINE: specific places beat broad categories ("Oak Hill
      // Cemetery — garden cemetery" must hit 🪦 before /garden/ hits 🌳). And match
      // whole concepts, not fragments — /bury/ matched NewBURYport and put a
      // gravestone on City Hall.
      const table: [RegExp, string][] = [
        [/witch|bewitched/, '🧙'],   // Salem's whole brand — must beat house/museum
        [/wolf hollow|gray wol(f|ves)/, '🐺'],   // Ipswich's wolf sanctuary
        [/mansion|manor/, '🏛'],     // before /garden/: "Ropes Mansion — house & garden"
        [/stadium|football/, '🏈'],  // before /light /: "football under Friday lights" isn't a lighthouse
        [/clam box|fried clam|clambake/, '🍤'],   // tight on purpose: Joppa Park's "Clam country" stays a park
        [/whale/, '🐋'],                          // Gloucester: whale-watch wharves (and Whale's Jaw earns it too)
        [/rockery|boulder/, '🪨'], [/diner\b/, '🥧'], [/factory/, '🏭'],
        [/most-painted|painting village|art colony/, '🎨'],   // Rocky Neck + Motif #1; plain "paintings" stays a museum
        [/ice cream|creamery/, '🍦'], [/roast beef/, '🥪'], [/theatre|theater|cinema|movie/, '🎭'],
        [/library/, '📚'], [/\bshoe\b/, '👞'],   // "The Shoe" = Beverly's Cummings Center
        [/flying field/, '✈️'],                  // before ⚾: the 1910 Burgess Flying Field isn't a ballfield
        [/little league|\bfield\b/, '⚾'],       // singular only: "Fields" stays farm-country
        [/frog|pond/, '🐸'], [/light(house)?\b|light /, '🗼'], [/airport|airfield|runway|aviation/, '✈️'],
        [/sled|march's hill/, '🛷'], [/skat/, '⛸'], [/playground|fountain/, '🛝'],
        [/burying|cemetery|graveyard/, '🪦'], [/bridge/, '🌉'], [/station|depot/, '🚂'],
        [/candy|sweets|fudge|chocolate/, '🍬'],   // after depot: Prides Crossing's "green depot that sells fudge" stays 🚂
        [/tall ship|friendship|schooner|\bships?\b|shipbuilding/, '⛵'], [/hotel|inn\b/, '🏨'], [/fort\b|castle/, '🏰'],
        [/\bwreck\b/, '⚓'],                 // whole word: Misery's "shipwreck islands" stay islands
        [/beach|island|dune|sand/, '🏖'],   // before /farm/: "the Farms' mile-long beach" is a beach
        [/beverly farms|the farms\b|cottage/, '🏘'],   // villages, not farmland ("Appleton Farms" stays 🚜)
        [/farm|pasture|orchard|\bfields\b/, '🚜'], [/flats|marsh|bird/, '🦆'],   // \b: "ballfields" is a park, not a farm
        [/boardwalk|waterfront|wharf|dock|harbor|landing|fish pier/, '⚓'],   // "fish pier" not bare "pier": Salem Willows' arcade pier stays a park
        [/woods|forest|park|garden|common|green\b|allée|maudslay|willow|gallows|refuge|sanctuar/, '🌳'], [/trail|rail/, '🚲'],
        [/reservoir|\blake\b|river/, '🌊'], [/statue|garrison/, '🗽'], [/church|chapel|meeting/, '⛪'],   // \b: Fish FLAKE Hill is not a lake
        [/school|academy/, '🏫'], [/court/, '⚖️'], [/museum|house|hall|athen/, '🏛'],
        [/square|downtown|market|corners/, '⛲'], [/street|road|lane/, '🛣'],
      ];
      for (const [re, em] of table) if (re.test(s)) return em;
      return '📍';
    };
    items.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'travel-item';
      el.innerHTML = `<span class="ti-em">${placeEmoji(it.name, it.sub)}</span><div class="ti-tx"><div class="tn">${it.name}</div><div class="ts">${it.sub}</div></div>`;
      el.addEventListener('click', () => {
        this.toggleTravel(false);
        onPick(it.id);
      });
      grid.appendChild(el);
    });
    stagger(grid);
    const card = document.querySelector('#hud .travel-card')!;
    // season picker — a left HUD icon (the current season's emoji) + popout menu, not
    // buried in Fast Travel. Post-game reward: roam any season once the finale's climax
    // is reached; during the story it follows the spine.
    const seasonEmoji: Record<string, string> = { spring: '🌸', summer: '☀️', fall: '🎃', winter: '🎄' };
    const sToggle = document.querySelector('#hud .season-toggle') as HTMLElement;
    const sPop = document.querySelector('#hud .season-pop') as HTMLElement;
    const sUnlocked = seasonsUnlocked();
    (sToggle.querySelector('.s-em') as HTMLElement).textContent = seasonEmoji[SEASON] || '🍂';   // swap only the emoji — the BLAB label lives next to it
    sPop.classList.toggle('locked', !sUnlocked);
    const sHdr = document.createElement('div');
    sHdr.className = 'sp-hdr';
    sHdr.textContent = sUnlocked ? '🗓 Set the season' : '🔒 Seasons — locked';
    sPop.appendChild(sHdr);
    // emoji and word are separate now: the emoji goes in a raised .nb-chip so each
    // season reads as an object you pick up, not a line of text (see the LIVELY layer)
    const sList = [['spring', '\u{1F338}', 'Spring'], ['summer', '☀️', 'Summer'], ['fall', '\u{1F383}', 'Fall'], ['winter', '\u{1F384}', 'Winter']] as const;
    for (const [sn, em, label] of sList) {
      sPop.appendChild(Object.assign(document.createElement('div'), {
        className: 'sp-item' + (SEASON === sn ? ' cur' : ''),
        innerHTML: '<span class="nb-chip">' + em + '</span><span>' + label + '</span>',
        onclick: sUnlocked ? () => { if (SEASON !== sn) {
          // keep the player where they are: write a one-shot resume point (same as the
          // story's auto season-turn) so the reload continues here, not back at the start
          localStorage.setItem('nbpt-resume-pos', JSON.stringify({ x: Math.round(this.lastKnownPos.x), z: Math.round(this.lastKnownPos.z) }));
          localStorage.setItem('nbpt-season', sn); location.reload();
        } } : null,
      }));
    }
    if (!sUnlocked) {
      const lk = document.createElement('div');
      lk.className = 'sp-lock';
      // actionable for explore-mode kids too: name where the story starts, not just "the story"
      lk.textContent = 'Finish Gram’s story to roam the seasons — she’s waiting in Market Square.';
      sPop.appendChild(lk);
    }
    stagger(sPop, 0.045);
    sToggle.addEventListener('click', (e) => { e.stopPropagation(); sPop.classList.toggle('open'); });
    sPop.addEventListener('click', (e) => e.stopPropagation());
    window.addEventListener('click', () => sPop.classList.remove('open'));
    // These tallies count THIS town's markers and secrets, so they belong in the
    // town view — appending them to the card put them under the roster of twelve
    // other towns, where "1/36" reads as a fact about the wrong thing.
    const here = card.querySelector('.tv-here') || card;
    const hist = document.createElement('div');
    hist.className = 'hist-line';
    here.appendChild(hist);
    // secrets line: invisible until the first one is found — that's the rule
    const egg = document.createElement('div');
    egg.className = 'hist-line egg-line';
    egg.style.display = 'none';
    here.appendChild(egg);

    const travelBtn = document.querySelector('#hud .travel-btn')!;
    // iOS will only raise the keyboard for a focus() that happens inside a live user
    // gesture, and it is fussy about how far into one. Focusing on POINTERDOWN — the
    // earliest possible moment, before any class toggles or layout — is what actually
    // works on a phone; doing it later in the click handler leaves you with a caret
    // and no keyboard. The panel is opacity-0 rather than display-none, so the input
    // is already in layout and focusable at this point.
    travelBtn.addEventListener('pointerdown', () => {
      const panelEl = document.querySelector('#hud .travel-panel')!;
      if (panelEl.classList.contains('open')) return;      // this tap is a close
      const inp = panelEl.querySelector('.travel-search') as HTMLInputElement | null;
      try { inp?.focus({ preventScroll: true }); } catch { inp?.focus(); }
    });
    travelBtn.addEventListener('click', () => this.toggleTravel());
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
    // reopening always lands on the town you are in — leaving it on the roster
    // because that is where you were last time is disorienting, and the common
    // case by far is travelling within this town
    if (want) panel.classList.remove('towns');
    const input = panel.querySelector('.travel-search') as HTMLInputElement | null;
    if (input) {
      if (want) {
        // Focus SYNCHRONOUSLY, still inside the tap that opened the panel. The old
        // setTimeout(30) broke the user-gesture chain, and iOS then refuses to raise
        // the keyboard — the caret appeared but you could not type. The timeout is
        // kept only as a second attempt for engines that need the paint first.
        void (panel as HTMLElement).offsetWidth;    // flush layout before focusing
        try { input.focus({ preventScroll: true }); } catch { input.focus(); }
        setTimeout(() => { if (document.activeElement !== input) input.focus(); }, 40);
      } else {
        input.value = '';
        input.blur();
        this.renderResults([]);
      }
    }
  }

  // ---------- Missions panel (🧭 / J): the active objective + a direction hint to
  // the beacon, then grouped, tappable mission cards with sub-step checklists.
  // The mission data is built by the QuestRunner (setMissions) — this only renders. ----------

  initMissions(markers: { id: string; title: string; year: string; body: string; stamp?: string }[]) {
    this.histMarkers = markers;
    const jp = document.createElement('div');
    jp.className = 'journey-panel';   // reuse the modal styling + show/hide animation
    const jc = document.createElement('div');
    jc.className = 'journey-card';
    jc.style.cssText = 'position:relative;width:min(420px,90vw);max-height:82vh;overflow:auto;background:var(--panel);border-radius:14px;border-bottom:3px solid #d8b94a;padding:18px 20px 14px;color:#f3f1e8;';
    jc.innerHTML = '<div class="modal-x">✕</div><div style="font-size:14px;letter-spacing:3px;color:#e8c44f;font-weight:800;margin-bottom:10px;">JOURNEY</div>'
      + '<div class="j-obj" style="font-size:14.5px;line-height:1.5;margin-bottom:4px;"></div>'
      + '<div class="j-dir" style="font-size:12.5px;color:#9fb8cc;margin-bottom:8px;"></div>'
      + '<div class="j-tabs"><div class="j-tab" data-tab="story">Story</div><div class="j-tab" data-tab="collections">Collections</div></div>'
      + '<div class="m-groups"></div>';
    // restart: a two-tap arm so a stray click can't wipe a save (kept at the bottom)
    const rb = document.createElement('div');
    rb.textContent = '↺ Restart journey from the beginning';
    rb.style.cssText = 'text-align:center;margin-top:16px;padding:10px;border-radius:9px;border:1px solid rgba(216,90,74,0.5);color:#e8a89a;font-size:12.5px;letter-spacing:1px;cursor:pointer;user-select:none;-webkit-user-select:none;';
    rb.addEventListener('click', () => {
      if (rb.dataset.arm !== '1') {
        rb.dataset.arm = '1';
        rb.textContent = '⚠ Erase all progress and restart? Tap again';
        setTimeout(() => { rb.dataset.arm = '0'; rb.textContent = '↺ Restart journey from the beginning'; }, 3500);
        return;
      }
      // a true start-over: also re-show the find-your-street nudge and un-tuck the
      // objective, so a fresh visitor is greeted and clearly guided again
      for (const k of ['nbpt-ch0-step', 'nbpt-ch1-step', 'nbpt-ch1-carded', 'nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike', 'nbpt-ch3-step', 'nbpt-ch4-step', 'nbpt-ch4-bells', 'nbpt-ch5-step', 'nbpt-ch5-gram', 'nbpt-ch6-step', 'nbpt-kayak', 'nbpt-historian', 'nbpt-history-read', 'nbpt-welcomed', 'nbpt-obj-min', 'nbpt-resume-pos', 'nbpt-season', 'nbpt-promo-flight', 'nbpt-promo-race', 'nbpt-story']) localStorage.removeItem(k);
      location.reload();
    });
    jc.appendChild(rb);
    jp.appendChild(jc);
    document.querySelector('#hud')!.appendChild(jp);
    (jc.querySelector('.modal-x') as HTMLElement).addEventListener('click', (e) => { e.stopPropagation(); jp.classList.remove('show'); });
    // Story | Collections tab toggle
    jc.querySelectorAll('.j-tab').forEach((t) => t.addEventListener('click', (e) => {
      e.stopPropagation();
      this.journeyTab = ((t as HTMLElement).dataset.tab as 'story' | 'collections') || 'story';
      this.renderMissions();
    }));

    const jt = () => {
      const objTxt = (document.querySelector('#hud .objective .otxt') as HTMLElement | null)?.textContent || '';
      (jc.querySelector('.j-obj') as HTMLElement).innerHTML = '\u{1F9ED} <b style="color:#f6f3e8">' + (objTxt || 'Walk out and explore!') + '</b>';
      // short direction hint to the beam of light (unchanged)
      let dl = '';
      if (this.guide && this.pos) {
        const dx = this.guide.x - this.pos.x, dz = this.guide.z - this.pos.y;
        const dm = Math.round(Math.hypot(dx, dz) / 8 / 10) * 10;
        const oc = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round((((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360) / 45) % 8];
        dl = dm < 30 ? '\u{1F4CD} You’re right there — follow the beam!' : '\u{1F4CD} ' + dm + ' m ' + oc + ' — follow the beam of light';
      }
      (jc.querySelector('.j-dir') as HTMLElement).textContent = dl;
      this.renderMissions();
    };

    // tapping the compass shows/hides the missions panel (with the slide/fade animation)
    const open = () => {
      if (jp.classList.contains('show')) { jp.classList.remove('show'); return; }
      jt();
      jp.classList.add('show');
    };
    document.querySelector('#hud .journey-btn')!.addEventListener('click', open);
    jp.addEventListener('click', (ev) => { if (ev.target === jp) jp.classList.remove('show'); });
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Escape' && jp.classList.contains('show')) { jp.classList.remove('show'); return; }
      if (ev.code === 'KeyJ' && (ev.target as HTMLElement)?.tagName !== 'INPUT') open();
    });
  }

  // the quest rebuilds the mission list every apply(); re-render if we're open
  setMissions(missions: Mission[]) {
    this.missions = missions;
    if (document.querySelector('#hud .journey-panel.show:not(.album-panel)')) this.renderMissions();
  }

  // draw the journey panel's active tab: STORY (grouped by named Level, chapters
  // renumbered within each) or COLLECTIONS (its own thing now). Mission data comes
  // from the QuestRunner (setMissions); the Town-stories set is Hud-owned.
  private renderMissions() {
    const root = document.querySelector('#hud .journey-panel .m-groups') as HTMLElement | null;
    if (!root) return;
    // keep the tab toggle's highlight in sync with the active tab
    const card = root.closest('.journey-card');
    card?.querySelectorAll('.j-tab').forEach((t) =>
      t.classList.toggle('on', (t as HTMLElement).dataset.tab === this.journeyTab));
    root.innerHTML = '';

    if (this.journeyTab === 'collections') {
      // the Town-stories collection is Hud-owned (it tracks the history markers) — a
      // standing goal even at 0 found, opening the album on tap
      const stories: Mission = {
        id: 'stories', group: 'collections', title: 'Town stories', kicker: 'Collection',
        state: 'active', steps: [], opens: 'history-album',
        count: this.histReadCount(), total: this.histMarkers.length
      };
      for (const m of this.missions.filter((m) => m.group === 'collections')) root.appendChild(this.missionCard(m));
      root.appendChild(this.missionCard(stories));
      return;
    }

    // STORY tab — one header per Level (named), chapters listed under it
    const story = this.missions.filter((m) => m.group === 'story');
    const levels = [...new Set(story.map((m) => m.level ?? 1))].sort((a, b) => a - b);
    for (const lv of levels) {
      const inLv = story.filter((m) => (m.level ?? 1) === lv);
      const h = document.createElement('div');
      h.className = 'm-level';
      // a one-tap "replay this whole level" — restarts from the level's first chapter, which
      // (like any chapter restart) also resets every chapter after it
      const lvRep = inLv.find((m) => m.replay != null)?.replay;
      const lrep = (lvRep != null && inLv.some((m) => m.state !== 'locked'))
        ? '<span class="m-lrep" data-c="' + lvRep + '" title="Replay this whole level from Chapter 1 — resets later chapters too">↻ Replay level</span>' : '';
      h.innerHTML = '<span class="m-lk">LEVEL ' + lv + '</span> · ' + (inLv[0].levelName || '') + lrep;
      root.appendChild(h);
      const lrepEl = h.querySelector('.m-lrep') as HTMLElement | null;
      if (lrepEl) lrepEl.addEventListener('click', (ev) => this.onReplayClick(ev, lrepEl));
      for (const m of inLv) root.appendChild(this.missionCard(m));
    }
    // Town Jobs (none yet) still live under the Story tab when they exist
    const jobs = this.missions.filter((m) => m.group === 'jobs');
    if (jobs.length) {
      const h = document.createElement('div');
      h.className = 'm-group';
      h.textContent = 'TOWN JOBS';
      root.appendChild(h);
      for (const m of jobs) root.appendChild(this.missionCard(m));
    }
  }

  // one mission as a tappable card: a status row that expands to its checklist
  private missionCard(m: Mission): HTMLElement {
    const card = document.createElement('div');
    card.className = 'm-card ' + m.state + (m.active ? ' expanded' : '');
    const dotCol = m.state === 'done' ? '#9ec98a' : m.state === 'active' ? '#f0d27a' : '#565c68';
    const dotCh = m.state === 'done' ? '✓' : m.state === 'locked' ? '○' : '●';
    const title = (m.chapter != null ? 'Chapter ' + m.chapter + ' · ' : m.kicker ? m.kicker + ' · ' : '') + m.title;
    const prog = (m.count != null && m.total != null) ? '<span class="m-prog">' + m.count + '/' + m.total + '</span>' : '';
    const rep = (m.replay != null && m.state !== 'locked') ? '<span class="m-rep" data-c="' + m.replay + '" title="Replay from this chapter — resets every chapter after it too">↻ Replay</span>' : '';
    const opensAlbum = m.opens === 'history-album';
    const caret = (m.steps.length || opensAlbum) ? '<span class="m-caret">▸</span>' : '';
    const row = document.createElement('div');
    row.className = 'm-row';
    row.innerHTML = '<span class="m-dot" style="color:' + dotCol + '">' + dotCh + '</span>'
      + '<span class="m-title">' + title + '</span>' + prog + rep + caret;
    card.appendChild(row);
    if (m.steps.length) {
      const steps = document.createElement('div');
      steps.className = 'm-steps';
      steps.innerHTML = m.steps.map((s) => {
        const mk = s.done ? '<span style="color:#9ec98a">✓</span>' : '<span style="color:#6b7280">○</span>';
        const c = (s.count != null && s.total != null) ? ' <b>' + s.count + '/' + s.total + '</b>' : '';
        return '<div class="m-step' + (s.done ? ' done' : '') + '">' + mk + ' ' + s.label + c + '</div>';
      }).join('');
      card.appendChild(steps);
    }
    if (m.reward) {
      const rw = document.createElement('div');
      rw.className = 'm-reward';
      rw.innerHTML = 'Reward · <b>' + m.reward + '</b>';
      card.appendChild(rw);
    }
    row.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).classList.contains('m-rep')) return;   // replay handled separately
      if (m.state === 'locked') return;
      if (opensAlbum) { this.openHistoryAlbum(); return; }
      card.classList.toggle('expanded');
    });
    const repEl = row.querySelector('.m-rep') as HTMLElement | null;
    if (repEl) repEl.addEventListener('click', (ev) => this.onReplayClick(ev, repEl));
    return card;
  }

  // every chapter's localStorage keys, in play order. Restarting chapter N wipes N AND every
  // chapter after it, so the later ones go back to "not done" and must be replayed (they don't
  // stay complete with an unfinished chapter before them). Indices match each chapter's `replay`.
  private static readonly CH_KEYS: string[][] = [
    ['nbpt-ch0-step'],                                      // L1·1 Overdue
    ['nbpt-ch1-step', 'nbpt-ch1-carded'],                  // L1·2 The Door Under Downtown
    ['nbpt-ch2-step', 'nbpt-ch2-stops', 'nbpt-bike'],      // L1·3 The Daily News (Bicycle)
    ['nbpt-ch3-step'],                                      // L1·4 Low Water
    ['nbpt-ch4-step', 'nbpt-ch4-bells', 'nbpt-ch5-gram'],  // L1·5 The Custom House Star
    ['nbpt-ch5-step'],                                      // L2·1 The False Light
    ['nbpt-ch6-step', 'nbpt-kayak'],                        // L2·2 The Walking Light (Grandpa's kayak)
    ['nbpt-ch7-step', 'nbpt-ch7-decoys'],                  // L2·3 The Lamplighter
    ['nbpt-ch8-step', 'nbpt-ch8-boats', 'nbpt-beam-on'],   // L2·4 Bring the Light Home
  ];

  // two-tap "replay from here": clears this chapter's keys + every chapter after it, then reloads
  private onReplayClick(ev: Event, tg: HTMLElement) {
    ev.stopPropagation();
    const idx = Number(tg.dataset.c);
    if (!Number.isInteger(idx) || idx < 0 || idx >= Hud.CH_KEYS.length) return;
    if (tg.dataset.arm !== '1') {
      tg.dataset.arm = '1';
      if (tg.dataset.label == null) tg.dataset.label = tg.textContent || '↻';
      tg.textContent = '↻ Tap again to confirm';
      setTimeout(() => { tg.dataset.arm = '0'; tg.textContent = tg.dataset.label || '↻'; }, 3500);
      return;
    }
    for (const grp of Hud.CH_KEYS.slice(idx)) for (const kk of grp) localStorage.removeItem(kk);
    location.reload();
  }

  // ---------- Backpack panel (🎒 / I): Carrying now / Treasures & tools / Collections ----------

  initBag(markers: { id: string; title: string; year: string; body: string; stamp?: string }[]) {
    this.histMarkers = markers;
    const panel = document.createElement('div');
    panel.className = 'bag-panel';
    const card = document.createElement('div');
    card.className = 'bag-card';
    card.innerHTML = '<div class="modal-x">✕</div>'
      + '<div class="bag-head"><span class="bag-emoji">🎒</span>YOUR BACKPACK</div>'
      + '<div class="bag-empty">Your bag is empty for now — go find some treasure!</div>'
      + '<div class="bag-sec" data-sec="carry"><div class="bag-sectitle">CARRYING NOW</div><div class="bag-grid"></div></div>'
      + '<div class="bag-sec" data-sec="treasure"><div class="bag-sectitle">TREASURES &amp; TOOLS</div><div class="bag-grid"></div></div>'
      + '<div class="bag-sec" data-sec="collection"><div class="bag-sectitle">COLLECTIONS</div><div class="bag-grid"></div></div>';
    panel.appendChild(card);
    document.querySelector('#hud')!.appendChild(panel);
    (card.querySelector('.modal-x') as HTMLElement).addEventListener('click', (e) => { e.stopPropagation(); this.toggleBag(false); });
    panel.addEventListener('click', (e) => { if (e.target === panel) this.toggleBag(false); });
    document.querySelector('#hud .bag-btn')!.addEventListener('click', () => this.toggleBag());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.bagPanelOpen) { this.toggleBag(false); return; }
      if (e.code === 'KeyI' && (e.target as HTMLElement)?.tagName !== 'INPUT') this.toggleBag();
    });
  }

  toggleBag(force?: boolean) {
    const panel = document.querySelector('#hud .bag-panel');
    if (!panel) return;
    const want = force !== undefined ? force : !panel.classList.contains('show');
    panel.classList.toggle('show', want);
    this.bagPanelOpen = want;
    if (want) {
      this.renderBag();          // render first, so freshly-added items flash
      this.bagNewIds.clear();    // everything is "seen" once you peek inside
      this.paintBagBadge();
    }
  }

  // the quest sets the whole bag every apply(); this drives the button's spring-in/wiggle
  setBag(items: BagItem[]) {
    this.bagItems = items;
    // visibility is a plain invariant: the 🎒 button is shown whenever the bag has
    // anything. Recomputed every call so a reload (e.g. a season change) always
    // re-reveals a non-empty bag, independent of the pop/new-item bookkeeping below
    // (which only drives the one-time spring-in, the wiggle, and the NEW badge).
    if (items.length) (document.querySelector('#hud .bag-btn') as HTMLElement | null)?.classList.add('show');
    const ids = items.map((i) => i.id);
    // the very first call is the constructor's mount: if a loaded save already has
    // items, reveal the button silently (no pop) and remember them as already-seen
    if (!this.bagMounted) {
      this.bagMounted = true;
      if (items.length) {
        this.revealBag(false);
        for (const id of ids) this.bagSeen.add(id);
      }
      return;
    }
    // post-mount: a genuine pickup during play
    const firstEver = !this.bagEverShown && items.length > 0;
    let gotNew = false;
    for (const id of ids) {
      if (!this.bagSeen.has(id)) { this.bagSeen.add(id); this.bagNewIds.add(id); gotNew = true; }
    }
    if (firstEver) this.revealBag(true);      // SPRING IN + glow + the one-time tip
    else if (gotNew) this.wiggleBag();        // a later pickup just wiggles for attention
    if (gotNew) this.paintBagBadge();
    if (this.bagPanelOpen) this.renderBag();
  }

  // has the player earned the backpack? (latches once the 🎒 is first revealed) —
  // the Kid mirrors this to render a pack on his back. See Kid.setBackpack.
  hasBackpack(): boolean { return this.bagEverShown; }

  private revealBag(pop: boolean) {
    const btn = document.querySelector('#hud .bag-btn') as HTMLElement | null;
    if (!btn) return;                 // never latch bagEverShown if the button isn't mounted yet
    this.bagEverShown = true;
    btn.classList.add('show');
    if (pop) {
      requestAnimationFrame(() => {
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 1000);
      });
      if (!this.bagTipShown) { this.bagTipShown = true; this.showBagTip(); }
    }
  }

  private showBagTip() {
    const tip = document.querySelector('#hud .bag-tip') as HTMLElement | null;
    if (!tip) return;
    tip.innerHTML = 'Your <b>backpack</b>! Tap to peek inside';
    tip.classList.add('show');
    setTimeout(() => tip.classList.remove('show'), 5200);
  }

  private wiggleBag() {
    const btn = document.querySelector('#hud .bag-btn') as HTMLElement | null;
    if (!btn) return;
    btn.classList.remove('wiggle');
    void btn.offsetWidth;   // force reflow so the animation can replay on rapid pickups
    btn.classList.add('wiggle');
    setTimeout(() => btn.classList.remove('wiggle'), 650);
  }

  private paintBagBadge() {
    const btn = document.querySelector('#hud .bag-btn') as HTMLElement | null;
    btn?.classList.toggle('has-new', this.bagNewIds.size > 0);
  }

  private histReadCount(): number {
    try { return new Set(JSON.parse(localStorage.getItem('nbpt-history-read') || '[]')).size; } catch { return 0; }
  }

  private renderBag() {
    const panel = document.querySelector('#hud .bag-panel');
    if (!panel) return;
    // quest items + the Hud-owned "Town stories" collection (synthesized here so
    // the quest stays decoupled from history.ts)
    const items = this.bagItems.slice();
    const stories = this.histReadCount();
    if (stories > 0) {
      items.push({ id: 'stories', emoji: '\u{1F4DC}', kind: 'collection',
        name: 'Town stories', desc: 'True tales found on town plaques.',
        count: stories, total: this.histMarkers.length, opens: 'history-album' });
    }
    (panel.querySelector('.bag-empty') as HTMLElement).style.display = items.length ? 'none' : '';
    for (const sec of ['carry', 'treasure', 'collection'] as const) {
      const secEl = panel.querySelector('.bag-sec[data-sec="' + sec + '"]') as HTMLElement;
      const grid = secEl.querySelector('.bag-grid') as HTMLElement;
      const mine = items.filter((it) => it.kind === sec);
      secEl.classList.toggle('empty', mine.length === 0);
      grid.innerHTML = '';
      for (const it of mine) {
        const el = document.createElement('div');
        el.className = 'jitem' + (it.opens ? ' tappable' : '') + (this.bagNewIds.has(it.id) ? ' fresh' : '');
        const cnt = (it.count != null && it.total != null) ? '<span class="cnt">' + it.count + '/' + it.total + '</span>' : '';
        el.innerHTML = '<span class="ic">' + it.emoji + '</span><span class="tx"><b>' + it.name + '</b><br>' + it.desc + '</span>' + cnt;
        if (it.opens === 'history-album') el.addEventListener('click', () => this.openHistoryAlbum());
        grid.appendChild(el);
      }
    }
  }

  // the album of found Town-stories cards — opened from the bag or a Collections
  // card; tapping a card opens the full plaque via historyCard()
  private openHistoryAlbum() {
    document.querySelector('#hud .bag-panel')?.classList.remove('show');
    this.bagPanelOpen = false;
    document.querySelector('#hud .journey-panel.show')?.classList.remove('show');
    if (!this.albumPanel) {
      const ap = document.createElement('div');
      ap.className = 'journey-panel album-panel';   // reuse the modal styling
      const ac = document.createElement('div');
      ac.className = 'journey-card';
      ac.style.cssText = 'position:relative;width:min(420px,90vw);max-height:82vh;overflow:auto;background:var(--panel);border-radius:14px;border-bottom:3px solid #d8b94a;padding:18px 20px 14px;color:#f3f1e8;';
      ac.innerHTML = '<div class="modal-x">✕</div>'
        + '<div style="font-size:14px;letter-spacing:3px;color:#e8c44f;font-weight:800;margin-bottom:4px;">\u{1F4DC} TOWN STORIES</div>'
        + '<div class="alb-tally" style="font-size:12.5px;color:#c8bd96;margin:4px 0 12px;"></div>'
        + '<div class="alb-list" style="display:flex;flex-wrap:wrap;gap:6px;"></div>';
      ap.appendChild(ac);
      document.querySelector('#hud')!.appendChild(ap);
      (ac.querySelector('.modal-x') as HTMLElement).addEventListener('click', (e) => { e.stopPropagation(); ap.classList.remove('show'); });
      ap.addEventListener('click', (e) => { if (e.target === ap) ap.classList.remove('show'); });
      this.albumPanel = ap;
    }
    // read straight from the collection's source of truth — this used to hardcode
    // `nbpt-history-read`, which is now a per-town key
    const rd = this.collectRead();
    const tally = this.albumPanel.querySelector('.alb-tally') as HTMLElement;
    tally.innerHTML = rd.size >= this.histMarkers.length
      ? '\u{1F3DB} <b style="color:#ffd86a">You found all ' + this.histMarkers.length + ' — Town Historian!</b>'
      : '\u{1F4DC} Found <b style="color:#e8c44f">' + rd.size + '</b> of ' + this.histMarkers.length + ' — explore to find more';
    const list = this.albumPanel.querySelector('.alb-list') as HTMLElement;
    list.innerHTML = '';
    const found = this.histMarkers.filter((mk) => rd.has(mk.id));
    if (!found.length) {
      list.innerHTML = '<div style="font-size:12.5px;color:#8b8678;line-height:1.45;">Look for the glowing ★ markers around town to uncover its stories.</div>';
    } else {
      for (const mk of found) {
        const cd = document.createElement('div');
        cd.style.cssText = 'flex:1 1 46%;min-width:128px;border-radius:9px;padding:8px 11px;font-size:12px;line-height:1.35;cursor:pointer;border:1px solid rgba(216,185,74,0.55);color:#f3f1e8;background:rgba(216,185,74,0.10);';
        cd.innerHTML = '<div style="font-weight:700;">' + mk.title + '</div><div style="color:#c8bd96;">' + mk.year + '</div>';
        cd.addEventListener('click', () => {
          this.albumPanel!.classList.remove('show');
          this.historyCard(mk.title, mk.year + ' · Newburyport', mk.body, mk.stamp);
        });
        list.appendChild(cd);
      }
    }
    this.albumPanel.classList.add('show');
  }

  // ---------- sound toggle (lives inside the ⚙️ settings popover) ----------

  initSound(on: boolean, onToggle: () => boolean) {
    const row = document.querySelector('#hud .settings-pop .sp-row[data-set="sound"]') as HTMLElement;
    const name = row.querySelector('.sp-name') as HTMLElement;
    const paint = (en: boolean) => {
      row.classList.toggle('on', en);
      name.textContent = (en ? '🔊' : '🔇') + ' Sound';
    };
    paint(on);
    row.addEventListener('click', (e) => {
      e.stopPropagation();   // toggling sound keeps the popover open
      paint(onToggle());
    });
  }

  // ---------- ghost-rider toggle (lives inside the ⚙️ settings popover) ----------

  initGhost(on: boolean, onToggle: () => boolean) {
    const row = document.querySelector('#hud .settings-pop .sp-row[data-set="ghost"]') as HTMLElement;
    row.classList.toggle('on', on);
    row.addEventListener('click', (e) => {
      e.stopPropagation();   // keep the popover open, same as the sound row
      row.classList.toggle('on', onToggle());
    });
  }

  // ---------- settings gear: explore vs play (Story mode) ----------

  // Wires the ⚙️ popover's Story-mode switch. `on` is the current state; `onToggle`
  // is handed the requested new state and returns the state actually applied (so the
  // switch always mirrors the source of truth). Tapping the gear opens/closes the pop;
  // tapping elsewhere closes it.
  private setStoryRowState(on: boolean) {
    const row = document.querySelector('#hud .settings-pop .sp-row[data-set="story"]') as HTMLElement | null;
    row?.classList.toggle('on', on);
  }
  // keep the gear's switch in sync when story mode is changed from elsewhere (the first-run pick)
  // the five lo-fi styles. Picking one takes effect on the NEXT bar, so it is a
  // fade between moods rather than a cut — which is also why there is nothing to
  // stop and restart when it changes.
  initMusicStyles(styles: { id: string; name: string; sub: string; emoji: string }[],
                  current: string, onPick: (id: string) => void) {
    const row = document.querySelector('#hud .sp-mrow') as HTMLElement | null;
    const sub = document.querySelector('#hud .sp-msub') as HTMLElement | null;
    if (!row) return;
    row.innerHTML = '';
    const paint = (id: string) => {
      for (const el of Array.from(row.children)) el.classList.toggle('cur', (el as HTMLElement).dataset.m === id);
      const s = styles.find((x) => x.id === id);
      if (sub && s) sub.textContent = s.sub;
    };
    for (const s of styles) {
      const b = document.createElement('div');
      b.className = 'sp-mbtn';
      b.dataset.m = s.id;
      b.title = `${s.name} — ${s.sub}`;
      b.innerHTML = `<span class="m-em">${s.emoji}</span><span class="m-nm">${s.name}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(s.id); paint(s.id); });
      row.appendChild(b);
    }
    stagger(row, 0.05);
    paint(current);
  }

  // your dog, your collar — the only customization, deliberately identity-neutral
  initCollar(colors: string[], current: string, onPick: (hex: string) => void) {
    const block = document.querySelector('#hud .sp-collar') as HTMLElement | null;
    const row = document.querySelector('#hud .sp-crow') as HTMLElement | null;
    if (!block || !row) return;
    block.classList.add('show');
    row.innerHTML = '';
    const paint = (hex: string) => {
      for (const el of Array.from(row.children)) el.classList.toggle('cur', (el as HTMLElement).dataset.c === hex);
    };
    for (const c of colors) {
      const chip = document.createElement('div');
      chip.className = 'sp-cchip';
      chip.dataset.c = c;
      chip.style.background = c;
      chip.addEventListener('click', (e) => { e.stopPropagation(); onPick(c); paint(c); });
      row.appendChild(chip);
    }
    paint(current);
  }

  refreshSettings(storyOn: boolean) { this.setStoryRowState(storyOn); }
  initSettings(on: boolean, onToggle: (next: boolean) => boolean) {
    const btn = document.querySelector('#hud .settings-btn') as HTMLElement;
    const pop = document.querySelector('#hud .settings-pop') as HTMLElement;
    const row = document.querySelector('#hud .settings-pop .sp-row[data-set="story"]') as HTMLElement;
    this.setStoryRowState(on);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.classList.toggle('open');
      // this panel is static markup, so nothing ever handed its rows a delay and the
      // whole thing popped in as one block. Re-stagger on each open, not once at boot:
      // the Story row is display:none in world-only towns, and a delay set on a hidden
      // row would leave a visible gap in the wave.
      if (pop.classList.contains('open')) {
        const shown = (Array.from(pop.children) as HTMLElement[])
          .filter((c) => getComputedStyle(c).display !== 'none');
        stagger(shown, 0.05);
      }
    });
    // any tap outside the gear/pop closes it
    window.addEventListener('pointerdown', (e) => {
      if (!pop.classList.contains('open')) return;
      if ((e.target as HTMLElement)?.closest?.('.settings-pop, .settings-btn')) return;
      pop.classList.remove('open');
    });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !row.classList.contains('on');
      this.setStoryRowState(onToggle(next));
    });
  }

  // first-run choice (fresh visitors only): explore freely or follow the story.
  // Dismissing — backdrop tap or Escape — counts as "just explore", the gentle default.
  // `onChoose(true)` = story on, `onChoose(false)` = explore. Fires exactly once.
  // a one-time nudge after a fresh visitor chooses "just explore": pulse the gear and show
  // a small pointer that the Story toggle lives there. Clears on the first Settings open.
  hintStoryToggle() {
    const btn = document.querySelector('#hud .settings-btn') as HTMLElement | null;
    const hint = document.querySelector('#hud .settings-hint') as HTMLElement | null;
    if (!btn || !hint) return;
    // one hint at a time: the street nudge owns the same corner of the screen, and the
    // two rendered overlapping (both unreadable). Wait for it — and for any panel a
    // nudge-tap opened — then take our turn.
    if (document.querySelector('#hud .streettip.show, #hud .travel-panel.open, #hud .modepick.show')) {
      setTimeout(() => this.hintStoryToggle(), 1500);
      return;
    }
    btn.classList.add('pulse');
    hint.classList.add('show');
    const clear = () => { btn.classList.remove('pulse'); hint.classList.remove('show'); };
    btn.addEventListener('click', clear, { once: true });
    setTimeout(clear, 7000);
  }

  showModePick(onChoose: (story: boolean) => void) {
    const el = document.querySelector('#hud .modepick') as HTMLElement;
    let done = false;
    const choose = (story: boolean) => {
      if (done) return;
      done = true;
      el.classList.remove('show');
      // (the gear-hint for explorers is sequenced by Game AFTER the street nudge fades —
      // firing it here put two tooltips on top of each other)
      onChoose(story);
    };
    (el.querySelector('.mp-explore') as HTMLElement).onclick = (e) => { e.stopPropagation(); choose(false); };
    (el.querySelector('.mp-story') as HTMLElement).onclick = (e) => { e.stopPropagation(); choose(true); };
    el.addEventListener('pointerdown', (e) => { if (e.target === el) choose(false); });   // backdrop = explore
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !done) choose(false); });
    el.classList.add('show');
  }

  // ---------- run toggle (always shown; click or R key toggles always-run) ----------

  initRun(onToggle: () => boolean) {
    const btn = document.querySelector('#hud .run-btn') as HTMLElement;
    // visible on desktop + touch; the R keycap hint (CSS, #hud.keys) teaches the key
    btn.classList.add('show');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setRunState(onToggle());
    });
  }

  // ---------- 🐾 bark / hold-to-sniff (dog player only) ----------
  // One control, two verbs: press-and-release under 300 ms is a bark; crossing
  // 300 ms commits to a sniff that lasts until the finger (or F key) lifts.
  // Game owns that timing so the button and the key share one brain.
  initBark(press: () => void, release: () => void) {
    const btn = document.querySelector('#hud .bark-btn') as HTMLElement;
    btn.classList.add('show');
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); press(); });
    btn.addEventListener('pointerup', (e) => { e.stopPropagation(); release(); });
    btn.addEventListener('pointercancel', () => release());
    btn.addEventListener('pointerleave', () => release());
  }

  setSniffState(on: boolean) {
    (document.querySelector('#hud .bark-btn') as HTMLElement | null)?.classList.toggle('on', on);
  }

  private scentEl: HTMLElement | null = null;
  /** aim the scent bloom: rel = bearing relative to the camera (0 = dead ahead),
   *  strength 0..1 (0 or null hides it). The bloom rides the screen edge. */
  sniffGlow(rel: number | null, strength: number, bone = false) {
    if (!this.scentEl) {
      this.scentEl = document.createElement('div');
      this.scentEl.className = 'scent pulse';
      document.querySelector('#hud')!.appendChild(this.scentEl);
    }
    const el = this.scentEl;
    if (rel === null || strength <= 0) { el.style.opacity = '0'; return; }
    // a story smells GOLD; a buried bone smells BONE — the kid learns the difference
    el.style.background = bone
      ? 'radial-gradient(circle, rgba(240,234,214,0.6), rgba(240,234,214,0.2) 45%, transparent 70%)'
      : 'radial-gradient(circle, rgba(232,194,49,0.55), rgba(232,194,49,0.18) 45%, transparent 70%)';
    // direction on screen: ahead = up. Push the bloom's centre out to the border.
    const dx = Math.sin(rel), dy = -Math.cos(rel);
    const w = window.innerWidth, h = window.innerHeight;
    const k = 0.5 / Math.max(Math.abs(dx) / w, Math.abs(dy) / h, 1e-6) * 0.96;
    el.style.left = (w / 2 + dx * Math.min(k, w * 0.48)) + 'px';
    el.style.top = (h / 2 + dy * Math.min(k, h * 0.48)) + 'px';
    el.style.opacity = String(0.25 + 0.75 * Math.min(1, strength));
  }

  /** a bark's WOOF! (or any little shout — '🦴', '…') at a screen point */
  woof(x: number, y: number, text = 'WOOF!') {
    const el = document.createElement('div');
    el.className = 'woof';
    el.textContent = text;
    el.style.left = (x - 26) + 'px';
    el.style.top = (y - 30) + 'px';
    document.querySelector('#hud')!.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  /** 🕳 a spray of dirt out of the hole — a few clods per call, flung backwards */
  dirt(x: number, y: number, color = '#7a5a3a') {
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'dirtclod';
      el.style.background = color;
      el.style.left = (x - 4 + (Math.random() - 0.5) * 18) + 'px';
      el.style.top = (y - 4) + 'px';
      el.style.setProperty('--dx', ((Math.random() - 0.5) * 70).toFixed(0) + 'px');
      el.style.setProperty('--dy', (-30 - Math.random() * 50).toFixed(0) + 'px');
      document.querySelector('#hud')!.appendChild(el);
      setTimeout(() => el.remove(), 620);
    }
  }

  // ---------- look up (click or V toggles the raised camera) ----------
  //
  // NOT always shown. It earns its slot only where there is something overhead worth
  // craning at — downtown Boston, a mill, a tower. In a town of two-storey houses the
  // button is a promise the street can't keep, so Game polls what's nearby and calls
  // showLook(). See Game.updateLookOffer.

  initLook(onToggle: () => boolean) {
    const btn = document.querySelector('#hud .look-btn') as HTMLElement;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setLookState(onToggle());
    });
  }

  // returns true if the button just went away while the raised camera was still on,
  // so the caller can drop the camera rather than strand it with no way back down
  showLook(on: boolean): boolean {
    const btn = document.querySelector('#hud .look-btn') as HTMLElement | null;
    if (!btn) return false;
    const was = btn.classList.contains('show');
    btn.classList.toggle('show', on);
    return was && !on && btn.classList.contains('on');
  }

  setLookState(on: boolean) {
    (document.querySelector('#hud .look-btn') as HTMLElement | null)?.classList.toggle('on', on);
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

  // walk-only indoors: tag #hud so CSS hides the run + bike buttons (Game pushes
  // this every frame; classList.toggle is a no-op when the state is unchanged)
  setIndoors(on: boolean) {
    document.getElementById('hud')?.classList.toggle('indoors', on);
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

  private lastKnownPos = { x: 0, z: 0 };   // latest player pos (fed every poll) — the season picker reads it for resume-pos
  setMiniPos(x: number, z: number) {
    this.lastKnownPos.x = x; this.lastKnownPos.z = z;
    if (!this.miniDot || !this.miniScale) return;
    this.miniDot.style.left = (x - this.miniMinX) * this.miniScale + 'px';
    this.miniDot.style.top = (z - this.miniMinY) * this.miniScale + 'px';
  }

  // ---------- quest UI: dialogue, objective pill, talk button ----------

  // true while a dialogue is showing (plus a short grace so the closing
  // keypress doesn't immediately re-trigger an interact)
  get dialogueOpen(): boolean {
    return this.dlgEl.classList.contains('open') || this.hcardOpen || performance.now() < this.dlgCool;
  }

  // The town holds still while a discovery card is up (Game.frame reads this).
  get cardPaused(): boolean {
    return this.hcardOpen;
  }

  // plaque reader: serif card with the true-story stamp, the kid's own photo of the
  // place, and — on a first find — the NEW DISCOVERY banner and the running tally.
  // `opts.fresh` is what separates "you just earned this" from "you're re-reading it".
  historyCard(
    title: string, year: string, body: string, stamp?: string,
    opts?: { photo?: string | null; emoji?: string; fresh?: boolean; found?: number; total?: number },
  ) {
    const back = document.querySelector('#hud .hcard-back') as HTMLElement;
    const el = back.querySelector('.hcard') as HTMLElement;
    (el.querySelector('.ht') as HTMLElement).textContent = title;
    (el.querySelector('.hy') as HTMLElement).textContent = year;
    (el.querySelector('.hb') as HTMLElement).textContent = body;
    (el.querySelector('.stamp') as HTMLElement).textContent = stamp || '★ A TRUE STORY';

    const pic = el.querySelector('.hpic') as HTMLElement;
    pic.innerHTML = opts?.photo
      ? '<img alt="">'
      : '<span class="hpic-em">' + (opts?.emoji || '🏛') + '</span>';
    if (opts?.photo) (pic.querySelector('img') as HTMLImageElement).src = opts.photo;

    const cnt = el.querySelector('.hcount') as HTMLElement;
    if (opts?.total) {
      const f = opts.found ?? 0;
      cnt.style.display = '';
      cnt.innerHTML = f >= opts.total
        ? '🏛 <b>Every single one found.</b> You know this town.'
        : 'Discovery <b>' + f + '</b> of ' + opts.total + ' — <b>' + (opts.total - f) + '</b> still out there';
    } else {
      cnt.style.display = 'none';
    }

    // restart the entrance animation even if a card was already up
    el.classList.remove('fresh', 'locked-card');
    void el.offsetWidth;
    el.classList.toggle('fresh', !!opts?.fresh);

    back.classList.add('open');
    this.hcardOpen = true;
  }


  // The card for something you HAVEN'T found: same shape as the real one, so a slot
  // feels like a place rather than a dead square, but it withholds the payoff. You
  // get the icon instead of a photo, the opening line, and where to look — enough to
  // decide to go. The rest is the reward for going, which is the whole mechanic.
  private lockedCard(mk: { id: string; title: string; year: string; body: string; hint?: string | null; icon?: string }) {
    const back = document.querySelector('#hud .hcard-back') as HTMLElement;
    const el = back.querySelector('.hcard') as HTMLElement;
    (el.querySelector('.ht') as HTMLElement).textContent = mk.title;
    (el.querySelector('.hy') as HTMLElement).textContent = mk.year;

    // first sentence only — a taste, not the story
    const teaser = (mk.body.match(/^[\s\S]*?[.!?](?=\s|$)/) || [mk.body])[0].trim();
    const body = el.querySelector('.hb') as HTMLElement;
    body.innerHTML = esc(teaser) + '<span class="hmore">Find it to read the rest.</span>';

    (el.querySelector('.hpic') as HTMLElement).innerHTML =
      '<span class="hpic-em">' + (mk.icon || '🏛') + '</span>';

    const cnt = el.querySelector('.hcount') as HTMLElement;
    cnt.style.display = '';
    cnt.innerHTML = mk.hint
      ? '💡 Look for it near <b>' + esc(mk.hint) + '</b>'
      : 'Somewhere out there. Keep exploring.';

    (el.querySelector('.stamp') as HTMLElement).textContent = '★ STILL OUT THERE';
    el.classList.remove('fresh');
    el.classList.add('locked-card');
    back.classList.add('open');
    this.hcardOpen = true;
  }

  // ---------- 🏛 the collection ----------
  //
  // Every marker in town gets a slot from the very first second, found or not. A kid
  // opening this on minute one should see thirty-six dark tiles and think "I want
  // those" — a grid that only fills in as you go can't tell you what you're missing,
  // and the missing ones are the whole motivation. Locked tiles show the year but not
  // the story, so they read as a lead rather than a spoiler.

  private collectRead: () => Set<string> = () => new Set();
  private collectOpen: ((id: string) => void) | null = null;
  private collectReset: (() => void) | null = null;

  initCollection(
    markers: { id: string; title: string; year: string; body: string; stamp?: string; hint?: string | null; icon?: string }[],
    read: () => Set<string>,
    openCard: (id: string) => void,
    reset?: () => void,
  ) {
    this.histMarkers = markers;
    this.collectRead = read;
    this.collectOpen = openCard;
    this.collectReset = reset || null;
    const btn = document.querySelector('#hud .collect-btn') as HTMLElement;
    btn.classList.add('show');
    this.root.classList.add('has-collect');
    btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.openCollection(); });
    const panel = document.querySelector('#hud .collect-panel') as HTMLElement;
    panel.addEventListener('pointerdown', (e) => { if (e.target === panel) panel.classList.remove('show'); });
    (panel.querySelector('.modal-x') as HTMLElement).addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      panel.classList.remove('show');
    });
    // Two taps to wipe: the first arms it and says exactly what will be lost, the
    // second does it. No browser confirm() — it is blocked in some embedded webviews
    // and reads as a system error to a kid.
    const foot = panel.querySelector('.collect-foot') as HTMLElement;
    const link = foot.querySelector('.cf-reset') as HTMLElement;
    link.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!foot.classList.contains('arm')) {
        foot.classList.add('arm');
        link.textContent = 'Erase all ' + this.collectRead().size + ' and every photo? Tap again';
        setTimeout(() => {
          if (!foot.classList.contains('arm')) return;
          foot.classList.remove('arm');
          link.textContent = 'Start the collection over';
        }, 5000);
        return;
      }
      foot.classList.remove('arm');
      link.textContent = 'Start the collection over';
      this.collectReset?.();
      this.refreshCollectCount(false);
      this.openCollection();
    });
    this.refreshCollectCount(false);
  }

  // the gold pip on the button — and a little pop when the number goes up
  refreshCollectCount(bump: boolean) {
    const btn = document.querySelector('#hud .collect-btn') as HTMLElement | null;
    if (!btn) return;
    const n = this.collectRead().size, total = this.histMarkers.length;
    (btn.querySelector('.cb-n') as HTMLElement).textContent = String(n);
    btn.classList.toggle('done', total > 0 && n >= total);
    if (bump) {
      btn.classList.remove('bump');
      void btn.offsetWidth;
      btn.classList.add('bump');
    }
  }

  openCollection() {
    const panel = document.querySelector('#hud .collect-panel') as HTMLElement;
    const rd = this.collectRead();
    const total = this.histMarkers.length;
    const pct = total ? Math.round((rd.size / total) * 100) : 0;
    const bar = panel.querySelector('.collect-prog i') as HTMLElement;
    bar.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));
    const tally = panel.querySelector('.collect-tally') as HTMLElement;
    tally.innerHTML = rd.size >= total && total > 0
      ? '<b>All ' + total + ' found</b> — you are the Town Historian.'
      : '<b>' + rd.size + '</b> of ' + total + ' found · ' + (total - rd.size) + ' still hiding out there';

    const grid = panel.querySelector('.collect-grid') as HTMLElement;
    grid.innerHTML = '';
    this.histMarkers.forEach((mk, i) => {
      const got = rd.has(mk.id);
      const shot = got ? loadShot(mk.id) : null;
      const tile = document.createElement('div');
      tile.className = 'ctile' + (got ? ' got' : ' locked');
      // the glint chases this tile's own entrance: same capped stagger as nbpt-tile-in,
      // plus a beat so the light crosses a tile that has already landed
      if (got) tile.style.setProperty('--sheen-lag', (Math.min(i, 14) * 0.022 + 0.16).toFixed(3) + 's');
      // the marker's own icon, whether locked or found-without-a-photo — never a
      // shared placeholder, so the grid reads as 36 different things to go and get
      const pic = shot
        ? '<img alt="">'
        : '<span class="cem">' + (mk.icon || '🏛') + '</span>';
      // A locked slot NAMES what you are missing. It used to read "Not found yet"
      // over a bare year, which is blind searching — you cannot go looking for
      // 1811. The title is the target; 💡 gives up the street it is on, so a kid
      // who is stuck has somewhere to walk instead of quitting.
      // EVERY tile opens its card — found ones show the story, locked ones show a
      // teaser and where to look. The old per-tile 💡 was the same two words on 34
      // tiles, which is noise; the hint belongs on the card you opened to ask.
      tile.innerHTML = '<div class="cpic">' + pic + '</div>'
        + '<div class="ctx"><div class="cnm">' + esc(mk.title) + '</div>'
        + '<div class="cyr">' + esc(mk.year) + '</div></div>';
      if (shot) (tile.querySelector('img') as HTMLImageElement).src = shot;
      tile.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        panel.classList.remove('show');
        if (got) this.collectOpen?.(mk.id);
        else this.lockedCard(mk);
      });
      grid.appendChild(tile);
    });
    stagger(grid, 0.022);
    panel.classList.add('show');
  }

  private closeHistoryCard() {
    const back = document.querySelector('#hud .hcard-back') as HTMLElement;
    back.classList.remove('open');
    (back.querySelector('.hcard') as HTMLElement).classList.remove('fresh');
    this.hcardOpen = false;
    this.hushSay();
    this.dlgCool = performance.now() + 280;
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
    this.hushSay();
    this.dlgLines = lines;
    this.dlgIdx = 0;
    this.dlgDone = onDone || null;
    this.dlgEl.classList.add('open');
    this.renderDlg();
  }

  // Read-aloud is gone — removed twice on 7/28, the second time after a "better voice"
  // pass that actually shipped one of Apple's NOVELTY voices. Don't rebuild it on
  // speechSynthesis; see docs/UX-PRINCIPLES.md §7. This stays because a returning player
  // can still be running a cached build that speaks, and it silences that on panel open.
  private hushSay() {
    try { window.speechSynthesis?.cancel(); } catch { /* fine */ }
  }

  private renderDlg() {
    const l = this.dlgLines[this.dlgIdx];
    this.dlgWho.textContent = l.who;
    this.dlgLine.textContent = l.text;
    this.dlgNext.textContent = this.dlgIdx >= this.dlgLines.length - 1 ? 'Got it ✓' : 'Next ▸';
    this.dlgBack.classList.toggle('show', this.dlgIdx > 0);   // no "back" on the first line
  }

  private advanceDlg() {
    if (!this.dlgEl.classList.contains('open')) return;
    this.hushSay();
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

  // step back to re-read the previous line — pure: the dlgDone callback only fires on
  // advancing PAST the last line, so going back has no side effects, it just re-renders.
  private backDlg() {
    if (!this.dlgEl.classList.contains('open') || this.dlgIdx <= 0) return;
    this.hushSay();
    this.dlgIdx--;
    this.renderDlg();
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

  // off-screen objective pointer: Game projects the beacon to the screen each
  // frame and, when it's off-screen, hands us an edge position + arrow angle +
  // distance. Pass null to hide (objective on-screen, or no active objective).
  private wpEl: HTMLElement | null = null;
  private wpArrow: HTMLElement | null = null;
  setWaypoint(wp: { x: number; y: number; angle: number } | null) {
    if (!this.wpEl) {
      this.wpEl = document.querySelector('#hud .waypoint');
      this.wpArrow = document.querySelector('#hud .waypoint .wp-arrow');
    }
    if (!this.wpEl) return;
    if (!wp) { this.wpEl.classList.remove('show'); return; }
    this.wpEl.classList.add('show');
    this.wpEl.style.left = wp.x + 'px';
    this.wpEl.style.top = wp.y + 'px';
    if (this.wpArrow) this.wpArrow.style.transform = 'rotate(' + wp.angle + 'rad)';
  }

  // the objective pill's leading glyph is a live steering arrow: Game feeds the
  // screen-space bearing to the beacon every frame so it always points the way.
  private objArrow: HTMLElement | null = null;
  setObjectiveArrow(angle: number | null) {
    if (!this.objArrow) this.objArrow = document.querySelector('#hud .objective .wp-q');
    if (!this.objArrow || angle == null) return;   // no guide → leave it (the pill is hidden anyway)
    this.objArrow.style.transform = 'rotate(' + angle + 'rad)';
  }

  // big serif chapter card: fades in, holds, fades out
  private chapterT: ReturnType<typeof setTimeout> | null = null;
  /** cinematic card. With `namer` (unnamed race finishes), a name box rides along:
   *  save returns the saved display name (or null if the filter rejected it) — on
   *  success the card celebrates and then bows out. */
  chapterCard(kick: string, big: string, small: string, namer?: { save: (raw: string) => string | null }) {
    const el = document.querySelector('#hud .chapter') as HTMLElement;
    (el.querySelector('.kick') as HTMLElement).textContent = kick;
    (el.querySelector('.big') as HTMLElement).textContent = big;
    const smallEl = el.querySelector('.small') as HTMLElement;
    smallEl.textContent = small;
    const box = el.querySelector('.namer') as HTMLElement;
    const inp = box.querySelector('input') as HTMLInputElement;
    if (this.chapterT) clearTimeout(this.chapterT);
    const hide = (ms: number) => { if (this.chapterT) clearTimeout(this.chapterT); this.chapterT = setTimeout(() => el.classList.remove('show'), ms); };
    if (!namer) {
      box.classList.remove('show');
      el.classList.add('show');
      hide(2700);
      return;
    }
    box.classList.add('show');
    inp.value = '';
    inp.classList.remove('bad');
    const commit = () => {
      const saved = namer.save(inp.value);
      if (saved) {
        box.classList.remove('show');
        smallEl.textContent = '★ saved — the town knows ' + saved + ' now!';
        hide(2000);
      } else {
        inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
        inp.select();
      }
    };
    (box.querySelector('button') as HTMLElement).onclick = (e) => { e.stopPropagation(); commit(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); };
    inp.onfocus = () => { if (this.chapterT) clearTimeout(this.chapterT); };   // don't yank the card mid-typing
    el.classList.add('show');
    hide(12000);   // generous fallback if they ignore the box
    setTimeout(() => inp.focus(), 350);
  }

  // a seasonal-transition beat (reuses the chapter-card overlay) shown as the story
  // turns the town to a new season — it stays up through the fade + reload that follows
  seasonCard(season: string) {
    const meta: Record<string, [string, string, string]> = {
      fall:   ['\u{1F342} THE SEASON TURNS', 'Autumn', TOWN.fallSeasonLine],
      winter: ['❄️ THE SEASON TURNS', 'Winter', 'first snow settles over the harbor'],
      spring: ['\u{1F338} THE SEASON TURNS', 'Spring', 'the marsh wakes up'],
      summer: ['☀️ THE SEASON TURNS', 'Summer', 'the harbor warms again']
    };
    const [kick, big, small] = meta[season] || meta.summer;
    const el = document.querySelector('#hud .chapter') as HTMLElement;
    (el.querySelector('.kick') as HTMLElement).textContent = kick;
    (el.querySelector('.big') as HTMLElement).textContent = big;
    (el.querySelector('.small') as HTMLElement).textContent = small;
    el.classList.add('show');
  }

  // the end-of-Level-1 moment: a cinematic "next level" promo that reveals Level 2,
  // "The Light That Walks." A sweeping lighthouse beam + drifting snow (winter is coming);
  // a Begin button (or a fallback timer) carries the player into the winter Level 2 via
  // the fade + reload Game.unlockSeasons() hands in as onBegin.
  levelTwoPromo(onBegin: () => void) {
    const el = document.querySelector('#hud .levelpromo') as HTMLElement;
    // a fresh flurry of snow each time — sizes, speeds and starts all varied
    const flakes: string[] = [];
    for (let i = 0; i < 36; i++) {
      const x = (Math.random() * 100).toFixed(1), sz = (2 + Math.random() * 4).toFixed(1);
      const dur = (4 + Math.random() * 6).toFixed(1), delay = (-Math.random() * 9).toFixed(1);
      const op = (0.5 + Math.random() * 0.45).toFixed(2);
      flakes.push(`<i style="left:${x}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${op}"></i>`);
    }
    (el.querySelector('.lp-snow') as HTMLElement).innerHTML = flakes.join('');
    let done = false, timer = 0;
    const begin = () => { if (done) return; done = true; clearTimeout(timer); el.classList.remove('show'); onBegin(); };
    (el.querySelector('.lp-go') as HTMLElement).onclick = begin;
    el.classList.add('show');
    timer = window.setTimeout(begin, 14000);   // auto-advance if they just watch
  }

  // Reusable "what's new" promo card — call it once when a cool feature ships. Shows a single
  // time per `key` (persisted in localStorage), so it never nags. Returns true if it was shown.
  // Optional `cta`/`onCta` add a primary button (e.g. "Take me there"); there's always a dismiss.
  featurePromo(opts: { key: string; icon: string; title: string; body: string; badge?: string; cta?: string; onCta?: () => void }): boolean {
    try { if (localStorage.getItem(opts.key) === '1') return false; } catch { /* private mode */ }
    const seen = () => { try { localStorage.setItem(opts.key, '1'); } catch { /* ignore */ } };
    const el = document.querySelector('#hud .promo') as HTMLElement;
    (el.querySelector('.promo-badge') as HTMLElement).textContent = opts.badge || 'NEW';
    (el.querySelector('.promo-icon') as HTMLElement).textContent = opts.icon;
    (el.querySelector('.promo-title') as HTMLElement).textContent = opts.title;
    (el.querySelector('.promo-body') as HTMLElement).textContent = opts.body;
    const cta = el.querySelector('.promo-cta') as HTMLElement;
    const skip = el.querySelector('.promo-skip') as HTMLElement;
    const close = () => { seen(); el.classList.remove('show'); };
    if (opts.cta) {
      cta.style.display = '';
      cta.textContent = opts.cta;
      cta.onclick = () => { close(); opts.onCta?.(); };
      skip.textContent = 'Maybe later';
    } else {
      cta.style.display = 'none';
      skip.textContent = 'Got it';
    }
    skip.onclick = close;
    (el.querySelector('.promo-x') as HTMLElement).onclick = close;
    el.classList.add('show');
    return true;
  }

  private runTipTimer = 0;
  // a one-time toast teaching the run control (keys vs touch)
  showRunTip() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const el = document.querySelector('#hud .runtip') as HTMLElement;
    el.innerHTML = touch ? '💡 Tap <b>🏃</b> to run' : '💡 Press <b>R</b> to run · hold <b>Shift</b> to sprint';
    el.classList.add('show');
    clearTimeout(this.runTipTimer);
    this.runTipTimer = window.setTimeout(() => el.classList.remove('show'), 5000);
  }

  private streetTipTimer = 0;
  // a one-time, ignorable nudge: this is the real map — tap to find your street.
  // replaces the old welcome card so the drop-in stays instant; a tap opens search.
  showStreetNudge(onSeen?: () => void) {
    onSeen?.();                              // mark it seen now, so it never nags twice
    const el = document.querySelector('#hud .streettip') as HTMLElement;
    el.innerHTML = TOWN.streetNudge;
    el.classList.add('show');
    el.onclick = () => { el.classList.remove('show'); clearTimeout(this.streetTipTimer); this.toggleTravel(true); };
    clearTimeout(this.streetTipTimer);
    this.streetTipTimer = window.setTimeout(() => el.classList.remove('show'), 7000);
  }

  // tunnel-dark edges while underground
  setVignette(on: boolean) {
    (document.querySelector('#hud .vignette') as HTMLElement).classList.toggle('on', on);
  }

  // Force-close conversational UI before a scene jump. Every teleport routes through
  // fadeThrough (race starts, fast travel, flight, tunnel doors), and a dialogue that
  // rides along to the far side of town is worse than one you re-open — so drop it
  // WITHOUT firing its onDone: no quest step may advance off a line nobody finished
  // reading. Re-talking to the NPC replays it cleanly.
  closeTransient() {
    this.hushSay();
    if (this.dlgEl?.classList.contains('open')) {
      this.dlgEl.classList.remove('open');
      this.dlgDone = null;
      this.dlgCool = performance.now() + 280;
    }
    if (this.hcardOpen) this.closeHistoryCard();
    document.querySelector('#hud .collect-panel')?.classList.remove('show');
    document.querySelector('#hud .race-pop')?.classList.remove('open');
    document.querySelector('#hud .season-pop')?.classList.remove('open');
    document.querySelector('#hud .settings-pop')?.classList.remove('open');
    document.querySelector('#hud .streettip')?.classList.remove('show');
  }

  // quick fade to black around a teleport
  fadeThrough(action: () => void) {
    this.closeTransient();
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

  /** un-throttled landmark-style banner for system announcements (race endings etc.) */
  announce(name: string, sub: string) {
    this.bannerName.textContent = name;
    this.bannerSub.textContent = sub;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 3400);
  }

  // `force` skips the 90-second ambient cooldown: walking past a place twice in a
  // minute should not re-announce it, but deliberately fast-travelling to it must
  // ALWAYS say where you have arrived.
  maybeShowLandmark(lm: Landmark, force = false): boolean {
    const now = performance.now();
    const last = this.lastShown.get(lm.id) || -1e9;
    if (!force && now - last < 90_000) return false;
    this.lastShown.set(lm.id, now);
    this.bannerName.textContent = lm.name;
    this.bannerSub.textContent = lm.sub;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 3400);
    return true;
  }
}
