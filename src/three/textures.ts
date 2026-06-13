import * as THREE from 'three';
import { mulberry32 } from '../world/style';

// Procedural material textures. Scale convention: 1 texture repeat = 16 world px = 2 m,
// drawn at 128px per repeat (64 px/m). "Neutral" textures are near-white and get
// tinted by vertex colors; brick and plank carry their own color.

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// horizontal clapboard courses (~25 cm each), neutral
export function clapboardTex(): THREE.CanvasTexture {
  return canvasTex((g, s) => {
    g.fillStyle = 'rgb(247,247,244)';
    g.fillRect(0, 0, s, s);
    const rng = mulberry32(11);
    const course = 16; // 0.25 m
    for (let y = 0; y < s; y += course) {
      // shadow line under each board
      g.fillStyle = 'rgba(120,120,115,0.55)';
      g.fillRect(0, y + course - 2, s, 2);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(0, y, s, 1.5);
      // subtle per-board tone
      g.fillStyle = `rgba(190,190,182,${0.06 + rng() * 0.08})`;
      g.fillRect(0, y, s, course - 2);
    }
    for (let i = 0; i < 130; i++) {
      g.fillStyle = `rgba(140,140,130,${0.04 + rng() * 0.05})`;
      g.fillRect(rng() * s, rng() * s, 1.5, 1.5);
    }
  });
}

// asphalt shingle tabs, neutral mid-bright (tinted by roof color)
export function shingleTex(): THREE.CanvasTexture {
  return canvasTex((g, s) => {
    g.fillStyle = 'rgb(238,236,232)';
    g.fillRect(0, 0, s, s);
    const rng = mulberry32(23);
    const rowH = 18, tabW = 26;
    let row = 0;
    for (let y = 0; y < s + rowH; y += rowH, row++) {
      const off = row % 2 === 0 ? 0 : tabW / 2;
      for (let x = -tabW; x < s + tabW; x += tabW) {
        g.fillStyle = `rgba(150,148,142,${0.10 + rng() * 0.22})`;
        g.fillRect(x + off, y, tabW - 1.5, rowH - 1.5);
      }
      g.fillStyle = 'rgba(70,68,64,0.5)';
      g.fillRect(0, y + rowH - 2, s, 2);
    }
  });
}

// real red brick with mortar (colored — vertex color stays near-white)
export function brickTex(): THREE.CanvasTexture {
  return canvasTex((g, s) => {
    g.fillStyle = 'rgb(196,186,176)'; // mortar
    g.fillRect(0, 0, s, s);
    const rng = mulberry32(37);
    const rowH = 8, brickW = 22, gap = 2;
    let row = 0;
    for (let y = 0; y < s; y += rowH, row++) {
      const off = row % 2 === 0 ? 0 : brickW / 2;
      for (let x = -brickW; x < s + brickW; x += brickW) {
        const r = 148 + rng() * 36, gg = 70 + rng() * 22, b = 52 + rng() * 18;
        g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        g.fillRect(x + off + gap / 2, y + gap / 2, brickW - gap, rowH - gap);
      }
    }
  });
}

// neutral micro-detail grain, tiled over ALL ground in the shader so surfaces
// keep visible texture up close (mean luminance ~0.5 so it's brightness-neutral)
export function detailTex(): THREE.CanvasTexture {
  return canvasTex((g, s) => {
    g.fillStyle = 'rgb(128,128,128)';
    g.fillRect(0, 0, s, s);
    const rng = mulberry32(71);
    // mid-frequency blotches
    for (let i = 0; i < 60; i++) {
      const v = 116 + rng() * 24;
      g.fillStyle = `rgba(${v},${v},${v},0.5)`;
      const r = 6 + rng() * 18;
      g.beginPath();
      g.arc(rng() * s, rng() * s, r, 0, Math.PI * 2);
      g.fill();
    }
    // fine speckle
    for (let i = 0; i < 2400; i++) {
      const v = 96 + rng() * 64;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rng() * s, rng() * s, 1.4, 1.4);
    }
    // hairline scratches
    g.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const v = 108 + rng() * 36;
      g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
      const x = rng() * s, y = rng() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 26, y + (rng() - 0.5) * 26);
      g.stroke();
    }
  });
}

// weathered deck planks (colored)
export function plankTex(): THREE.CanvasTexture {
  return canvasTex((g, s) => {
    g.fillStyle = 'rgb(172,138,92)';
    g.fillRect(0, 0, s, s);
    const rng = mulberry32(53);
    const plank = 16;
    for (let y = 0; y < s; y += plank) {
      g.fillStyle = `rgba(108,82,50,${0.25 + rng() * 0.2})`;
      g.fillRect(0, y + plank - 1.5, s, 1.5);
      g.fillStyle = `rgba(${150 + rng() * 40 | 0},${120 + rng() * 30 | 0},${80 + rng() * 20 | 0},0.35)`;
      g.fillRect(0, y, s, plank - 1.5);
      // grain
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = 'rgba(110,85,52,0.3)';
        g.lineWidth = 1;
        const gy = y + 2 + rng() * (plank - 4);
        g.beginPath();
        g.moveTo(rng() * s * 0.5, gy);
        g.lineTo(rng() * s * 0.5 + s * 0.5, gy + (rng() - 0.5) * 2);
        g.stroke();
      }
    }
  });
}
