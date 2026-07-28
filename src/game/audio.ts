// Procedural WebAudio for NBPT Living: a chill generative music loop plus
// ambient life — footsteps that match the ground, songbirds, and gulls when
// you're near the water. Everything is synthesized; no audio assets.

import { SEASON } from '../world/style';

const MUSIC_LEVEL = 0.22;
const AMBIENT_LEVEL = 0.5;

// ── FIVE LO-FI STYLES ─────────────────────────────────────────────────────
// All of this is synthesized — there are no audio assets in the project — so a
// "track" here is a set of numbers: the chords, the key, how long a chord lasts,
// what the pad and the plucks are made of, and how busy the melody is. Changing
// those changes the music completely, which is why five genuinely different
// moods cost five objects rather than five downloads.
//
// The season still nudges the result (winter darker and slower, spring brighter)
// but the STYLE is now the primary voice, and it is the player's choice.
export type MusicStyle = {
  id: string;
  name: string;
  sub: string;
  emoji: string;
  chords: number[][];
  key: number;          // multiplier on C3
  bar: number;          // seconds per chord
  lp: number;           // pad lowpass cutoff
  padType: OscillatorType;
  padDetune: number;
  swell: number;        // pad attack, seconds
  padGain: number;
  bassType: OscillatorType;
  bassPulses: number;   // 0 = one long root per bar; N = N notes per bar
  bassGain: number;
  pluck: number;        // 0..1 chance per eighth slot
  pluckType: OscillatorType;
  pluckDecay: number;
  pluckHigh: number;    // chance the pluck jumps an octave
  echo: number;         // 0..1 send into the delay
};

export const MUSIC_STYLES: MusicStyle[] = [
  {
    id: 'porch', name: 'Front Porch', sub: 'Warm and easy — the town’s own tune', emoji: '🌤',
    chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 16]],
    key: 1, bar: 4.8, lp: 850, padType: 'triangle', padDetune: 4, swell: 1.6, padGain: 0.022,
    bassType: 'sine', bassPulses: 0, bassGain: 0.07,
    pluck: 0.3, pluckType: 'triangle', pluckDecay: 1.2, pluckHigh: 0.25, echo: 0.5
  },
  {
    id: 'rain', name: 'Rainy Day', sub: 'Slow minor ninths under a heavy blanket', emoji: '🌧',
    chords: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 10], [-5, -1, 2, 7]],
    key: 0.891, bar: 6.4, lp: 520, padType: 'triangle', padDetune: 7, swell: 3.2, padGain: 0.03,
    bassType: 'sine', bassPulses: 0, bassGain: 0.085,
    pluck: 0.12, pluckType: 'sine', pluckDecay: 1.9, pluckHigh: 0.1, echo: 0.85
  },
  {
    id: 'night', name: 'Night Drive', sub: 'A walking bass and a cold blue chord', emoji: '🌙',
    chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 1, 5, 8], [3, 7, 10, 14]],
    key: 0.841, bar: 3.6, lp: 980, padType: 'sawtooth', padDetune: 3, swell: 0.5, padGain: 0.011,
    bassType: 'triangle', bassPulses: 4, bassGain: 0.075,
    pluck: 0.22, pluckType: 'square', pluckDecay: 0.5, pluckHigh: 0.45, echo: 0.6
  },
  {
    id: 'sunroom', name: 'Sunroom', sub: 'Bright major keys and busy little bells', emoji: '🌼',
    chords: [[0, 4, 7, 11], [2, 5, 9, 12], [7, 11, 14, 18], [5, 9, 12, 16]],
    key: 1.26, bar: 3.9, lp: 1500, padType: 'triangle', padDetune: 2, swell: 0.9, padGain: 0.016,
    bassType: 'sine', bassPulses: 2, bassGain: 0.055,
    pluck: 0.5, pluckType: 'triangle', pluckDecay: 0.55, pluckHigh: 0.5, echo: 0.35
  },
  {
    id: 'fog', name: 'Harbor Fog', sub: 'Barely a tune at all — long, wide and open', emoji: '🌫',
    chords: [[0, 5, 10, 17], [-2, 3, 8, 15], [-5, 0, 5, 12], [2, 7, 12, 19]],
    key: 0.749, bar: 9.5, lp: 420, padType: 'sine', padDetune: 11, swell: 5.0, padGain: 0.036,
    bassType: 'sine', bassPulses: 0, bassGain: 0.09,
    pluck: 0.05, pluckType: 'sine', pluckDecay: 3.2, pluckHigh: 0.15, echo: 1
  }
];

export const DEFAULT_STYLE = 'porch';
export function savedStyle(): string {
  try { return localStorage.getItem('nbpt-music') || DEFAULT_STYLE; } catch { return DEFAULT_STYLE; }
}

// The season still colours whatever style is playing — a whole step down and a
// slower bar in winter, a step up and a livelier one in spring.
const SEASON_KEY = SEASON === 'spring' ? 1.122 : SEASON === 'fall' ? 0.944 : SEASON === 'winter' ? 0.891 : 1;
const SEASON_BAR = SEASON === 'spring' ? 0.92 : SEASON === 'fall' ? 1.08 : SEASON === 'winter' ? 1.2 : 1;

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic, two octaves
const C3 = 130.81;

export type StepSurface = 'soft' | 'hard' | 'wood';

export class GameAudio {
  enabled: boolean;

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private ambient!: GainNode;
  private echo!: DelayNode;
  private noiseBuf: AudioBuffer | null = null;
  private nextBar = 0;
  private chordIdx = 0;
  private stepAcc = 0;
  private nextBird = 4 + Math.random() * 6;
  private nextGull = 14 + Math.random() * 10;
  private nearWater = false;
  private underground = false;
  private musicLP: BiquadFilterNode | null = null;
  private nextDrip = 3;
  // the playing style, and the numbers derived from it (season-coloured)
  private st: MusicStyle = MUSIC_STYLES.find((m) => m.id === savedStyle()) ?? MUSIC_STYLES[0];
  private get bar(): number { return this.st.bar * SEASON_BAR; }
  private get base(): number { return C3 * this.st.key * SEASON_KEY; }

  constructor() {
    this.enabled = localStorage.getItem('nbpt-sound') !== 'off';
    const unlock = () => {
      this.boot();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('nbpt-sound', this.enabled ? 'on' : 'off');
    if (this.enabled) this.boot();
    if (this.ctx && this.master) {
      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.8 : 0, this.ctx.currentTime + 0.2);
    }
    return this.enabled;
  }

  // Switch the music. The next bar picks the new numbers up on its own — there is
  // nothing to stop and restart, because every bar is scheduled from scratch.
  setMusicStyle(id: string): MusicStyle {
    this.st = MUSIC_STYLES.find((m) => m.id === id) ?? MUSIC_STYLES[0];
    try { localStorage.setItem('nbpt-music', this.st.id); } catch { /* private mode */ }
    if (this.ctx && this.enabled) this.boot();
    return this.st;
  }
  get musicStyle(): MusicStyle { return this.st; }

  setNearWater(b: boolean) {
    this.nearWater = b;
  }

  // underground: muffle the music, hold the birds, start the drips
  setUnderground(b: boolean) {
    if (this.underground === b) return;
    this.underground = b;
    if (this.ctx && this.musicLP) {
      this.musicLP.frequency.setTargetAtTime(b ? 650 : 16500, this.ctx.currentTime, 0.4);
    }
    this.nextDrip = 1.2;
  }

  // a stone scrape + low thud for climbing in and out of the grate
  stoneScrape() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.45;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t0);
    f.frequency.exponentialRampToValueAtTime(240, t0 + 0.38);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.5);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(82, t0 + 0.3);
    o.frequency.exponentialRampToValueAtTime(46, t0 + 0.5);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0 + 0.3);
    og.gain.exponentialRampToValueAtTime(0.2, t0 + 0.34);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    o.connect(og);
    og.connect(this.master);
    o.start(t0 + 0.3);
    o.stop(t0 + 0.6);
  }

  // bike bell: ding-ding
  bell() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    for (const at of [0, 0.12]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 1318;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 1318 * 2.7;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.32);
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2);
      g2.connect(g);
      o.connect(g);
      g.connect(this.master);
      o.start(t0 + at);
      o.stop(t0 + at + 0.36);
      o2.start(t0 + at);
      o2.stop(t0 + at + 0.36);
    }
  }

  // newspaper hitting a porch
  thump() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.01;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.14);
  }

  // soft page-turn for the history cards
  paper() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.01;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.6;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.2);
  }

  // a single echoing cave drip
  private drip() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.02;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const f0 = 1150 + Math.random() * 500;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.52, t0 + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    const p = this.ctx.createStereoPanner();
    p.pan.value = (Math.random() - 0.5) * 1.4;
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    g.connect(this.echo);   // distant muffled repeats roll down the tunnel
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  private boot() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    if (!this.enabled) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);

    this.music = this.ctx.createGain();
    this.music.gain.value = MUSIC_LEVEL;
    this.musicLP = this.ctx.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = this.underground ? 650 : 16500;
    this.music.connect(this.musicLP);
    this.musicLP.connect(this.master);
    // gentle echo bus gives the plucks porch-at-dusk space
    this.echo = this.ctx.createDelay(1);
    this.echo.delayTime.value = 0.34;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.32;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.3;
    this.echo.connect(fb);
    fb.connect(this.echo);
    this.echo.connect(wet);
    wet.connect(this.music);

    this.ambient = this.ctx.createGain();
    this.ambient.gain.value = AMBIENT_LEVEL;
    this.ambient.connect(this.master);

    const len = Math.floor(this.ctx.sampleRate * 0.14);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.nextBar = this.ctx.currentTime + 0.3;
  }

  // ---------- music ----------

  private freq(semi: number, base = C3): number {
    return base * Math.pow(2, semi / 12);
  }

  private pluck(t: number, hz: number, vel: number, dur: number,
                type: OscillatorType = 'triangle', echo = 0.5) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.music);
    if (echo > 0.01) {
      const send = this.ctx.createGain();
      send.gain.value = echo;
      g.connect(send);
      send.connect(this.echo);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- quest stingers ----------

  // rising pentatonic plucks — objective complete
  jingle() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.03;
    const notes: [number, number][] = [[523.25, 0], [659.25, 0.11], [783.99, 0.22], [1046.5, 0.38]];
    for (const [hz, at] of notes) this.pluck(t0 + at, hz, 0.17, 1.3);
  }

  // two quick yips for Clipper
  bark() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    for (const at of [0, 0.17]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(430 + at * 240, t0 + at);
      o.frequency.exponentialRampToValueAtTime(165, t0 + at + 0.09);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 950;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.11);
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start(t0 + at);
      o.stop(t0 + at + 0.14);
    }
  }

  // ---------- secret stingers (the easter-egg voice: quick, high, sly) ----------

  // four fast sparkle plucks + a shimmer tail — "you found something"
  secret() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    const notes: [number, number][] = [[783.99, 0], [987.77, 0.07], [1318.5, 0.14], [1567.98, 0.24]];
    for (const [hz, at] of notes) this.pluck(t0 + at, hz, 0.13, 0.8);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2637;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + 0.24);
    g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g);
    g.connect(this.music);
    g.connect(this.echo);
    o.start(t0 + 0.24);
    o.stop(t0 + 1.2);
  }

  // the Revere bell: deep strike, inharmonic partials, long bronze decay
  toll(times = 2) {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    for (let i = 0; i < times; i++) {
      const t0 = this.ctx.currentTime + 0.04 + i * 2.3;
      for (const [ratio, vel, dur] of [[1, 0.22, 4.4], [2.02, 0.1, 2.6], [2.94, 0.06, 1.7], [4.18, 0.035, 1.0]] as const) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 174.6 * ratio;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vel, t0 + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t0);
        o.stop(t0 + dur + 0.1);
      }
      // clapper strike
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.09);
    }
  }

  // bullfrogs: low sawtooth ribbits with a throat wobble
  croak(times = 3) {
    if (!this.ctx || !this.enabled) return;
    for (let i = 0; i < times; i++) {
      const t0 = this.ctx.currentTime + 0.03 + i * (0.34 + Math.random() * 0.22);
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = 96 + Math.random() * 26;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f0 * 0.74, t0 + 0.2);
      const wob = this.ctx.createOscillator();
      wob.frequency.value = 26;
      const wg = this.ctx.createGain();
      wg.gain.value = 0.045;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.03);
      g.gain.setValueAtTime(0.09, t0 + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      wob.connect(wg);
      wg.connect(g.gain);
      const p = this.ctx.createStereoPanner();
      p.pan.value = (Math.random() - 0.5) * 0.9;
      o.connect(f);
      f.connect(g);
      g.connect(p);
      p.connect(this.ambient);
      o.start(t0);
      o.stop(t0 + 0.27);
      wob.start(t0);
      wob.stop(t0 + 0.27);
    }
  }

  // a coin meeting fountain water: bright ping, tiny splash
  plink() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1980, t0);
    o.frequency.exponentialRampToValueAtTime(1280, t0 + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.25);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2400;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t0 + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.05, t0 + 0.07);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    src.connect(f);
    f.connect(sg);
    sg.connect(this.master);
    src.start(t0 + 0.05);
    src.stop(t0 + 0.22);
  }

  // one firework: thump, bloom, crackle
  pop() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t0);
    f.frequency.exponentialRampToValueAtTime(300, t0 + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.42);
    // crackle tail
    for (let i = 0; i < 5; i++) {
      const at = t0 + 0.16 + Math.random() * 0.5;
      const c = this.ctx.createBufferSource();
      c.buffer = this.noiseBuf;
      c.playbackRate.value = 1.8;
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'highpass';
      cf.frequency.value = 3000;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.035, at);
      cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
      const p = this.ctx.createStereoPanner();
      p.pan.value = (Math.random() - 0.5) * 1.6;
      c.connect(cf);
      cf.connect(cg);
      cg.connect(p);
      p.connect(this.master);
      c.start(at);
      c.stop(at + 0.05);
    }
  }

  // a little radial engine puttering by — pitch rises, passes, fades
  putter(dur = 16) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.05;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(62, t0);
    o.frequency.linearRampToValueAtTime(88, t0 + dur * 0.45);
    o.frequency.linearRampToValueAtTime(58, t0 + dur);
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 13;
    const lg = this.ctx.createGain();
    lg.gain.value = 0.028;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 1.4);
    g.gain.setValueAtTime(0.05, t0 + dur - 2.5);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    lfo.connect(lg);
    lg.connect(g.gain);
    o.connect(f);
    f.connect(g);
    g.connect(this.ambient);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.1);
  }

  // something very large, very old, and very far offshore
  moan() {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.05;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(88, t0);
    o.frequency.linearRampToValueAtTime(56, t0 + 1.1);
    o.frequency.linearRampToValueAtTime(72, t0 + 2.1);
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 3.4;
    const vg = this.ctx.createGain();
    vg.gain.value = 3.5;
    vib.connect(vg);
    vg.connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.085, t0 + 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 2.3);
    o.connect(g);
    g.connect(this.master);
    g.connect(this.echo);
    o.start(t0);
    o.stop(t0 + 2.4);
    vib.start(t0);
    vib.stop(t0 + 2.4);
    // the sea stirring under it
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t0);
    sg.gain.linearRampToValueAtTime(0.05, t0 + 1.0);
    sg.gain.linearRampToValueAtTime(0.0001, t0 + 2.4);
    src.connect(f);
    f.connect(sg);
    sg.connect(this.master);
    src.start(t0);
    src.stop(t0 + 2.5);
  }

  // station PA: ding-dong, then your imagination provides the garbled voice
  pa() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.03;
    for (const [hz, at] of [[880, 0], [659.25, 0.42]] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.7);
      o.connect(g);
      g.connect(this.master);
      o.start(t0 + at);
      o.stop(t0 + at + 0.75);
    }
  }

  // old neon waking up: hum, stutter, hold
  buzz() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.02;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 118;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 850;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    // flicker: on-off-on-off-ON
    for (const [at, v] of [[0, 0.05], [0.09, 0.001], [0.16, 0.045], [0.26, 0.001], [0.34, 0.055]] as const) {
      g.gain.linearRampToValueAtTime(v, t0 + at + 0.015);
      g.gain.setValueAtTime(v, t0 + at + 0.02);
    }
    g.gain.setValueAtTime(0.055, t0 + 1.0);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 1.5);
    o.connect(f);
    f.connect(g);
    g.connect(this.ambient);
    o.start(t0);
    o.stop(t0 + 1.55);
  }

  // one long pull of a workboat horn, somewhere downriver
  horn() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.04;
    for (const [hz, vel] of [[112, 0.07], [168, 0.028]] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = hz;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 360;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vel, t0 + 0.18);
      g.gain.setValueAtTime(vel, t0 + 0.85);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 1.25);
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 1.3);
    }
  }

  // "…polo." — two faint marimba notes from across the fences
  polo() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + 0.55;
    const pan = Math.random() < 0.5 ? -0.85 : 0.85;
    for (const [hz, at] of [[659.25, 0], [523.25, 0.22]] as const) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5);
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(g);
      g.connect(p);
      p.connect(this.ambient);
      g.connect(this.echo);
      o.start(t0 + at);
      o.stop(t0 + at + 0.55);
    }
  }

  private scheduleBar(t: number) {
    if (!this.ctx) return;
    const S = this.st, BAR = this.bar, BASE = this.base;
    const chord = S.chords[this.chordIdx % S.chords.length];
    this.chordIdx++;
    // the pad: detuned oscillators through a lowpass, swelling over the bar
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = S.lp;
    lp.connect(this.music);
    for (const semi of chord) {
      for (const det of [-S.padDetune, S.padDetune]) {
        const o = this.ctx.createOscillator();
        o.type = S.padType;
        o.frequency.value = this.freq(semi + 12, BASE);
        o.detune.value = det;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(S.padGain, t + Math.min(S.swell, BAR * 0.7));
        g.gain.setValueAtTime(S.padGain, t + BAR - 1.2);
        g.gain.linearRampToValueAtTime(0, t + BAR + 0.6);
        o.connect(g);
        g.connect(lp);
        o.start(t);
        o.stop(t + BAR + 0.8);
      }
    }
    // the bass: one long root, or a walking pulse for the styles that want one
    const pulses = Math.max(1, S.bassPulses);
    for (let i = 0; i < pulses; i++) {
      const o = this.ctx.createOscillator();
      o.type = S.bassType;
      // a walking line steps through the chord; a single root just holds
      const semi = S.bassPulses ? chord[i % chord.length] - (i % 2 ? 0 : 0) : chord[0];
      o.frequency.value = this.freq(semi, BASE / 2);
      const g = this.ctx.createGain();
      const at = t + (i / pulses) * BAR;
      const dur = S.bassPulses ? (BAR / pulses) * 0.85 : BAR * 0.9;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(S.bassGain, at + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      o.connect(g);
      g.connect(this.music);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
    // pentatonic plucks on eighth slots — how busy is the style's whole character
    const slots = 8;
    for (let sI = 0; sI < slots; sI++) {
      if (Math.random() > S.pluck) continue;
      const semi = PENTA[Math.floor(Math.random() * PENTA.length)];
      const oct = Math.random() < S.pluckHigh ? 24 : 12;
      this.pluck(t + (sI / slots) * BAR, this.freq(semi + oct, BASE * 2),
        0.05 + Math.random() * 0.035, S.pluckDecay * (0.8 + Math.random() * 0.5), S.pluckType, S.echo);
    }
  }

  // ---------- ambient one-shots ----------

  step(surface: StepSurface, sprint: boolean) {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    const g = this.ctx.createGain();
    const vel = (sprint ? 0.16 : 0.11) * (0.85 + Math.random() * 0.3);
    let dur = 0.055;
    if (surface === 'wood') {
      f.frequency.value = 1300;
      dur = 0.08;
      // hollow deck knock under the scuff
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(130 + Math.random() * 25, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(vel * 1.1, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(og);
      og.connect(this.ambient);
      o.start(t);
      o.stop(t + 0.1);
    } else if (surface === 'hard') {
      f.frequency.value = 2300;
      dur = 0.04;
    } else {
      f.frequency.value = 650 + Math.random() * 250;
      dur = 0.07;
    }
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.ambient);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private chirp(t: number, pan: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const f0 = 2500 + Math.random() * 1500;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), t + 0.04);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.02, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.1);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(this.ambient);
    o.start(t);
    o.stop(t + 0.12);
  }

  private songbird() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const pan = Math.random() * 1.6 - 0.8;
    const n = 2 + Math.floor(Math.random() * 4);
    let at = t;
    for (let i = 0; i < n; i++) {
      this.chirp(at, pan);
      at += 0.09 + Math.random() * 0.15;
    }
  }

  gull() {
    if (!this.ctx) return;
    const pan = Math.random() * 1.4 - 0.7;
    let at = this.ctx.currentTime;
    const cries = 1 + Math.floor(Math.random() * 2);
    for (let c = 0; c < cries; c++) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = 1050 + Math.random() * 250;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.linearRampToValueAtTime(f0 * 1.12, at + 0.1);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.58, at + 0.5);
      const v = this.ctx.createOscillator(); // vibrato
      v.frequency.value = 26;
      const vg = this.ctx.createGain();
      vg.gain.value = 22;
      v.connect(vg);
      vg.connect(o.frequency);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.028, at + 0.05);
      g.gain.setValueAtTime(0.028, at + 0.32);
      g.gain.exponentialRampToValueAtTime(0.0008, at + 0.55);
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(lp);
      lp.connect(g);
      g.connect(p);
      p.connect(this.ambient);
      o.start(at);
      o.stop(at + 0.6);
      v.start(at);
      v.stop(at + 0.6);
      at += 0.7 + Math.random() * 0.25;
    }
  }

  // ---------- per-frame ----------

  update(dt: number, moving: boolean, sprint: boolean, surfaceOf: () => StepSurface) {
    if (!this.ctx || !this.enabled) return;
    // music: lookahead scheduler, one chord bar at a time
    if (this.ctx.currentTime > this.nextBar - 0.35) {
      this.scheduleBar(this.nextBar);
      this.nextBar += this.bar;
    }
    // footsteps synced to gait
    if (moving) {
      this.stepAcc += dt * (sprint ? 3.4 : 2.5);
      if (this.stepAcc >= 1) {
        this.stepAcc %= 1;
        this.step(surfaceOf(), sprint);
      }
    } else {
      this.stepAcc = 0.7; // first step lands quickly when you set off
    }
    if (this.underground) {
      this.nextDrip -= dt;
      if (this.nextDrip <= 0) {
        this.drip();
        this.nextDrip = 2.2 + Math.random() * 6;
      }
      return; // no birdsong down here
    }
    // occasional birds; gulls only by the water
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.songbird();
      this.nextBird = 5 + Math.random() * 11;
    }
    if (this.nearWater) {
      this.nextGull -= dt;
      if (this.nextGull <= 0) {
        this.gull();
        this.nextGull = 11 + Math.random() * 16;
      }
    }
  }
}
