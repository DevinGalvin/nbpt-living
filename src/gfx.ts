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

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d; };

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
  normalMaps: q.has('nm') ? q.get('nm') !== '0' : !coarse,
  // windows that light up as night falls (?win=0 off)
  nightWindows: q.get('win') !== '0',
  // -1 = decide from device (1024 on touch/weak GPUs, 2048 elsewhere)
  shadowSize: num('shadow', -1),
  // real PointLights are the one per-fragment cost that scales with count; six nearest
  // lamps carry the light, the glow discs carry the rest of the street
  lampLights: Math.max(0, Math.min(16, Math.round(num('lights', 6)))),
  lampGlows: 16
};
