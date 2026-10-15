import * as THREE from 'three';

const W = 1280; // logical drawing units
const H = 720;
const RES = 0.8; // backing canvas is 1024x576
const MONO = '"JetBrains Mono", monospace';
const COMIC = '"Bangers", "Space Grotesk", sans-serif';
// royal, elegant and still easy to read: Cinzel (Roman capitals) + Cormorant Garamond (serif)
const ROYAL = '"Cinzel", Georgia, serif';
const SERIF = '"Cormorant Garamond", Georgia, serif';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function wrap(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Misprinted comic title: cyan + magenta plates offset under white.
function comicTitle(g, text, x, y, size, t, accent) {
  g.font = `${size}px ${COMIC}`;
  g.textBaseline = 'alphabetic';
  const j = 0; // static misprint offset (a moving one read as jitter)
  g.fillStyle = 'rgba(45,226,255,0.9)';
  g.fillText(text, x - 5 + j, y + 2);
  g.fillStyle = 'rgba(255,45,111,0.9)';
  g.fillText(text, x + 5 - j, y - 2);
  g.fillStyle = '#fff';
  g.fillText(text, x, y);
  g.lineWidth = 3;
  g.strokeStyle = accent;
  g.strokeText(text, x, y);
}

function drawSpiderMask(g, cx, cy, r, t, accent) {
  // head
  const grd = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  grd.addColorStop(0, '#ff3355');
  grd.addColorStop(1, '#8a0018');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, cy, r * 0.82, r, 0, 0, Math.PI * 2);
  g.fill();
  // webbing
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(10,0,4,0.75)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy + r * 0.05);
    g.lineTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4);
    g.stroke();
  }
  for (let k = 1; k < 7; k++) {
    g.beginPath();
    g.ellipse(cx, cy + r * 0.05, (r * 0.82 * k) / 6, (r * k) / 6, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  // eyes (blink every ~4s, stepped)
  const blink = (Math.floor(t * 12) % 48) < 2 ? 0.15 : 1;
  for (const s of [-1, 1]) {
    g.save();
    g.translate(cx + s * r * 0.34, cy - r * 0.08);
    g.rotate(s * 0.45);
    g.scale(1, blink);
    g.fillStyle = '#0a0a0a';
    g.beginPath();
    g.ellipse(0, 0, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f4f6ff';
    g.beginPath();
    g.ellipse(0, 0, r * 0.24, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // orbit rings
  g.save();
  g.translate(cx, cy);
  for (let i = 0; i < 3; i++) {
    g.rotate(t * (0.4 + i * 0.25) * (i % 2 ? -1 : 1));
    g.strokeStyle = i === 1 ? accent : 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.setLineDash([18 + i * 8, 14]);
    g.beginPath();
    g.arc(0, 0, r * (1.18 + i * 0.12), 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);
  g.restore();
}

export class Billboard {
  constructor(section, { width = 30, onTwos = true } = {}) {
    this.section = section;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W * RES;
    this.canvas.height = H * RES;
    this.g = this.canvas.getContext('2d', { willReadFrequently: true }); // CPU canvas: cheap texture uploads
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false; // re-uploaded often, skip mip generation
    this.texture.flipY = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.anisotropy = 4;
    this.static = this.buildStatic();
    this.focus = 0;
    this.focusT = 0; // when the camera last arrived (restarts the typewriter)
    this._wasFocus = 0;
    this.onTwos = onTwos;
    this.hover = 0;
    this._acc = 1;

    const h = (width * H) / W;
    this.width = width;
    this.height = h;
    this.group = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x14121c, metalness: 0.8, roughness: 0.35 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, h + 1.6, 1.2), frameMat);
    frame.position.z = -0.65;
    this.group.add(frame);

    this.screenMat = new THREE.MeshBasicMaterial({ map: this.texture, color: new THREE.Color(0.82, 0.82, 0.82) });
    // Texture uploads skip the (slow) Y-flip; flip the UVs instead.
    const screenGeo = new THREE.PlaneGeometry(width, h);
    const uv = screenGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.screen = new THREE.Mesh(screenGeo, this.screenMat);
    this.screen.userData.billboard = this;
    this.group.add(this.screen);

    // neon edge tubes in the section's accent color
    const accent = new THREE.Color(section.accent);
    this.neonMat = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(3) });
    const t = 0.22;
    const edges = [
      [width + 1.6, t, 0, h / 2 + 0.8],
      [width + 1.6, t, 0, -h / 2 - 0.8],
      [t, h + 1.6, width / 2 + 0.8, 0],
      [t, h + 1.6, -width / 2 - 0.8, 0],
    ];
    for (const [ew, eh, x, y] of edges) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, t), this.neonMat);
      m.position.set(x, y, 0.05);
      this.group.add(m);
    }
  }

  // Layers that never change are drawn once and blitted each frame.
  buildStatic() {
    const s = this.section;
    const mk = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return [c, c.getContext('2d', { willReadFrequently: true })];
    };
    const [bg, bgx] = mk(W, H);
    bgx.fillStyle = '#05030b';
    bgx.fillRect(0, 0, W, H);
    const grd = bgx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0a0614');
    grd.addColorStop(1, hexA(s.accent, 0.28));
    bgx.fillStyle = grd;
    bgx.fillRect(0, 0, W, H);
    // halftone field, oversized so it can drift diagonally
    const [dots, dx] = mk(W + 56, H + 56);
    dx.fillStyle = hexA(s.accent2, 0.12);
    for (let y = 0; y < H + 56; y += 28)
      for (let x = 0; x < W + 56; x += 28) {
        const r = 2 + 5 * Math.max(0, Math.sin((x + y) * 0.006));
        dx.beginPath();
        dx.arc(x, y, r, 0, Math.PI * 2);
        dx.fill();
      }
    const [scan, sx] = mk(W, H);
    sx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 4) sx.fillRect(0, y, W, 2);
    return { bg, dots, scan };
  }

  update(t, dt) {
    // Redraw "on twos" (12fps) while in focus, 4fps otherwise.
    if (this.focus && !this._wasFocus) {
      this.focusT = t;
      this._acc = 1; // redraw right away
    }
    this._wasFocus = this.focus;
    this._acc += dt;
    const step = this.focus || this.hover ? 1 / 12 : 1 / 4;
    const target = 0.82 + this.hover * 0.12;
    const c = this.screenMat.color.r + (target - this.screenMat.color.r) * Math.min(1, dt * 8);
    this.screenMat.color.setScalar(c);
    this.neonMat.color.set(this.section.accent).multiplyScalar(1.6 + this.hover * 1.2 + Math.sin(t * 3) * 0.25);
    if (this._acc < step) return;
    this._acc = 0;
    this.draw(t);
    this.texture.needsUpdate = true;
  }

  draw(t) {
    const g = this.g;
    const s = this.section;
    g.save();
    g.setTransform(RES, 0, 0, RES, 0, 0);

    g.drawImage(this.static.bg, 0, 0);
    const off = (t * 30) % 28;
    g.drawImage(this.static.dots, off - 28, off - 28);

    // synthwave grid floor
    g.strokeStyle = hexA(s.accent, 0.35);
    g.lineWidth = 1.5;
    const horizon = H - 180;
    for (let i = -12; i <= 12; i++) {
      g.beginPath();
      g.moveTo(W / 2 + i * 30, horizon);
      g.lineTo(W / 2 + i * 220, H);
      g.stroke();
    }
    for (let k = 0; k < 8; k++) {
      const yy = horizon + Math.pow(((k + (t * 0.8) % 1) / 8), 2) * 180;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(W, yy);
      g.stroke();
    }

    // header
    g.fillStyle = s.accent;
    g.fillRect(60, 50, 8, 120);
    g.font = `700 24px ${ROYAL}`;
    g.fillStyle = s.accent2;
    g.fillText(`${s.index} · ${s.kicker.toUpperCase()}`, 88, 74);
    comicTitle(g, s.title, 86, 166, 88, t, s.accent);

    // live indicator
    g.fillStyle = Math.floor(t * 2) % 2 ? '#ff2d3c' : 'rgba(255,45,60,0.3)';
    g.beginPath();
    g.arc(W - 160, 76, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `700 22px ${MONO}`;
    g.fillText('LIVE', W - 140, 84);

    if (s.id === 'about') this.drawAbout(g, t);
    else if (s.id === 'projects') this.drawProjects(g, t);
    else this.drawGoals(g, t);

    // ticker
    g.fillStyle = s.accent;
    g.fillRect(0, H - 64, W, 64);
    g.fillStyle = '#07030d';
    g.font = `34px ${COMIC}`;
    const text = s.ticker.repeat(6);
    const tw = g.measureText(s.ticker).width;
    g.fillText(text, -((t * 120) % tw), H - 20);

    // corner brackets
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    const b = 30;
    for (const [x, y, sx, sy] of [[20, 20, 1, 1], [W - 20, 20, -1, 1], [20, H - 84, 1, -1], [W - 20, H - 84, -1, -1]]) {
      g.beginPath();
      g.moveTo(x, y + sy * b);
      g.lineTo(x, y);
      g.lineTo(x + sx * b, y);
      g.stroke();
    }

    // scanlines
    g.drawImage(this.static.scan, 0, 0);

    // occasional glitch slices
    const gs = Math.floor(t * 8);
    if ((gs * 7919) % 23 === 0) {
      for (let i = 0; i < 5; i++) {
        const y = ((gs * (i + 3) * 131) % H) | 0;
        const hh = 8 + ((gs * (i + 1)) % 30);
        const dx = (((gs * (i + 5)) % 60) - 30) * 1.5;
        g.drawImage(this.canvas, 0, y * RES, W * RES, hh * RES, dx, y, W, hh);
      }
    }
    g.restore();
  }

  drawAbout(g, t) {
    const s = this.section;
    drawSpiderMask(g, 270, 380, 130, t, s.accent2);

    // Headline: laid out once from the full sentence so nothing reflows while it types.
    // It types out once when the camera arrives, then holds perfectly still.
    const full = s.headline;
    g.font = `700 38px ${ROYAL}`;
    const lines = wrap(g, full, 700);
    const shown = this.focus ? Math.min(full.length, Math.floor((t - this.focusT) * 26)) : full.length;
    g.fillStyle = '#fff';
    let left = shown;
    let endX = 480, endY = 240;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      const y = 240 + i * 52;
      g.fillText(part, 480, y);
      if (part.length) {
        endX = 480 + g.measureText(part).width;
        endY = y;
      }
    });
    // cursor sits after the last typed letter; it never affects the layout
    if (shown < full.length || Math.floor(t * 2) % 2) {
      g.fillStyle = s.accent;
      g.fillRect(endX + 6, endY - 30, 4, 36);
    }

    // facts (fixed position: based on the full headline's line count)
    let y = 240 + lines.length * 52 + 34;
    for (const f of s.facts) {
      g.font = `700 20px ${ROYAL}`;
      g.fillStyle = s.accent2;
      g.fillText(f.label.toUpperCase(), 480, y);
      g.font = `700 28px ${SERIF}`;
      g.fillStyle = '#fff';
      g.fillText(f.value, 760, y);
      y += 42;
    }
    // skill chips (one lights up at a time)
    y += 16;
    let x = 480;
    const active = Math.floor(t * 1.5) % s.skills.length;
    g.font = `700 25px ${SERIF}`;
    s.skills.forEach((sk, i) => {
      const w = g.measureText(sk).width + 34;
      if (x + w > W - 50) {
        x = 480;
        y += 52;
      }
      g.fillStyle = i === active ? s.accent : 'rgba(255,255,255,0.08)';
      g.strokeStyle = i === active ? '#fff' : hexA(s.accent2, 0.6);
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x, y - 30, w, 42, 21);
      g.fill();
      g.stroke();
      g.fillStyle = i === active ? '#07030d' : '#fff';
      g.fillText(sk, x + 17, y);
      x += w + 12;
    });
  }

  drawProjects(g, t) {
    const s = this.section;
    const items = s.items;
    const per = 4;
    const idx = Math.floor(t / per) % items.length;
    const local = (t % per) / per;
    const slideIn = ease(Math.min(1, local * 4));
    const slideOut = ease(Math.max(0, (local - 0.9) * 10));
    const p = items[idx];

    // thumbnail card
    const cx = 80 - (1 - slideIn) * 600 - slideOut * 700;
    const cy = 200;
    const cw = 620, ch = 380;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.025);
    const grd = g.createLinearGradient(0, 0, cw, ch);
    grd.addColorStop(0, s.accent);
    grd.addColorStop(1, s.accent2);
    g.fillStyle = '#000';
    g.fillRect(10, 12, cw, ch);
    g.fillStyle = grd;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = 0; yy < ch; yy += 16)
      for (let xx = (yy / 16) % 2 ? 8 : 0; xx < cw; xx += 16) {
        g.beginPath();
        g.arc(xx, yy, 2 + 5 * (xx / cw), 0, Math.PI * 2);
        g.fill();
      }
    g.font = `260px ${COMIC}`;
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillText(String(idx + 1).padStart(2, '0'), 40, 300);
    g.strokeStyle = '#000';
    g.lineWidth = 8;
    g.strokeRect(0, 0, cw, ch);
    g.font = `40px ${COMIC}`;
    g.fillStyle = '#fff';
    g.fillRect(cw - 210, ch - 70, 190, 52);
    g.fillStyle = '#000';
    g.fillText('CASE FILE', cw - 196, ch - 30);
    g.restore();

    // details
    const dx = 760 + (1 - slideIn) * 400 + slideOut * 500;
    g.globalAlpha = slideIn * (1 - slideOut);
    // project name, shrunk to fit on one line
    let size = 68;
    g.font = `${size}px ${COMIC}`;
    while (g.measureText(p.name.toUpperCase()).width > 460 && size > 40) g.font = `${(size -= 4)}px ${COMIC}`;
    g.fillStyle = '#fff';
    g.fillText(p.name.toUpperCase(), dx, 262);
    // status pill
    g.font = `700 21px ${ROYAL}`;
    const live = /progress/i.test(p.status);
    g.fillStyle = live ? (Math.floor(t * 2) % 2 ? s.accent : 'rgba(255,178,26,0.4)') : s.accent2;
    g.beginPath();
    g.arc(dx + 8, 292, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = s.accent;
    g.fillText(p.status.toUpperCase(), dx + 24, 300);
    // tech tags
    let tx = dx;
    g.font = `700 24px ${SERIF}`;
    for (const tag of p.tags) {
      const w = g.measureText(tag).width + 26;
      g.strokeStyle = s.accent2;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(tx, 318, w, 36, 18);
      g.stroke();
      g.fillStyle = '#fff';
      g.fillText(tag, tx + 13, 344);
      tx += w + 10;
    }
    g.font = `600 29px ${SERIF}`;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    wrap(g, p.blurb, 450).slice(0, 5).forEach((l, i) => g.fillText(l, dx, 402 + i * 35));
    g.globalAlpha = 1;

    // pager
    items.forEach((_, i) => {
      g.fillStyle = i === idx ? s.accent : 'rgba(255,255,255,0.25)';
      g.fillRect(760 + i * 54, 600, i === idx ? 44 : 22, 8);
    });
  }

  drawGoals(g, t) {
    const s = this.section;
    const cycle = 7;
    const local = (t % cycle) / cycle;
    const grow = ease(Math.min(1, local * 2.2));
    const x0 = 90, x1 = 860;
    s.items.forEach((it, i) => {
      const y = 245 + i * 112;
      g.font = `700 20px ${ROYAL}`;
      g.fillStyle = s.accent2;
      g.fillText(it.when.toUpperCase(), x0, y);
      g.font = `700 38px ${SERIF}`;
      g.fillStyle = '#fff';
      g.fillText(it.title || it.goal, x0, y + 42);
      // bar
      const by = y + 62;
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(x0, by, x1 - x0, 14);
      const fill = (x1 - x0) * it.progress * grow;
      const grd = g.createLinearGradient(x0, 0, x0 + fill, 0);
      grd.addColorStop(0, s.accent);
      grd.addColorStop(1, s.accent2);
      g.fillStyle = grd;
      g.fillRect(x0, by, fill, 14);
      g.fillStyle = '#fff';
      g.fillRect(x0 + fill - 3, by - 6, 6, 26);
    });

    // trajectory: a little spider-signal flying along an arc
    const ax = 1040, ay = 420, ar = 150;
    g.strokeStyle = hexA(s.accent2, 0.5);
    g.setLineDash([10, 10]);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(ax, ay, ar, Math.PI, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    const a = Math.PI + local * Math.PI;
    const px = ax + Math.cos(a) * ar, py = ay + Math.sin(a) * ar;
    g.fillStyle = s.accent;
    g.beginPath();
    g.arc(px, py, 14, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.stroke();
    g.font = `38px ${COMIC}`;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText('NEXT', ax, ay + 10);
    g.font = `italic 600 28px ${SERIF}`;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    wrap(g, `“${s.quote}”`, 300).forEach((l, i) => g.fillText(l, ax, ay + 70 + i * 30));
    g.textAlign = 'left';
  }
}
