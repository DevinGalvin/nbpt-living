import * as THREE from 'three';

// 🩺 ?flicker=1: an overlay that puts the machine's facts into a screenshot — the GPU and
// render path, any shader that failed to compile, and a heat-map of the pixels that
// changed between two frames a moment apart. Flicker cannot be seen in a still; the
// map can. Red = changed. Water, walkers and cars change on their own and show as a
// steady wash; z-fighting shows as speckle over the whole of a surface.
export class Diag {
  private box: HTMLDivElement;
  private text: HTMLPreElement;
  private inset: HTMLCanvasElement;
  private small: HTMLCanvasElement;
  private prev: Uint8ClampedArray | null = null;
  private last = 0;
  private errors: string[] = [];
  private facts: Record<string, string | number | boolean> = {};
  private W = 192; private H = 120;

  constructor(private renderer: THREE.WebGLRenderer, facts: Record<string, string | number | boolean>) {
    this.facts = facts;
    const gl = renderer.getContext();
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.facts.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'masked';
    } catch { this.facts.gpu = '?'; }
    this.facts.webgl2 = renderer.capabilities.isWebGL2;
    this.facts.maxTex = renderer.capabilities.maxTextures;
    this.facts.floatLinear = !!gl.getExtension('OES_texture_float_linear');
    this.facts.halfFloatColor = !!gl.getExtension('EXT_color_buffer_half_float') || !!gl.getExtension('EXT_color_buffer_float');
    this.facts.dpr = +renderer.getPixelRatio().toFixed(2);
    this.facts.ua = navigator.userAgent.replace(/Mozilla\/5.0 \(|\)/g, '').slice(0, 90);
    // three.js hands every failed program here, with the driver's own log
    renderer.debug.onShaderError = (_gl, program, vs, fs) => {
      const log = (_gl.getProgramInfoLog(program) ?? '') + ' ' + (_gl.getShaderInfoLog(vs) ?? '') + ' ' + (_gl.getShaderInfoLog(fs) ?? '');
      this.errors.push('SHADER: ' + log.replace(/\s+/g, ' ').slice(0, 200));
    };
    // …and anything else three.js or the browser says
    const orig = { error: console.error.bind(console), warn: console.warn.bind(console) };
    console.error = (...a: unknown[]) => { this.note(a); orig.error(...a); };
    console.warn = (...a: unknown[]) => { this.note(a); orig.warn(...a); };
    window.addEventListener('error', (e) => this.errors.push('JS: ' + String(e.message).slice(0, 160)));
    renderer.domElement.addEventListener('webglcontextlost', () => this.errors.push('CONTEXT LOST'));

    this.box = document.createElement('div');
    this.box.style.cssText = 'position:fixed;left:8px;bottom:36px;z-index:99999;background:rgba(0,0,0,.78);color:#fff;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:6px;max-width:560px;pointer-events:none;display:flex;gap:8px;align-items:flex-start';
    this.text = document.createElement('pre');
    this.text.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;max-width:350px';
    this.inset = document.createElement('canvas');
    this.inset.width = this.W; this.inset.height = this.H;
    this.inset.style.cssText = `width:${this.W}px;height:${this.H}px;border:1px solid #888;image-rendering:pixelated;flex:none`;
    this.small = document.createElement('canvas');
    this.small.width = this.W; this.small.height = this.H;
    this.box.append(this.text, this.inset);
    document.body.appendChild(this.box);
  }

  private note(a: unknown[]) {
    const s = a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(' ');
    if (/three|webgl|shader|texture|gl\b|program/i.test(s)) this.errors.push(s.replace(/\s+/g, ' ').slice(0, 200));
    if (this.errors.length > 6) this.errors.splice(0, this.errors.length - 6);
  }

  /** call right after the frame is rendered (the drawing buffer is still valid then) */
  private armed = false;
  after(t: number, extra: Record<string, string | number | boolean>) {
    // two CONSECUTIVE frames, once a second: z-fighting flips between frames; clouds,
    // water and walkers barely move in one, so a flicker stands out from the motion
    if (!this.armed && t - this.last < 1000) return;
    this.last = t;
    const c = this.small.getContext('2d', { willReadFrequently: true })!;
    try { c.drawImage(this.renderer.domElement, 0, 0, this.W, this.H); } catch { return; }
    const cur = c.getImageData(0, 0, this.W, this.H).data;
    if (!this.armed) { this.prev = cur.slice(); this.armed = true; return; }
    this.armed = false;
    const out = this.inset.getContext('2d')!;
    let changed = 0;
    if (this.prev) {
      const img = out.createImageData(this.W, this.H);
      for (let i = 0; i < cur.length; i += 4) {
        const d = Math.abs(cur[i] - this.prev[i]) + Math.abs(cur[i + 1] - this.prev[i + 1]) + Math.abs(cur[i + 2] - this.prev[i + 2]);
        const hit = d > 36;
        if (hit) changed++;
        // the frame, dimmed, with the changed pixels in red
        img.data[i] = hit ? 255 : cur[i] * 0.35; img.data[i + 1] = hit ? 40 : cur[i + 1] * 0.35; img.data[i + 2] = hit ? 40 : cur[i + 2] * 0.35; img.data[i + 3] = 255;
      }
      out.putImageData(img, 0, 0);
    }
    this.prev = null;
    const pct = (100 * changed / (this.W * this.H)).toFixed(1);
    const lines = Object.entries({ ...this.facts, ...extra }).map(([k, v]) => `${k}: ${v}`);
    lines.push(`changed pixels (consecutive frames): ${pct}%`);
    if (this.errors.length) lines.push('--- errors ---', ...this.errors);
    else lines.push('errors: none');
    this.text.textContent = lines.join('\n');
  }
}
