import * as THREE from 'three';
import { FACADES, type FacadeItem } from './facades';

// Authored storefront looks, drawn by the game. Where the town has no photo of a
// business yet, its look (sign text as it reads, colours, awning, sign style) is
// drawn on a canvas tile and packed into the same atlas the photo facades use, so
// the decor lays it on the wall the same way. A photo of the same name wins.
export interface Look {
  name: string;
  sign: string; sub?: string;
  style: 'serif' | 'sans' | 'script' | 'moderne';
  wall: string;           // the storefront's own wall or frame colour
  panel: string;          // the sign band
  ink: string; ink2?: string;   // the lettering
  neon?: string;          // a neon script under the panel
  glass: string;
  awning?: string; stripes?: string;
  widthM: number;
  floors?: number | 'all';
  at?: [number, number];
}

const T_W = 512, T_H = 256;
function drawLook(g: CanvasRenderingContext2D, u: number, v: number, k: Look) {
  g.save(); g.translate(u, v);
  // the frame and the wall
  g.fillStyle = k.wall; g.fillRect(0, 0, T_W, T_H);
  const tall = k.floors === 'all';
  const signTop = tall ? 14 : 12, signH = tall ? 40 : 52;
  // display windows either side of the door, dark inside with a warm glow
  const winTop = signTop + signH + (k.awning ? 34 : 12);
  const winH = T_H - winTop - 14;
  const doorW = 62, doorX = T_W / 2 - doorW / 2;
  for (const [x0, x1] of [[18, doorX - 12], [doorX + doorW + 12, T_W - 18]]) {
    g.fillStyle = '#d9d2c2'; g.fillRect(x0 - 4, winTop - 4, x1 - x0 + 8, winH + 8);
    g.fillStyle = k.glass; g.fillRect(x0, winTop, x1 - x0, winH);
    const gl = g.createLinearGradient(0, winTop, 0, winTop + winH);
    gl.addColorStop(0, 'rgba(255,224,160,0.05)'); gl.addColorStop(1, 'rgba(255,224,160,0.28)');
    g.fillStyle = gl; g.fillRect(x0, winTop, x1 - x0, winH);
    // a reflection stripe, and a shelf line: it reads as glass, not a hole
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x0 + 8, winTop + 6, 14, winH - 12);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x0, winTop + winH * 0.62, x1 - x0, 3);
  }
  // the door: wood or painted, a glass panel, a handle
  g.fillStyle = k.style === 'moderne' ? '#2a2a2a' : '#4a3323'; g.fillRect(doorX, winTop - 2, doorW, T_H - winTop + 2);
  g.fillStyle = k.glass; g.fillRect(doorX + 10, winTop + 8, doorW - 20, winH * 0.55);
  g.fillStyle = '#c9b07a'; g.fillRect(doorX + doorW - 16, winTop + winH * 0.55, 5, 5);
  // the awning, if it has one: scalloped, striped or plain
  if (k.awning) {
    const top = signTop + signH + 4;
    g.fillStyle = k.awning; g.fillRect(8, top, T_W - 16, 26);
    if (k.stripes) { g.fillStyle = k.stripes; for (let x = 8; x < T_W - 8; x += 40) g.fillRect(x + 20, top, 20, 26); }
    g.fillStyle = k.awning; for (let x = 8; x < T_W - 8; x += 24) { g.beginPath(); g.arc(x + 12, top + 26, 12, 0, Math.PI); g.fill(); }
    if (k.stripes) { g.fillStyle = k.stripes; for (let x = 28; x < T_W - 8; x += 48) { g.beginPath(); g.arc(x + 12, top + 26, 12, 0, Math.PI); g.fill(); } }
  }
  // the sign band, and the name the way it reads on the street
  g.fillStyle = k.panel; g.fillRect(8, signTop, T_W - 16, signH);
  if (k.style === 'moderne') {
    // Art Moderne: an ivory enamel panel with incised capitals, a black glass base line
    g.fillStyle = '#0d0d0f'; g.fillRect(8, signTop + signH - 6, T_W - 16, 6);
    g.fillStyle = '#0d0d0f'; g.fillRect(0, T_H - 14, T_W, 14);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fontFor = (px: number) => k.style === 'serif' ? `700 ${px}px Georgia, "Times New Roman", serif`
    : k.style === 'script' ? `italic 700 ${px}px Georgia, "Brush Script MT", cursive`
    : k.style === 'moderne' ? `700 ${px}px "Trebuchet MS", "Gill Sans", sans-serif`
    : `800 ${px}px "Helvetica Neue", Arial, sans-serif`;
  let px = k.sub ? 34 : 40;
  g.font = fontFor(px);
  while (g.measureText(k.sign).width > T_W - 60 && px > 16) { px -= 2; g.font = fontFor(px); }
  const cy = signTop + (k.sub ? signH * 0.4 : signH * 0.5);
  if (k.style === 'moderne') { g.letterSpacing = '6px'; }
  g.fillStyle = k.ink; g.fillText(k.sign, T_W / 2, cy);
  if (k.ink2) { g.fillStyle = k.ink2; g.fillText(k.sign.slice(0, Math.ceil(k.sign.length / 2)), T_W / 2 - g.measureText(k.sign.slice(Math.ceil(k.sign.length / 2))).width / 2, cy); }
  if (k.sub) { g.letterSpacing = '3px'; g.font = `700 14px "Helvetica Neue", Arial, sans-serif`; g.fillStyle = k.ink; g.fillText(k.sub, T_W / 2, signTop + signH * 0.78); }
  g.letterSpacing = '0px';
  if (k.neon) {
    // the neon script, glowing, hung across the top of the windows
    g.font = `italic 700 30px Georgia, "Brush Script MT", cursive`;
    g.shadowColor = k.neon; g.shadowBlur = 14; g.fillStyle = k.neon;
    g.fillText(k.sign.charAt(0) + k.sign.slice(1).toLowerCase(), T_W / 2, winTop - 14);
    g.shadowBlur = 0;
  }
  g.restore();
}

/** draw every look without a photo into the atlas (or a fresh one), and register them */
export function bakeLooks(looks: Look[]) {
  const have = new Set(FACADES.items.map((i) => i.name.trim().toLowerCase()));
  const todo = looks.filter((k) => !have.has(k.name.trim().toLowerCase()));
  if (!todo.length) return;
  const cols = 4, rows = Math.ceil(todo.length / cols);
  const c = document.createElement('canvas');
  // grow the existing atlas downward, or start one
  const base = FACADES.tex ? (FACADES.tex.image as HTMLImageElement | HTMLCanvasElement) : null;
  const baseH = base ? FACADES.size : 0;
  const W = Math.max(cols * T_W, base ? FACADES.size : 0);
  c.width = W; c.height = baseH + rows * T_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  if (base) g.drawImage(base, 0, 0);
  const items: FacadeItem[] = [];
  todo.forEach((k, i) => {
    const u = (i % cols) * T_W, v = baseH + Math.floor(i / cols) * T_H;
    drawLook(g, u, v, k);
    items.push({ name: k.name, u, v, w: T_W, h: T_H, widthM: k.widthM, floors: k.floors ?? 1, at: k.at });
  });
  // the atlas is addressed as a square of `size`; a tall canvas means u and v scale differently,
  // so pad to square for one scale
  if (c.height !== c.width) {
    const sq = Math.max(c.width, c.height);
    const s = document.createElement('canvas'); s.width = s.height = sq;
    const sg = s.getContext('2d')!; sg.fillStyle = '#000'; sg.fillRect(0, 0, sq, sq); sg.drawImage(c, 0, 0);
    FACADES.size = sq;
    const tex = new THREE.CanvasTexture(s);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
    FACADES.tex = tex;
  } else {
    FACADES.size = c.width;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
    FACADES.tex = tex;
  }
  FACADES.items = FACADES.items.concat(items);
}
