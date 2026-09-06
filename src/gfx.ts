import * as THREE from 'three';

// Graphics settings in one place. Everything visual in the game is procedural, so none
// of these cost download size; they trade GPU time for look. Each has a URL override so
// a build can be A/B'd on a real phone without a redeploy:
//   ?tm=neutral|aces|agx|none   tone mapping (default neutral)
//   ?exp=1.0                    exposure
//   ?shadow=2048|1024|0         shadow map size (0 = off)
//   ?lights=6                   point lights in the street-lamp pool
//   ?ao=0                       baked wall ambient occlusion off
//   ?nm=0|1                     procedural normal maps (default: on, off on touch devices)
//   ?win=0                      windows that light up at night, off
//   ?clouds=0|0.6               cloud shadows off / strength (default 0.42)
//   ?post=0|1                   desktop post stack (default: on, off on touch devices)
//   ?ssao=1  ?bloom=0           screen-space AO on (opt-in) / bloom off

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d; };
// the ⚙️ Settings › Graphics switches, kept in localStorage; a URL flag still wins
export const GFX_PREF_KEYS = ['sky', 'post', 'nm', 'shadow'] as const;
export type GfxPrefKey = typeof GFX_PREF_KEYS[number];
function pref(k: GfxPrefKey): boolean | null {
  try { const v = localStorage.getItem('nbpt-gfx-' + k); return v === null ? null : v === '1'; } catch { return null; }
}
export function setGfxPref(k: GfxPrefKey, on: boolean) {
  try { localStorage.setItem('nbpt-gfx-' + k, on ? '1' : '0'); } catch { /* private mode */ }
}
// URL flag, else the saved preference, else the default
const flag = (k: GfxPrefKey, urlKey: string, d: boolean) => q.has(urlKey) ? q.get(urlKey) !== '0' : (pref(k) ?? d);

// touch-first devices get the lighter tier; the same test Game.ts uses for chunk budgets
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const TONE: Record<string, THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping, none: THREE.NoToneMapping
};

export const GFX = {
  // Khronos "Neutral": leaves everything below ~80% untouched, so the authored palette
  // and the sky stay exactly as tuned, and only rolls off the sunlit whites that used to
  // clip. ACES was tried and bleaches the sky dome to near-white; AgX greys the greens.
  toneMapping: TONE[q.get('tm') ?? 'neutral'] ?? THREE.NeutralToneMapping,
  exposure: num('exp', 1.0),
  ao: q.get('ao') !== '0',
  // procedural normal maps on brick / clapboard / shingle / plank: one extra texture
  // fetch plus derivative math per decor fragment — worth it on desktop, skipped on
  // phones (?nm=1 forces on, ?nm=0 off)
  normalMaps: flag('nm', 'nm', !coarse),
  // real prop models (cars, benches, hydrants) instead of procedural boxes (?props=0 off)
  props: q.get('props') !== '0',
  // windows that light up as night falls (?win=0 off)
  nightWindows: q.get('win') !== '0',
  // cloud shadows drifting over the town, every tier (?clouds=0 off, ?clouds=0.6 strength)
  clouds: q.get('clouds') === '0' ? 0 : num('clouds', 0.5),
  // desktop post stack: GTAO + bloom + grade. Never on touch devices; ?post=0|1 overrides,
  // ?ao=0 also turns the screen-space AO pass off, ?bloom=0 the bloom.
  post: flag('post', 'post', !coarse),
  postForced: q.get('post') === '1',   // ?post=1 also overrides the weak-GPU guard
  // screen-space AO is opt-in (?ssao=1) until its radius and denoise are tuned on real
  // hardware; the baked wall AO carries the look meanwhile
  postAO: q.get('ssao') === '1',
  postBloom: q.get('bloom') !== '0',
  // -1 = decide from device (1024 on touch/weak GPUs, 2048 elsewhere); the switch turns them off
  shadowSize: q.has('shadow') ? num('shadow', -1) : (pref('shadow') === false ? 0 : -1),
  // real PointLights are the one per-fragment cost that scales with count; six nearest
  // lamps carry the light, the glow discs carry the rest of the street
  lampLights: Math.max(0, Math.min(16, Math.round(num('lights', 6)))),
  // the glow discs are additive quads, nearly free: a downtown street at night should glow post after post
  lampGlows: coarse ? 16 : 36,
  // warm patches of shop-window light on the sidewalk, same texture, nearest windows first
  shopSpills: coarse ? 32 : 72,
  // The visible cloud layer is a full-sky transparent pass; the cloud SHADOWS are one
  // texture fetch and stay on everywhere. Off on touch screens; ?sky=0 turns it off anywhere.
  skyClouds: flag('sky', 'sky', !coarse),
  // Ground texture size per chunk. The canvas is painted at 768 (one texel per world px,
  // 12.5 cm); phones keep 70 of them resident and that is what they run out of. 576 on
  // touch screens is 17 cm a texel and 44% less memory, unseen on a phone-sized screen.
  groundRes: q.has('gres') ? Math.max(256, Math.min(768, num('gres', 768))) : coarse ? 576 : 768
};
