import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../core/util.js';
import { windowTexture, neonSign, glowTexture, streakTexture, streetMap } from '../world/textures.js';
import { Rain } from '../world/rain.js';
import { Traffic } from '../world/cars.js';
import { Billboard } from '../world/billboards.js';

export const PITCH = 36;
export const ROAD = 12;
const N = 6;
const EXTENT = (2 * N + 1) * PITCH;
const TILE_W = 20;
const TILE_H = 56;

export const HERO = { height: 42, size: 22, parapet: 0.9 };
// Spider-Man's perch on the front parapet of the hero rooftop.
export const PERCH = new THREE.Vector3(0, HERO.height + HERO.parapet, -HERO.size / 2 + 0.45);

// The three billboard towers, arranged in a V facing the hero rooftop.
const FEATURED = [
  { block: [-1, -2], height: 96, board: 68 },
  { block: [0, -3], height: 124, board: 84 },
  { block: [1, -2], height: 102, board: 72 },
];

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
`;

function skyMaterial(fogColor) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uHorizon: { value: fogColor } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlash; uniform vec3 uHorizon;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        float h = vDir.y;
        vec3 mid = vec3(0.035, 0.018, 0.075);
        vec3 top = vec3(0.004, 0.004, 0.014);
        vec3 col = mix(uHorizon, mid, smoothstep(-0.02, 0.22, h));
        col = mix(col, top, smoothstep(0.22, 0.75, h));
        // low rain clouds lit from below by the city
        vec2 cp = vDir.xz / (h + 0.25) * 1.4 + vec2(uTime * 0.008, uTime * 0.004);
        float c = fbm(cp) * fbm(cp * 2.3 + 4.0);
        float glow = smoothstep(0.55, 0.0, h);
        vec3 cloudLit = mix(vec3(0.16, 0.04, 0.16), vec3(0.04, 0.09, 0.16), fbm(cp * 0.5));
        col += cloudLit * c * 1.6 * glow * step(0.0, h);
        col += vec3(0.55, 0.6, 1.0) * uFlash * (0.25 + c * 2.0) * step(-0.05, h);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// Wet street: real planar reflection, warped by rain ripples, mixed with
// a painted street map whose alpha channel says how wet each spot is.
function wetRoadShader(fog) {
  return {
    name: 'WetRoad',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      tStreet: { value: null },
      uTime: { value: 0 },
      uExtent: { value: EXTENT },
      uFogColor: { value: fog.color },
      uFogDensity: { value: fog.density },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
      void main(){
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse, tStreet;
      uniform float uTime, uExtent, uFogDensity;
      uniform vec3 uFogColor;
      varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
      ${NOISE}
      void main(){
        vec2 suv = vec2(vWorld.x / uExtent + 0.5, 0.5 - vWorld.z / uExtent);
        vec4 street = texture2D(tStreet, suv);
        // rain ripples: tiled expanding rings
        vec2 cell = floor(vWorld.xz * 0.9);
        vec2 f = fract(vWorld.xz * 0.9) - 0.5;
        float ph = fract(uTime * 1.3 + hash(cell));
        float ring = sin(clamp(length(f) - ph * 0.5, -0.1, 0.1) * 60.0) * (1.0 - ph);
        vec2 ripple = normalize(f + 0.0001) * ring * 0.012;
        vec2 warp = (vec2(noise(vWorld.xz * 0.35 + uTime * 0.2), noise(vWorld.zx * 0.35 - uTime * 0.2)) - 0.5) * 0.02;
        vec4 uv = vUv;
        uv.xy += (ripple + warp) * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        float wet = street.a;
        vec3 col = street.rgb * 0.22 + refl * (0.25 + 0.55 * wet);
        float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
}

function boxUVs(geo, w, h, d, uOff) {
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (f === 2 || f === 3) {
        uv.setXY(i, 0.01, 0.004);
        continue;
      }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * (span / TILE_W) + uOff, uv.getY(i) * (h / TILE_H));
    }
  }
}

function buildEnvironment(renderer) {
  // A tiny neon "room" baked into a PMREM so metal and glass catch colourful reflections.
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05040a);
  const strip = (color, pos, scale) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color }));
    m.position.set(...pos);
    m.scale.set(...scale);
    env.add(m);
  };
  strip(new THREE.Color(4, 0.3, 1.5), [-8, 2, -6], [0.5, 10, 0.5]);
  strip(new THREE.Color(0.3, 2.5, 4), [8, 1, -4], [0.5, 8, 0.5]);
  strip(new THREE.Color(4, 1.6, 0.2), [0, 6, -10], [12, 0.5, 0.5]);
  strip(new THREE.Color(1.6, 0.6, 4), [-4, 1, 9], [8, 1, 0.5]);
  strip(new THREE.Color(0.4, 0.4, 0.8), [0, 12, 0], [20, 0.5, 20]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.04);
  pm.dispose();
  return rt.texture;
}

export function createCityScene({ renderer, mobile, sections }) {
  const R = rng(928);
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color().setRGB(0.07, 0.032, 0.1);
  scene.fog = new THREE.FogExp2(fogColor, 0.0048);
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 0.6;

  const glowTex = glowTexture();
  const streakTex = streakTexture();
  const updaters = [];

  // ── Sky ──
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMaterial(fogColor));
  sky.renderOrder = -1;
  scene.add(sky);

  // ── Layout ──
  const blocks = [];
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) blocks.push({ i, j, x: i * PITCH, z: j * PITCH });

  const isFeatured = (b) => FEATURED.some((f) => f.block[0] === b.i && f.block[1] === b.j);
  const isHero = (b) => b.i === 0 && b.j === 0;
  // Keep sightlines from the rooftop to the billboards clear.
  const heightCap = (x, z) => {
    if (z < -12 && z > -100 && Math.abs(x) < 70) return 26;
    if (z >= 12 && z < 60 && Math.abs(x) < 50) return 30;
    return Infinity;
  };

  // ── Ground ──
  const streetTex = streetMap({ extent: EXTENT, pitch: PITCH, road: ROAD, blocks });
  let ground;
  if (!mobile) {
    const pr = Math.min(window.devicePixelRatio, 1.5);
    ground = new Reflector(new THREE.PlaneGeometry(EXTENT, EXTENT), {
      textureWidth: Math.round(window.innerWidth * pr * 0.5),
      textureHeight: Math.round(window.innerHeight * pr * 0.5),
      clipBias: 0.003,
      multisample: 0,
      shader: wetRoadShader(scene.fog),
    });
    ground.material.uniforms.tStreet.value = streetTex;
    updaters.push((t) => (ground.material.uniforms.uTime.value = t));
  } else {
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(EXTENT, EXTENT),
      new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.18, metalness: 0.7, color: 0x8888aa })
    );
  }
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ── Generic buildings (merged per facade style) ──
  const styles = [
    { tex: windowTexture(11, { tint: 'warm' }), color: 0x1a1518, metal: 0.2, rough: 0.7 },
    { tex: windowTexture(23, { tint: 'cool' }), color: 0x10141f, metal: 0.85, rough: 0.12 }, // glass
    { tex: windowTexture(37, { tint: 'mixed' }), color: 0x15131c, metal: 0.4, rough: 0.5 },
    { tex: windowTexture(51, { tint: 'mixed', cols: 9, rows: 16 }), color: 0x1b1720, metal: 0.3, rough: 0.6 },
  ];
  const geos = styles.map(() => []);
  const lots = [];
  const roofBoxes = [];
  const antennas = [];

  for (const b of blocks) {
    if (isHero(b) || isFeatured(b)) continue;
    const split = R();
    const parts = split < 0.3 ? [[0, 0, 20, 20]] : split < 0.6 ? [[-5.25, 0, 9.5, 20], [5.25, 0, 9.5, 20]] : [[-5.25, -5.25, 9.5, 9.5], [5.25, -5.25, 9.5, 9.5], [-5.25, 5.25, 9.5, 9.5], [5.25, 5.25, 9.5, 9.5]];
    for (const [ox, oz, w0, d0] of parts) {
      const w = w0 - R() * 2, d = d0 - R() * 2;
      const x = b.x + ox, z = b.z + oz;
      const dist = Math.hypot(x, z);
      let h = 10 + Math.pow(R(), 2) * 60 + (dist < 120 ? 10 : 0);
      if (R() < 0.12) h = 80 + R() * 90;
      h = Math.min(h, heightCap(x, z) - R() * 6);
      h = Math.max(8, Math.round(h / 3.5) * 3.5);
      const style = (R() * styles.length) | 0;
      const g = new THREE.BoxGeometry(w, h, d);
      boxUVs(g, w, h, d, Math.floor(R() * 8) / 8);
      g.translate(x, h / 2, z);
      geos[style].push(g);
      lots.push({ x, z, w, d, h });
      // rooftop clutter
      const nBox = h > 120 ? 0 : 1 + ((R() * 3) | 0);
      for (let k = 0; k < nBox; k++) {
        const s = 1.2 + R() * 3;
        roofBoxes.push([x + (R() - 0.5) * (w - s), h + s * 0.35, z + (R() - 0.5) * (d - s), s, s * 0.7, s * (0.6 + R())]);
      }
      if (h > 70) antennas.push([x + (R() - 0.5) * w * 0.4, h, z + (R() - 0.5) * d * 0.4, 6 + R() * 12]);
    }
  }
  styles.forEach((s, i) => {
    if (!geos[i].length) return;
    const merged = mergeGeometries(geos[i]);
    // Only the glass style needs PBR reflections; Lambert is far cheaper on fill-rate.
    const mat = s.metal > 0.8
      ? new THREE.MeshStandardMaterial({ color: s.color, metalness: s.metal, roughness: s.rough, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: 0.9 })
      : new THREE.MeshLambertMaterial({ color: s.color, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: 0.9 });
    scene.add(new THREE.Mesh(merged, mat));
    geos[i].forEach((g) => g.dispose());
  });

  // Roof clutter
  {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x25222c, roughness: 0.8 }), roofBoxes.length);
    const m = new THREE.Matrix4();
    roofBoxes.forEach(([x, y, z, sx, sy, sz], i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))));
    scene.add(im);
  }
  // Antennas with blinking aircraft lights
  {
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.25, 1, 5), new THREE.MeshStandardMaterial({ color: 0x333340 }), antennas.length);
    const lightPos = [];
    const m = new THREE.Matrix4();
    antennas.forEach(([x, y, z, h], i) => {
      poles.setMatrixAt(i, m.compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
      lightPos.push(x, y + h + 0.3, z);
    });
    scene.add(poles);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
    const lm = new THREE.PointsMaterial({ map: glowTex, color: new THREE.Color(4, 0.2, 0.2), size: 4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(lg, lm));
    updaters.push((t) => (lm.opacity = Math.sin(t * 2.5) > 0.3 ? 1 : 0.1));
  }

  // ── Neon signs ──
  const jp = ['スパイダー', '渋谷', 'ラーメン', 'ネオン', '東京', 'カラオケ', '居酒屋', 'ホテル', '寿司', 'ゲーム', '多元宇宙'];
  const en = ['BODEGA', 'OPEN 24H', 'PIZZA', 'EARTH-1610', 'NUEVA YORK', 'MUMBATTAN', 'KARAOKE', 'HOTEL', 'ARCADE', 'NOODLES', 'THWIP', 'SPIDER-BYTE', 'CAFE'];
  const neonColors = ['#ff2d6f', '#2de2ff', '#ffd400', '#8a5bff', '#ff7a1a', '#2dffb0', '#ff4df0'];
  const signCache = new Map();
  const flicker = [];
  const getSign = (text, color, vertical) => {
    const key = `${text}|${color}|${vertical}`;
    if (!signCache.has(key)) {
      const { texture, aspect } = neonSign(text, color, { vertical, font: vertical ? 'Noto Sans JP' : 'Bangers' });
      const mat = new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1.7, 1.7, 1.7), side: THREE.DoubleSide, transparent: true });
      signCache.set(key, { mat, aspect });
    }
    return signCache.get(key);
  };
  const reflections = [];
  const signCount = mobile ? 45 : 90;
  const candidates = lots.filter((l) => Math.hypot(l.x, l.z) < 190 && l.h > 14);
  for (let k = 0; k < signCount && candidates.length; k++) {
    const l = candidates[(R() * candidates.length) | 0];
    const vertical = R() < 0.55;
    const color = neonColors[(R() * neonColors.length) | 0];
    const text = vertical ? jp[(R() * jp.length) | 0] : en[(R() * en.length) | 0];
    const { mat, aspect } = getSign(text, color, vertical);
    const face = (R() * 4) | 0; // 0:+x 1:-x 2:+z 3:-z
    const nx = face === 0 ? 1 : face === 1 ? -1 : 0;
    const nz = face === 2 ? 1 : face === 3 ? -1 : 0;
    const half = nx ? l.w / 2 : l.d / 2;
    const along = nx ? l.d : l.w;
    let hgt = vertical ? 6 + R() * 6 : 2.2 + R() * 1.8;
    if (!vertical) hgt = Math.min(hgt, (along - 1) / aspect);
    const wid = hgt * aspect;
    const y = Math.min(l.h - hgt / 2 - 1, 4 + hgt / 2 + R() * 22);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(wid, hgt), mat);
    const tOff = (R() - 0.5) * Math.max(0, along - wid - 1);
    if (vertical) {
      // blade sign sticking out of the facade
      sign.position.set(l.x + nx * (half + wid / 2 + 0.3) + (nz ? tOff : 0), y, l.z + nz * (half + wid / 2 + 0.3) + (nx ? tOff : 0));
      sign.rotation.y = nx ? 0 : Math.PI / 2;
    } else {
      sign.position.set(l.x + nx * (half + 0.12) + (nz ? tOff : 0), y, l.z + nz * (half + 0.12) + (nx ? tOff : 0));
      sign.rotation.y = nx ? (nx > 0 ? Math.PI / 2 : -Math.PI / 2) : nz > 0 ? 0 : Math.PI;
    }
    scene.add(sign);
    if (R() < 0.12) flicker.push({ mesh: sign, seed: R() * 100 });
    if (y < 18) reflections.push({ pos: sign.position.clone(), color, w: Math.min(wid, 6) });
  }
  updaters.push((t) => {
    const step = Math.floor(t * 12);
    for (const f of flicker) f.mesh.visible = Math.sin(step * 1.7 + f.seed) > -0.8 || (step % 5) === 0;
  });

  // Mobile has no planar reflector, so paint fake streaks under low signs.
  if (mobile) {
    for (const r of reflections) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(r.w, 14),
        new THREE.MeshBasicMaterial({ map: streakTex, color: new THREE.Color(r.color).multiplyScalar(1.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(r.pos.x, 0.05, r.pos.z);
      scene.add(m);
    }
  }

  // ── Street lamps ──
  {
    const lampPos = [];
    const poles = [];
    for (let i = -N; i < N; i++) {
      const c = (i + 0.5) * PITCH;
      for (let s = -EXTENT / 2 + 9; s < EXTENT / 2; s += 18) {
        if (Math.abs((((s / PITCH) % 1) + 1) % 1 - 0.5) < 0.2) continue; // skip intersections
        poles.push([c + ROAD / 2 + 0.6, s], [s, c - ROAD / 2 - 0.6]);
      }
    }
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 5), new THREE.MeshStandardMaterial({ color: 0x22222a, metalness: 0.7, roughness: 0.4 }), poles.length);
    const m = new THREE.Matrix4();
    poles.forEach(([x, z], i) => {
      pm.setMatrixAt(i, m.makeTranslation(x, 3.5, z));
      lampPos.push(x, 7.1, z);
    });
    scene.add(pm);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
    scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTex, color: new THREE.Color(2.4, 1.6, 0.9), size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ── Hero building (where Spider-Man lands) ──
  const hero = new THREE.Group();
  scene.add(hero);
  {
    const { height: h, size: s, parapet: ph } = HERO;
    const brickTex = windowTexture(5, { tint: 'warm', cols: 8, rows: 18 });
    const g = new THREE.BoxGeometry(s, h, s);
    boxUVs(g, s, h, s, 0);
    const brick = new THREE.MeshStandardMaterial({ color: 0x3a2022, roughness: 0.85, emissive: 0xffffff, emissiveMap: brickTex, emissiveIntensity: 1.1 });
    const body = new THREE.Mesh(g, brick);
    body.position.y = h / 2;
    hero.add(body);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2630, roughness: 0.6, metalness: 0.2 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(s - 0.2, 0.2, s - 0.2), roofMat);
    roof.position.y = h + 0.1;
    hero.add(roof);
    const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x4a3a40, roughness: 0.5 });
    for (const [x, z, w, d] of [[0, -s / 2 + 0.45, s, 0.9], [0, s / 2 - 0.45, s, 0.9], [-s / 2 + 0.45, 0, 0.9, s], [s / 2 - 0.45, 0, 0.9, s]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, ph, d), ledgeMat);
      p.position.set(x, h + ph / 2, z);
      hero.add(p);
    }
    // NYC water tower
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.9 });
    const wt = new THREE.Group();
    wt.position.set(6.8, h, 7);
    for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4), ledgeMat);
      leg.position.set(lx, 1.7, lz);
      wt.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.2, 20), wood);
    tank.position.y = 3.4 + 2.1;
    wt.add(tank);
    for (const y of [4.0, 5.5, 7.0]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.05, 4, 32), ledgeMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      wt.add(band);
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 20), wood);
    cone.position.y = 3.4 + 4.2 + 0.8;
    wt.add(cone);
    hero.add(wt);
    // stair hut with a lit door
    const hut = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.4, 3.6), ledgeMat);
    hut.position.set(-7, h + 1.7, 7.5);
    hero.add(hut);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.8, 0.9) }));
    door.position.set(-7, h + 1.05, 7.5 - 1.81);
    door.rotation.y = Math.PI;
    hero.add(door);
    // AC units + vents
    for (const [x, z] of [[-2, -2], [2.5, -4.5], [-7, -3]]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.6), roofMat);
      ac.position.set(x, h + 0.75, z);
      hero.add(ac);
    }
    // rooftop neon sign facing the street behind
    const { mat, aspect } = getSign('EARTH-1610', '#ff2d6f', false);
    const rs = new THREE.Mesh(new THREE.PlaneGeometry(3 * aspect, 3), mat);
    rs.position.set(0, h + 3.6, s / 2 - 0.4);
    hero.add(rs);
    const rsFrame = new THREE.Mesh(new THREE.BoxGeometry(3 * aspect, 0.2, 0.2), ledgeMat);
    rsFrame.position.set(0, h + 2, s / 2 - 0.4);
    hero.add(rsFrame);
  }

  // Lights that sculpt the cel-shaded hero on the rooftop.
  scene.add(new THREE.HemisphereLight(0x5a4a9a, 0x140a1a, 1.1));
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.8);
  moon.position.set(-60, 120, 40);
  scene.add(moon);
  const rimCyan = new THREE.PointLight(0x2de2ff, 60, 30, 1.5);
  rimCyan.position.set(-7, HERO.height + 4, -14);
  scene.add(rimCyan);
  const rimPink = new THREE.PointLight(0xff2d6f, 60, 30, 1.5);
  rimPink.position.set(7, HERO.height + 3, -4);
  scene.add(rimPink);

  // ── Billboard towers ──
  const billboards = [];
  FEATURED.forEach((f, idx) => {
    const section = sections[idx];
    const accent = new THREE.Color(section.accent);
    const x = f.block[0] * PITCH, z = f.block[1] * PITCH;
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    tower.rotation.y = Math.atan2(-x, -z); // face the hero rooftop
    scene.add(tower);
    const w = 20, h = f.height;
    const g = new THREE.BoxGeometry(w, h, w);
    boxUVs(g, w, h, w, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d1018, metalness: 0.9, roughness: 0.08,
      emissive: 0xffffff, emissiveMap: styles[1].tex, emissiveIntensity: 0.9, envMapIntensity: 1.6,
    });
    const body = new THREE.Mesh(g, mat);
    body.position.y = h / 2;
    tower.add(body);
    // crown setback
    const crown = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 14), mat);
    crown.position.y = h + 5;
    tower.add(crown);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 18, 6), new THREE.MeshStandardMaterial({ color: 0x333340 }));
    spire.position.y = h + 19;
    tower.add(spire);
    // accent neon corner strips + crown bands
    const neon = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.2) });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), neon);
      strip.position.set((cx * w) / 2, h / 2, (cz * w) / 2);
      tower.add(strip);
    }
    // hollow neon rings around the roofline and the crown
    for (const [y, sz] of [[h + 0.2, 20.4], [h + 10.1, 14.4]]) {
      for (const [bx, bz, bw, bd] of [[0, sz / 2, sz, 0.35], [0, -sz / 2, sz, 0.35], [sz / 2, 0, 0.35, sz], [-sz / 2, 0, 0.35, sz]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.35, bd), neon);
        bar.position.set(bx, y, bz);
        tower.add(bar);
      }
    }
    // the billboard itself
    const bb = new Billboard(section, { width: 30 });
    bb.group.position.set(0, f.board, w / 2 + 1.4);
    tower.add(bb.group);
    // struts holding the screen off the facade
    for (const sx of [-10, 10]) for (const sy of [-5, 5]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x222228 }));
      strut.position.set(sx, f.board + sy, w / 2 + 0.4);
      tower.add(strut);
    }

    tower.updateMatrixWorld(true);
    const center = bb.group.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(tower.quaternion);
    const right = new THREE.Vector3().crossVectors(normal.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
    billboards.push({ bb, center, normal, right, tower, section, height: h });
  });

  // ── Traffic ──
  const traffic = new Traffic({ count: mobile ? 60 : 150, pitch: PITCH, extent: EXTENT, roadsN: N, lightTex: streakTex });
  traffic.meshes.forEach((m) => scene.add(m));

  // ── Rain ──
  const rain = new Rain({ count: mobile ? 3500 : 7000, area: 80, height: 60 });
  scene.add(rain.mesh);

  // The street reflection doesn't need rain or tiny rooftop props — skip them for that pass.
  if (ground.isReflector) {
    const skip = [rain.mesh, ...scene.children.filter((o) => o.isInstancedMesh && !traffic.meshes.includes(o))];
    const renderReflection = ground.onBeforeRender;
    ground.onBeforeRender = function (...args) {
      const prev = skip.map((o) => o.visible);
      skip.forEach((o) => (o.visible = false));
      renderReflection.apply(this, args);
      skip.forEach((o, i) => (o.visible = prev[i]));
    };
  }

  // ── Lightning ──
  const hemi = scene.children.find((c) => c.isHemisphereLight);
  const lightning = { next: 6 + R() * 6, t: -1, flash: 0 };
  const triggerLightning = () => (lightning.t = 0);

  function update(t, dt, camera) {
    for (const u of updaters) u(t);
    sky.material.uniforms.uTime.value = t;
    traffic.update(dt);
    rain.update(t, camera.position);
    for (const b of billboards) b.bb.update(t, dt);

    // lightning: double-pulse flash on a random timer
    lightning.next -= dt;
    if (lightning.next <= 0) {
      triggerLightning();
      lightning.next = 9 + Math.random() * 12;
    }
    if (lightning.t >= 0) {
      lightning.t += dt;
      const lt = lightning.t;
      lightning.flash = Math.max(0, 1 - Math.abs(lt - 0.06) * 14) + Math.max(0, 0.8 - Math.abs(lt - 0.26) * 8);
      if (lt > 0.6) {
        lightning.t = -1;
        lightning.flash = 0;
      }
    }
    sky.material.uniforms.uFlash.value = lightning.flash;
    hemi.intensity = 1.1 + lightning.flash * 3;
  }

  return { scene, update, billboards, rain, lightning, triggerLightning };
}
