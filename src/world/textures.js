import * as THREE from 'three';
import { rng } from '../core/util.js';

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

const toTex = (c, { repeat = false, srgb = true, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
};

// 3-step ramp for cel shading.
export function toonGradient() {
  const data = new Uint8Array([60, 60, 60, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// Suit fabric with black webbing (grid that becomes a radial web on a sphere).
export function webTexture(base = '#c8102e', line = '#1a0006', cols = 16, rows = 12) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  // subtle fabric hex texture
  g.globalAlpha = 0.08;
  g.fillStyle = '#000';
  for (let y = 0; y < 512; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 512; x += 6) g.fillRect(x, y, 2, 2);
  g.globalAlpha = 1;
  g.strokeStyle = line;
  g.lineWidth = 3;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * 512;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke();
  }
  // sagging horizontal strands between the radial lines
  for (let j = 1; j <= rows; j++) {
    const y = (j / rows) * 512;
    g.beginPath();
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * 512, x1 = ((i + 1) / cols) * 512;
      g.moveTo(x0, y);
      g.quadraticCurveTo((x0 + x1) / 2, y - 8, x1, y);
    }
    g.stroke();
  }
  return toTex(c, { repeat: true });
}

export function spiderEmblem(color = '#0a0a0a') {
  const [c, g] = canvas(256, 256);
  g.translate(128, 128);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 9;
  const legs = [
    [[-20, -20], [-60, -70], [-70, -110]],
    [[-22, -6], [-80, -30], [-100, -60]],
    [[-22, 10], [-80, 40], [-100, 80]],
    [[-18, 24], [-55, 80], [-60, 120]],
  ];
  for (const s of [1, -1]) {
    for (const leg of legs) {
      g.beginPath();
      g.moveTo(leg[0][0] * s, leg[0][1]);
      g.lineTo(leg[1][0] * s, leg[1][1]);
      g.lineTo(leg[2][0] * s, leg[2][1]);
      g.stroke();
    }
  }
  g.beginPath(); g.ellipse(0, -22, 18, 22, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(0, 28, 22, 40, 0, 0, Math.PI * 2); g.fill();
  return toTex(c);
}

// Facade: grid of windows, some lit warm / neon-cool, some dark.
export function windowTexture(seed, { cols = 12, rows = 22, tint = 'mixed' } = {}) {
  const r = rng(seed);
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#06060b';
  g.fillRect(0, 0, 256, 512);
  const cw = 256 / cols, rh = 512 / rows;
  const warm = ['#e8b878', '#d99a55', '#f2d6a8', '#c98d4e'];
  const cool = ['#7fc8e8', '#6a96d8', '#b8d8ee', '#9a7ad8', '#d873b0'];
  for (let y = 0; y < rows; y++) {
    // whole floors tend to be lit together (offices)
    const floorLit = r() < 0.22;
    const floorPal = tint === 'warm' ? warm : tint === 'cool' ? cool : r() < 0.6 ? warm : cool;
    for (let x = 0; x < cols; x++) {
      const lit = floorLit ? r() < 0.8 : r() < 0.1;
      const x0 = x * cw + cw * 0.14, y0 = y * rh + rh * 0.18, w = cw * 0.72, h = rh * 0.62;
      if (lit) {
        g.fillStyle = floorPal[(r() * floorPal.length) | 0];
        g.globalAlpha = 0.3 + r() * 0.5;
        g.fillRect(x0, y0, w, h);
        // half-drawn curtains on some windows
        if (r() < 0.3) {
          g.globalAlpha = 0.7;
          g.fillStyle = '#0d0b14';
          g.fillRect(x0, y0, w, h * (0.3 + r() * 0.4));
        }
      } else {
        g.fillStyle = '#141624';
        g.globalAlpha = 1;
        g.fillRect(x0, y0, w, h);
      }
    }
  }
  // vertical mullions
  g.globalAlpha = 0.6;
  g.fillStyle = '#05050a';
  for (let x = 0; x < cols; x += 3) g.fillRect(x * cw - 1, 0, 3, 512);
  g.globalAlpha = 1;
  const t = toTex(c, { repeat: true });
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Neon sign with glowing tube look. Horizontal or vertical (stacked glyphs).
export function neonSign(text, color, { vertical = false, bg = 'rgba(8,6,18,0.85)', font = 'Bangers' } = {}) {
  const glyphs = vertical ? [...text] : [text];
  const size = 120;
  const w = vertical ? 180 : Math.max(256, text.length * size * 0.62 + 80);
  const h = vertical ? glyphs.length * size * 1.05 + 60 : 200;
  const [c, g] = canvas(Math.ceil(w), Math.ceil(h));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.font = `${size}px "${font}", "Noto Sans JP", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const draw = (str, x, y) => {
    g.shadowBlur = 30;
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.75;
    g.fillText(str, x, y);
    g.globalAlpha = 1;
  };
  if (vertical) glyphs.forEach((ch, i) => draw(ch, w / 2, 30 + size * 0.55 + i * size * 1.05));
  else draw(text, w / 2, h / 2 + 6);
  const t = toTex(c);
  return { texture: t, aspect: w / h };
}

export function glowTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTex(c, { srgb: false });
}

// Vertical streak used for fake wet-road light reflections.
export function streakTexture() {
  const [c, g] = canvas(64, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const mask = g.getImageData(0, 0, 64, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 64; x++) {
      const k = 1 - Math.abs(x - 32) / 32;
      mask.data[(y * 64 + x) * 4 + 3] *= k * k;
    }
  g.putImageData(mask, 0, 0);
  return toTex(c, { srgb: false });
}

// Top-down map of the street grid: asphalt, sidewalks, lane lines and
// scramble crossings. Alpha channel = wetness (how mirror-like).
export function streetMap({ extent, pitch, road, blocks }) {
  const px = 2048;
  const s = px / extent; // pixels per world unit
  const [c, g] = canvas(px, px);
  const W = (x) => (x + extent / 2) * s;
  g.fillStyle = 'rgb(18,18,26)';
  g.fillRect(0, 0, px, px);
  // sidewalks around blocks
  for (const b of blocks) {
    g.fillStyle = 'rgb(46,46,58)';
    const half = (pitch - road) / 2;
    g.fillRect(W(b.x - half), W(b.z - half), half * 2 * s, half * 2 * s);
    g.fillStyle = 'rgb(34,34,44)';
    g.fillRect(W(b.x - half + 2), W(b.z - half + 2), (half * 2 - 4) * s, (half * 2 - 4) * s);
  }
  // lane dashes
  g.strokeStyle = 'rgba(230,220,180,0.75)';
  g.lineWidth = 0.35 * s;
  g.setLineDash([3 * s, 3 * s]);
  const n = Math.round(extent / pitch);
  for (let i = -n; i <= n; i++) {
    const p = (i + 0.5) * pitch;
    g.beginPath(); g.moveTo(W(p), 0); g.lineTo(W(p), px); g.stroke();
    g.beginPath(); g.moveTo(0, W(p)); g.lineTo(px, W(p)); g.stroke();
  }
  g.setLineDash([]);
  // zebra / scramble crossings at intersections
  g.fillStyle = 'rgba(235,235,240,0.8)';
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const cx = (i + 0.5) * pitch, cz = (j + 0.5) * pitch;
      const hr = road / 2;
      for (let k = -hr + 0.8; k < hr - 0.5; k += 1.4) {
        g.fillRect(W(cx + k), W(cz - hr - 2.6), 0.7 * s, 2.2 * s);
        g.fillRect(W(cx + k), W(cz + hr + 0.4), 0.7 * s, 2.2 * s);
        g.fillRect(W(cx - hr - 2.6), W(cz + k), 2.2 * s, 0.7 * s);
        g.fillRect(W(cx + hr + 0.4), W(cz + k), 2.2 * s, 0.7 * s);
      }
      if (Math.abs(i) <= 1 && Math.abs(j) <= 2) {
        // Shibuya-style diagonal scramble stripes
        g.save();
        g.translate(W(cx), W(cz));
        for (const ang of [Math.PI / 4, -Math.PI / 4]) {
          g.save();
          g.rotate(ang);
          for (let k = -hr * 1.2; k < hr * 1.2; k += 1.4) g.fillRect(-0.9 * s, k * s, 1.8 * s, 0.7 * s);
          g.restore();
        }
        g.restore();
      }
    }
  // wetness → alpha: roads very wet, sidewalks less
  const img = g.getImageData(0, 0, px, px);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    d[i + 3] = l < 25 ? 255 : l < 40 ? 150 : l > 150 ? 90 : 190;
  }
  g.putImageData(img, 0, 0);
  const t = toTex(c);
  t.premultiplyAlpha = false;
  return t;
}
