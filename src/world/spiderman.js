import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Miles Morales in his Across the Spider-Verse suit, built procedurally:
//  • sculpted, tapered limbs and a V-shaped torso (lathe profiles, not capsules)
//  • black suit with thin red webbing, the big red spider emblem, red spray specks
//  • large angular white lenses with thick black frames, conformed to the mask
//  • web-shooter cuffs and red / white / black high-top sneakers
// Cel-shaded with a hard comic rim light and normal-extruded ink outlines.
// Joints are plain Object3Ds, so poses are sets of Euler rotations we blend.

const JOINTS = ['hips', 'spine', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'];

// Rotations are [x, y, z]. Character faces +Z, left side is +X.
// Arm: shoulder.z>0 raises left arm sideways, shoulder.x<0 raises arm forward.
// Leg: hip.x<0 swings thigh forward, knee.x>0 bends shin back.
export const POSES = {
  idle: {
    hipsY: 0,
    spine: [0.05, 0, 0], head: [0, 0, 0],
    lShoulder: [0, 0, 0.18], lElbow: [-0.2, 0, 0],
    rShoulder: [0, 0, -0.18], rElbow: [-0.2, 0, 0],
    lHip: [0, 0, 0.05], lKnee: [0.05, 0, 0],
    rHip: [0, 0, -0.05], rKnee: [0.05, 0, 0],
  },
  swing: {
    hipsY: 0,
    spine: [0.15, 0, 0.1], head: [-0.25, 0, 0],
    rShoulder: [-2.85, 0, -0.25], rElbow: [-0.15, 0, 0],
    lShoulder: [0.5, 0, 1.0], lElbow: [-1.1, 0, 0],
    lHip: [-1.3, 0, 0.15], lKnee: [1.9, 0, 0],
    rHip: [-0.35, 0, -0.1], rKnee: [1.0, 0, 0],
  },
  dive: {
    hipsY: 0,
    spine: [-0.25, 0, 0], head: [-0.6, 0, 0],
    lShoulder: [-0.4, 0, 1.45], lElbow: [-0.35, 0, 0],
    rShoulder: [-0.4, 0, -1.45], rElbow: [-0.35, 0, 0],
    lHip: [0.15, 0, 0.35], lKnee: [0.7, 0, 0],
    rHip: [0.25, 0, -0.35], rKnee: [0.4, 0, 0],
  },
  tuck: {
    hipsY: 0,
    spine: [0.7, 0, 0], head: [0.3, 0, 0],
    lShoulder: [-0.9, 0, 0.4], lElbow: [-1.6, 0, 0],
    rShoulder: [-0.9, 0, -0.4], rElbow: [-1.6, 0, 0],
    lHip: [-2.0, 0, 0.2], lKnee: [2.4, 0, 0],
    rHip: [-2.0, 0, -0.2], rKnee: [2.4, 0, 0],
  },
  // The superhero landing: one knee down, fist on the ground.
  land: {
    hipsY: -0.5,
    spine: [0.75, 0, 0.05], head: [-0.75, 0, 0],
    rShoulder: [-0.55, 0, -0.15], rElbow: [-0.15, 0, 0],
    lShoulder: [0.9, 0, 0.75], lElbow: [-0.5, 0, 0],
    rHip: [-1.6, 0, -0.15], rKnee: [1.75, 0, 0],
    lHip: [-0.15, 0, 0.2], lKnee: [2.2, 0, 0],
  },
  // Classic gargoyle crouch on a ledge.
  perch: {
    hipsY: -0.55,
    spine: [0.55, 0, 0], head: [-0.45, 0, 0],
    lShoulder: [-0.7, 0, 0.2], lElbow: [-1.0, 0, 0],
    rShoulder: [-0.7, 0, -0.2], rElbow: [-1.0, 0, 0],
    lHip: [-2.05, 0, 0.45], lKnee: [2.45, 0, 0],
    rHip: [-2.05, 0, -0.45], rKnee: [2.45, 0, 0],
  },
};

// ── Suit textures ───────────────────────────────────────────────

const SUIT_BLACK = '#15151c';
const WEB_RED = '#e3202c';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatU = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeatU) t.wrapS = THREE.RepeatWrapping;
  return t;
}

// fabric grain + a few red spray-paint specks (Miles sprayed his first suit)
function fabric(g, w, h, specks = 0) {
  g.fillStyle = SUIT_BLACK;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < h; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) g.fillRect(x, y, 1.5, 1.5);
  for (let i = 0; i < specks; i++) {
    g.fillStyle = `rgba(227,32,44,${0.15 + Math.random() * 0.35})`;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, Math.random() * 2.2 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
}

// Webbing for limbs / head: lines along the length + sagging cross-strands.
function limbTexture({ cols = 7, rows = 6, specks = 40, line = 1.7 } = {}) {
  const [c, g] = canvas(512, 512);
  fabric(g, 512, 512, specks);
  g.strokeStyle = WEB_RED;
  g.lineWidth = line;
  g.lineCap = 'round';
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * 512;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = (j / rows) * 512;
    g.beginPath();
    for (let i = 0; i < cols; i++) {
      const x0 = (i / cols) * 512, x1 = ((i + 1) / cols) * 512;
      g.moveTo(x0, y);
      g.quadraticCurveTo((x0 + x1) / 2, y + 16, x1, y);
    }
    g.stroke();
  }
  return tex(c, true);
}

// Draw a radial spider-web centred at (cx, cy).
function radialWeb(g, cx, cy, spokes, rings, maxR) {
  const angles = Array.from({ length: spokes }, (_, i) => (i / spokes) * Math.PI * 2 + 0.12);
  g.beginPath();
  for (const a of angles) {
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
  }
  g.stroke();
  for (const r of rings) {
    g.beginPath();
    angles.forEach((a, i) => {
      const b = angles[(i + 1) % spokes] + (i === spokes - 1 ? Math.PI * 2 : 0);
      const m = (a + b) / 2;
      const sag = r * 0.82;
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.quadraticCurveTo(cx + Math.cos(m) * sag, cy + Math.sin(m) * sag, cx + Math.cos(b) * r, cy + Math.sin(b) * r);
    });
    g.stroke();
  }
}

// Miles' emblem: a big red spider whose long legs reach toward the shoulders and hips.
function milesEmblem(g, cx, cy, s) {
  const legs = [
    // [hip, knee, tip] relative to body centre, for the +x side
    [[18, -26], [70, -92], [118, -118]],
    [[22, -12], [96, -40], [150, -30]],
    [[22, 10], [92, 44], [132, 98]],
    [[16, 26], [60, 96], [74, 160]],
  ];
  const draw = (color, width) => {
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = width * s;
    g.lineJoin = 'miter';
    g.lineCap = 'round';
    for (const side of [1, -1]) {
      for (const [a, b, c] of legs) {
        g.beginPath();
        g.moveTo(cx + a[0] * side * s, cy + a[1] * s);
        g.lineTo(cx + b[0] * side * s, cy + b[1] * s);
        g.lineTo(cx + c[0] * side * s, cy + c[1] * s);
        g.stroke();
      }
    }
    // head + thorax + long tapered abdomen
    g.beginPath();
    g.ellipse(cx, cy - 34 * s, 13 * s, 15 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy - 4 * s, 20 * s, 24 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 17 * s, cy + 14 * s);
    g.quadraticCurveTo(cx - 22 * s, cy + 60 * s, cx, cy + 92 * s);
    g.quadraticCurveTo(cx + 22 * s, cy + 60 * s, cx + 17 * s, cy + 14 * s);
    g.fill();
  };
  draw('#07070a', 15 + 6); // ink outline
  draw(WEB_RED, 13);
}

function torsoTexture() {
  const W = 1024, H = 512;
  const [c, g] = canvas(W, H);
  fabric(g, W, H, 140);
  g.strokeStyle = WEB_RED;
  g.lineWidth = 2.0;
  g.lineCap = 'round';
  const cy = 150; // web centre sits on the sternum
  const rings = [56, 124, 204, 296, 400, 520];
  radialWeb(g, W / 2, cy, 14, rings, 620);
  // matching web on the back, split across the seam so it wraps cleanly
  radialWeb(g, 0, cy + 10, 14, rings, 620);
  radialWeb(g, W, cy + 10, 14, rings, 620);
  milesEmblem(g, W / 2, cy + 40, 1.0);
  return tex(c, true);
}

function headTexture() {
  // the mask's UV pole points forward, so straight lines become a radial web on the face
  return limbTexture({ cols: 14, rows: 7, specks: 10, line: 1.8 });
}

// Lenses: thick black frame + bright white lens, drawn as one alpha-tested decal.
function eyeTexture() {
  const [c, g] = canvas(256, 208);
  const shape = (k) => {
    // left eye in decal space (0..256 x 0..208), outer corner on the right
    const cx = 128, cy = 112;
    const P = (x, y) => [cx + (x - cx) * k, cy + (y - cy) * k];
    g.beginPath();
    g.moveTo(...P(30, 118));
    g.bezierCurveTo(...P(26, 70), ...P(60, 52), ...P(110, 50));
    g.quadraticCurveTo(...P(196, 36), ...P(248, 52));
    g.quadraticCurveTo(...P(238, 116), ...P(198, 150));
    g.bezierCurveTo(...P(150, 182), ...P(76, 178), ...P(30, 118));
    g.closePath();
  };
  g.fillStyle = '#050507';
  shape(1.0);
  g.fill();
  g.fillStyle = '#ffffff';
  shape(0.74);
  g.fill();
  // faint lens tint at the bottom edge
  const grd = g.createLinearGradient(0, 70, 0, 170);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(1, 'rgba(150,190,255,0.35)');
  g.fillStyle = grd;
  shape(0.74);
  g.fill();
  return tex(c);
}

// ── Geometry helpers ─────────────────────────────────────────────

// Smooth limb from a radius profile [[y, r], …] (y ascending), seam at the back.
function lathe(profile, segs = 22, steps = 16) {
  const curve = new THREE.SplineCurve(profile.map(([y, r]) => new THREE.Vector2(r, y)));
  const pts = curve.getSpacedPoints(steps);
  pts.unshift(new THREE.Vector2(0.0005, pts[0].y));
  pts.push(new THREE.Vector2(0.0005, pts[pts.length - 1].y));
  return new THREE.LatheGeometry(pts, segs, Math.PI, Math.PI * 2);
}

// Patch of a sphere (radius r) covering [x0..x1]×[y0..y1] in front view — for decals.
function spherePatch(r, x0, x1, y0, y1, mirror = false) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 24, 20);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), 0);
    v.z = Math.sqrt(Math.max(r * r - v.x * v.x - v.y * v.y, 0));
    v.normalize().multiplyScalar(r * 1.012);
    p.setXYZ(i, mirror ? -v.x : v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class SpiderMan {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'spiderman';
    this.root.userData.noReflect = true; // on a rooftop — never visible in the street reflection
    this.j = {};
    this.pose = {};
    this._stepClock = 0;
    this.onTwos = true;

    // 4-step ramp for cel shading
    const ramp = new THREE.DataTexture(new Uint8Array([45, 45, 45, 255, 105, 105, 105, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;

    // shared comic rim light (re-coloured per scene)
    this.rim = { uRim: { value: new THREE.Color(0.35, 0.6, 1.0) }, uRimStrength: { value: 0.35 } };
    const rim = this.rim;
    const toon = (params) => {
      const m = new THREE.MeshToonMaterial({ gradientMap: ramp, ...params });
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, rim);
        sh.fragmentShader =
          'uniform vec3 uRim;\nuniform float uRimStrength;\n' +
          sh.fragmentShader.replace(
            '#include <opaque_fragment>',
            `float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            outgoingLight += uRim * smoothstep(0.66, 0.74, rimF) * uRimStrength;
            #include <opaque_fragment>`
          );
      };
      return m;
    };

    // the red webbing glows faintly (emissive = the suit texture), so it reads in the dark like the film
    const suit = (map) => toon({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.45 });
    const limbTex = limbTexture();
    const mats = {
      torso: suit(torsoTexture()),
      limb: suit(limbTex),
      head: suit(headTexture()),
      glove: suit(limbTexture({ cols: 6, rows: 5, specks: 0, line: 2.8 })),
      cuff: toon({ color: 0x3a3d48 }),
      red: toon({ color: 0xc8102e }),
      white: toon({ color: 0xeeeef2 }),
      black: toon({ color: 0x141418 }),
    };
    this.materials = mats;

    // Ink outline: back faces pushed out along their normals.
    const ink = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uThickness: { value: 0.0065 } },
      vertexShader: /* glsl */ `
        uniform float uThickness;
        void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uThickness, 1.0); }`,
      fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.02, 0.01, 0.03, 1.0); }`,
    });

    const part = (geo, mat, parent, pos = [0, 0, 0], scale = null, outline = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      if (scale) m.scale.set(...scale);
      parent.add(m);
      if (outline) m.add(new THREE.Mesh(geo, ink));
      return m;
    };
    const joint = (name, parent, pos) => {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(...pos);
      parent.add(o);
      this.j[name] = o;
      return o;
    };

    // ── Pelvis & torso ──
    const hips = joint('hips', this.root, [0, 0.98, 0]);
    part(lathe([[-0.11, 0.05], [-0.07, 0.115], [0.0, 0.132], [0.08, 0.122], [0.13, 0.11]]), mats.limb, hips, [0, 0, 0], [1.24, 1, 0.76]);

    const spine = joint('spine', hips, [0, 0.06, 0]);
    // V-taper: narrow waist, broad ribcage and chest, sloping into the traps
    part(
      lathe([[-0.04, 0.122], [0.06, 0.124], [0.16, 0.14], [0.27, 0.162], [0.36, 0.172], [0.44, 0.166], [0.5, 0.14], [0.545, 0.085]], 32),
      mats.torso, spine, [0, 0, 0], [1.3, 1, 0.8]
    );
    // trapezius slope
    part(new THREE.SphereGeometry(0.1, 20, 14), mats.limb, spine, [0, 0.5, -0.02], [1.55, 0.55, 0.85]);

    // neck + head
    part(lathe([[0.48, 0.066], [0.55, 0.058], [0.6, 0.06]], 20, 8), mats.limb, spine, [0, 0, 0], [1, 1, 0.95]);
    const head = joint('head', spine, [0, 0.575, 0.008]);
    const headGeo = new THREE.SphereGeometry(0.105, 32, 24);
    headGeo.rotateX(Math.PI / 2); // UV pole faces forward → radial web on the face
    const skull = part(headGeo, mats.head, head, [0, 0.105, 0.012], [0.93, 1.14, 1.04]);
    // jaw / chin volume so the mask isn't a ball
    part(new THREE.SphereGeometry(0.07, 24, 18), mats.head, head, [0, 0.045, 0.034], [1.05, 0.9, 1.0], false);
    // lenses conformed to the mask surface
    const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTexture(), alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0.74, 0.75, 0.78) });
    for (const mirror of [false, true]) {
      const eye = new THREE.Mesh(spherePatch(0.105, 0.004, 0.098, -0.03, 0.05, mirror), eyeMat);
      eye.position.y = 0.016;
      skull.add(eye);
    }

    // ── Arms ──
    for (const [side, s] of [['l', 1], ['r', -1]]) {
      const sh = joint(`${side}Shoulder`, spine, [0.19 * s, 0.445, -0.01]);
      part(new THREE.SphereGeometry(0.068, 22, 16), mats.limb, sh, [0.01 * s, -0.02, 0], [1.05, 1.0, 0.95]); // deltoid
      // upper arm: deltoid insertion, bicep bulge, narrow above the elbow
      part(lathe([[-0.3, 0.038], [-0.24, 0.044], [-0.14, 0.052], [-0.06, 0.055], [0.0, 0.058]]), mats.limb, sh, [0, 0, 0], [1, 1, 1.05]);
      const el = joint(`${side}Elbow`, sh, [0, -0.29, 0]);
      part(new THREE.SphereGeometry(0.04, 16, 12), mats.limb, el, [0, 0, 0], null, false);
      // forearm: thick near the elbow, tapering to the wrist
      part(lathe([[-0.26, 0.029], [-0.18, 0.034], [-0.08, 0.044], [-0.02, 0.043], [0.02, 0.038]]), mats.limb, el, [0, 0, 0], [1.05, 1, 0.92]);
      // web-shooter cuff
      part(new THREE.CylinderGeometry(0.035, 0.034, 0.045, 18), mats.cuff, el, [0, -0.215, 0]);
      const hand = joint(`${side}Hand`, el, [0, -0.27, 0]);
      // gloved fist: palm, curled fingers, thumb
      part(new RoundedBoxGeometry(0.07, 0.07, 0.034, 3, 0.012), mats.glove, hand, [0, -0.025, 0]);
      part(new RoundedBoxGeometry(0.068, 0.045, 0.04, 3, 0.016), mats.glove, hand, [0, -0.072, 0.008], null).rotation.x = 0.35;
      part(new THREE.CapsuleGeometry(0.012, 0.03, 4, 10), mats.glove, hand, [0.03 * s, -0.04, 0.02], null).rotation.set(0.4, 0, 0.5 * s);
    }

    // ── Legs ──
    for (const [side, s] of [['l', 1], ['r', -1]]) {
      const hp = joint(`${side}Hip`, hips, [0.095 * s, -0.06, 0]);
      // thigh: full quad up top, narrowing into the knee
      part(lathe([[-0.45, 0.056], [-0.36, 0.07], [-0.22, 0.088], [-0.08, 0.098], [0.02, 0.098]]), mats.limb, hp, [0, 0, 0], [0.98, 1, 1.02]);
      const kn = joint(`${side}Knee`, hp, [0, -0.45, 0]);
      part(new THREE.SphereGeometry(0.058, 18, 14), mats.limb, kn, [0, 0, 0.004], null, false);
      // shin with a calf bulge, slim at the ankle
      const calf = part(lathe([[-0.42, 0.036], [-0.32, 0.042], [-0.18, 0.06], [-0.09, 0.066], [0.0, 0.056]]), mats.limb, kn, [0, 0, 0], [0.95, 1, 1.05]);
      calf.position.z = -0.006;
      // high-top sneakers: white sole, red upper, white toe box, black collar
      const shoe = new THREE.Group();
      shoe.position.set(0, -0.44, 0.03);
      kn.add(shoe);
      part(new RoundedBoxGeometry(0.105, 0.03, 0.27, 3, 0.012), mats.white, shoe, [0, -0.032, 0.012]);
      part(new RoundedBoxGeometry(0.096, 0.075, 0.23, 3, 0.03), mats.red, shoe, [0, 0.015, 0]);
      part(new RoundedBoxGeometry(0.094, 0.05, 0.08, 3, 0.022), mats.white, shoe, [0, -0.002, 0.09]);
      part(new THREE.CylinderGeometry(0.046, 0.05, 0.06, 18), mats.black, shoe, [0, 0.07, -0.04]);
    }

    this.setPose('idle', 1);
    Object.assign(this.pose, structuredClone(POSES.idle));
    this._target = structuredClone(POSES.idle);
    this.apply(this.pose);
  }

  // Colour of the hard rim light — warm in the portal, cool in the city.
  setRim(color, strength = 0.35) {
    this.rim.uRim.value.set(color);
    this.rim.uRimStrength.value = strength;
  }

  getWorldHand(side = 'r', out = new THREE.Vector3()) {
    return this.j[`${side}Hand`].getWorldPosition(out);
  }

  // Set the pose target as a blend of two named poses.
  setPose(a, t = 1, b = null) {
    const A = POSES[a];
    const B = b ? POSES[b] : null;
    const target = {};
    target.hipsY = B ? A.hipsY + (B.hipsY - A.hipsY) * t : A.hipsY;
    for (const k of JOINTS) {
      if (k === 'hips') continue;
      const va = A[k] || [0, 0, 0];
      const vb = B ? B[k] || [0, 0, 0] : va;
      target[k] = [0, 1, 2].map((i) => va[i] + (vb[i] - va[i]) * (B ? t : 1));
    }
    this._target = target;
    return target;
  }

  // Additive tweaks on top of the target (e.g. aim an arm, turn the head).
  override(joint, rot) {
    if (this._target[joint]) this._target[joint] = rot;
  }

  apply(p) {
    this.j.hips.position.y = 0.98 + p.hipsY;
    for (const k of JOINTS) {
      if (k === 'hips' || !p[k]) continue;
      this.j[k].rotation.set(p[k][0], p[k][1], p[k][2]);
    }
  }

  // Animate toward the target. When onTwos is set, the visible pose only
  // updates 12 times per second — the stepped Spider-Verse look.
  update(dt, immediate = false) {
    this._stepClock += dt;
    const step = 1 / 12;
    if (!immediate && this.onTwos && this._stepClock < step) return;
    const k = immediate ? 1 : 1 - Math.exp(-14 * Math.max(this._stepClock, dt));
    this._stepClock = 0;
    const p = this.pose;
    p.hipsY += (this._target.hipsY - p.hipsY) * k;
    for (const key of JOINTS) {
      if (key === 'hips') continue;
      const cur = p[key] || (p[key] = [0, 0, 0]);
      const tgt = this._target[key];
      for (let i = 0; i < 3; i++) cur[i] += (tgt[i] - cur[i]) * k;
    }
    this.apply(p);
  }
}
