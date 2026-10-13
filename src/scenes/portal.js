import * as THREE from 'three';
import { rng } from '../core/util.js';

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

// The swirling yellow-orange membrane of the portal.
function vortexMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float t = uTime;
        float swirl = a + 3.5 * (1.0 - r) * (1.0 + 0.4 * uPower) + t * 0.9;
        float n = fbm(vec2(cos(swirl), sin(swirl)) * 2.2 + vec2(r * 4.0 - t * 1.6, t * 0.2));
        float arms = pow(0.5 + 0.5 * sin(swirl * 5.0 + n * 6.0 - r * 8.0), 2.0);

        vec3 ember  = vec3(0.45, 0.04, 0.02);
        vec3 orange = vec3(1.0, 0.3, 0.0);
        vec3 gold   = vec3(1.0, 0.72, 0.05);
        vec3 col = mix(ember, orange, smoothstep(0.2, 0.7, n));
        col = mix(col, gold, arms * 0.75);
        col *= 0.55 + 0.6 * arms;

        // hexagonal "collider" lattice stepping through the membrane
        vec2 hp = p * 7.0; hp.x *= 1.1547; hp.y += mod(floor(hp.x), 2.0) * 0.5;
        vec2 hf = abs(fract(hp) - 0.5);
        float hex = smoothstep(0.46, 0.5, max(hf.x * 1.5 + hf.y, hf.y * 2.0));
        float hexPulse = step(0.6, hash(floor(hp) + floor(t * 6.0)));
        col += gold * hex * hexPulse * 0.6 * smoothstep(1.0, 0.4, r);

        // expanding shock rings
        float rings = smoothstep(0.08, 0.0, abs(fract(r * 3.0 - t * 0.7) - 0.5) - 0.42);
        col += gold * rings * 0.45;

        // white-hot core
        float core = smoothstep(0.45, 0.0, r);
        col += vec3(1.0, 0.8, 0.4) * core * core * (0.5 + 0.12 * sin(t * 3.0));

        col *= 0.42 + 0.1 * uPower;
        float alpha = smoothstep(1.0, 0.9, r) * (0.75 + 0.25 * n);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

// Tunnel behind the membrane — what you fly through.
function tunnelMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        float a = vUv.x * 6.2831;
        float d = vUv.y;
        float n = fbm(vec2(vUv.x * 8.0 + d * 3.0 + uTime * 0.3, d * 6.0 - uTime * 2.5));
        float streak = pow(noise(vec2(vUv.x * 60.0, d * 2.0 - uTime * 4.0)), 6.0) * 1.4;
        vec3 col = mix(vec3(0.45, 0.03, 0.22), vec3(0.95, 0.38, 0.0), n);
        col += vec3(1.0, 0.65, 0.2) * streak;
        col = mix(col, vec3(0.2, 0.9, 1.0), step(0.93, noise(vec2(vUv.x * 30.0, floor(uTime * 12.0)))) * 0.5);
        float fade = smoothstep(0.0, 0.25, d) * smoothstep(1.0, 0.7, d);
        gl_FragColor = vec4(col * (0.45 + 0.12 * uPower), fade);
      }
    `,
  });
}

function backdropMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec2 p = vec2(atan(vDir.x, vDir.z), vDir.y * 2.0);
        float n = fbm(p * 1.6 + vec2(uTime * 0.02, 0.0));
        float m = fbm(p * 3.0 - vec2(0.0, uTime * 0.03) + n);
        vec3 deep = vec3(0.02, 0.01, 0.06);
        vec3 violet = vec3(0.22, 0.04, 0.32);
        vec3 magenta = vec3(0.55, 0.05, 0.3);
        vec3 teal = vec3(0.0, 0.25, 0.35);
        vec3 col = mix(deep, violet, smoothstep(0.35, 0.8, n));
        col = mix(col, magenta, smoothstep(0.62, 0.9, m) * 0.7);
        col = mix(col, teal, smoothstep(0.7, 0.95, n * m * 1.6) * 0.5);
        // big halftone spots in the void
        vec2 q = p * 18.0;
        float dots = smoothstep(0.32, 0.28, length(fract(q) - 0.5)) * smoothstep(0.5, 0.75, m);
        col += vec3(0.9, 0.2, 0.5) * dots * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function halftonePanel(color, seed) {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  const angle = r() * Math.PI;
  for (let y = -40; y < 168; y += 9)
    for (let x = -40; x < 168; x += 9) {
      const rx = 64 + (x - 64) * Math.cos(angle) - (y - 64) * Math.sin(angle);
      const ry = 64 + (x - 64) * Math.sin(angle) + (y - 64) * Math.cos(angle);
      const rad = (rx / 128) * 4;
      if (rad > 0.2) {
        g.beginPath();
        g.arc(rx, ry, rad, 0, Math.PI * 2);
        g.fill();
      }
    }
  g.strokeStyle = '#000';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPortalScene({ mobile }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0618, 0.01);
  const R = rng(1610);
  const updaters = [];

  // Backdrop
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), backdropMaterial());
  scene.add(backdrop);
  updaters.push((t) => (backdrop.material.uniforms.uTime.value = t));

  // Stars
  {
    const n = mobile ? 800 : 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const palette = [new THREE.Color('#ffffff'), new THREE.Color('#ffd27a'), new THREE.Color('#7fe8ff'), new THREE.Color('#ff7ac8')];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + R() * 100);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = palette[(R() * palette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.9, fog: false }));
    scene.add(stars);
    updaters.push((t) => (stars.rotation.y = t * 0.01));
  }

  // ── The portal ───────────────────────────────────────────────
  const portal = new THREE.Group();
  scene.add(portal);
  const spin = new THREE.Group(); // reacts to the mouse
  portal.add(spin);

  const metal = new THREE.MeshStandardMaterial({ color: 0x241a2a, metalness: 0.85, roughness: 0.32 });
  const glowGold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.15, 0.2) });
  const glowOrange = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.55, 0.08) });
  const glowRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.2, 0.08) });

  // Collider frame: heavy torus + segmented clamps with glowing strips.
  const frame = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.42, 20, 120), metal);
  spin.add(frame);
  const clamps = new THREE.Group();
  const clampGeo = new THREE.BoxGeometry(0.75, 1.25, 1.3);
  const stripGeo = new THREE.BoxGeometry(0.16, 1.32, 1.36);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.cos(a) * 6.3, Math.sin(a) * 6.3, 0);
    g.rotation.z = a;
    g.add(new THREE.Mesh(clampGeo, metal));
    const s = new THREE.Mesh(stripGeo, i % 3 === 0 ? glowGold : glowOrange);
    g.add(s);
    clamps.add(g);
  }
  spin.add(clamps);

  // Inner bright rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.75, 0.08, 10, 160), glowGold);
  spin.add(rim);

  // Gyroscope rings that orbit on tilted axes
  const gyros = [];
  const gyroDefs = [
    { r: 7.4, tube: 0.05, mat: glowOrange, tilt: [1.2, 0.3, 0], speed: 0.35 },
    { r: 8.2, tube: 0.035, mat: glowGold, tilt: [0.4, 1.1, 0], speed: -0.25 },
    { r: 9.1, tube: 0.03, mat: glowRed, tilt: [1.5, -0.6, 0.4], speed: 0.18 },
  ];
  for (const d of gyroDefs) {
    const pivot = new THREE.Group();
    pivot.rotation.set(...d.tilt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, d.tube, 8, 200), d.mat);
    // dashed segments riding on the ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.18), d.mat);
      node.position.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0);
      node.rotation.z = a;
      ring.add(node);
    }
    pivot.add(ring);
    portal.add(pivot);
    gyros.push({ ring, speed: d.speed });
  }

  // Swirling membrane + tunnel behind it
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(5.8, 96), vortexMaterial());
  portal.add(vortex);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 2.0, 60, 64, 1, true), tunnelMaterial());
  tunnel.rotation.x = Math.PI / 2;
  tunnel.position.z = -30;
  portal.add(tunnel);

  // Energy particles spiralling into the portal
  const pCount = mobile ? 1500 : 3500;
  const pGeo = new THREE.BufferGeometry();
  const seeds = new Float32Array(pCount * 4);
  for (let i = 0; i < pCount; i++) seeds.set([R() * Math.PI * 2, R(), 0.3 + R() * 0.9, R()], i * 4);
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime, uPower, uPixel;
      varying float vLife; varying float vHue;
      void main(){
        float life = fract(seed.y - uTime * 0.12 * seed.z * (0.8 + uPower * 0.6));
        float r = mix(1.2, 14.0, life);
        float a = seed.x + (1.0 - life) * 5.0 + uTime * 0.4 * seed.z;
        vec3 p = vec3(cos(a) * r, sin(a) * r, (seed.w - 0.5) * 6.0 * life);
        vLife = life; vHue = seed.w;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + 4.0 * (1.0 - life)) * uPixel * (18.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vLife; varying float vHue;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        vec3 col = mix(vec3(1.0, 0.55, 0.05), vec3(1.0, 0.9, 0.4), vHue);
        if (vHue > 0.88) col = vec3(1.0, 0.2, 0.55);
        float a = smoothstep(0.5, 0.0, d) * smoothstep(1.0, 0.6, vLife) * smoothstep(0.0, 0.15, vLife);
        gl_FragColor = vec4(col * 1.3, a * 0.8);
      }`,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  portal.add(particles);

  // Floating comic "dimension shards"
  const shards = [];
  const shardColors = ['#ff2d6f', '#2de2ff', '#ffd400', '#8a5bff', '#ff7a1a'];
  for (let i = 0; i < (mobile ? 18 : 34); i++) {
    const tex = halftonePanel(shardColors[i % shardColors.length], i + 7);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, color: new THREE.Color(1.2, 1.2, 1.2) })
    );
    const dir = new THREE.Vector3(R() * 2 - 1, R() * 1.4 - 0.7, R() * 1.2 - 0.9).normalize();
    m.position.copy(dir.multiplyScalar(11 + R() * 14));
    const s = 0.6 + R() * 2.2;
    m.scale.set(s * (0.6 + R()), s, 1);
    m.rotation.set(R() * 6, R() * 6, R() * 6);
    m.userData = { spin: (R() - 0.5) * 0.6, phase: R() * 10, base: m.position.clone() };
    scene.add(m);
    shards.push(m);
  }

  // Lights for the cel-shaded hero
  scene.add(new THREE.AmbientLight(0x6a4a8a, 0.9));
  const portalLight = new THREE.PointLight(0xffa020, 30, 40, 1.6);
  portalLight.position.set(0, 0, 2);
  scene.add(portalLight);
  const rimLight = new THREE.DirectionalLight(0x2de2ff, 2.5);
  rimLight.position.set(-8, 6, -4);
  scene.add(rimLight);
  const keyLight = new THREE.DirectionalLight(0xff4fa0, 1.6);
  keyLight.position.set(6, -2, 10);
  scene.add(keyLight);

  const state = { power: 1, tiltX: 0, tiltY: 0 };

  function update(t, dt, { mouse, power = 1 }) {
    state.power += (power - state.power) * (1 - Math.exp(-dt * 4));
    const pw = state.power;
    for (const u of updaters) u(t);
    vortex.material.uniforms.uTime.value = t;
    vortex.material.uniforms.uPower.value = pw;
    tunnel.material.uniforms.uTime.value = t;
    tunnel.material.uniforms.uPower.value = pw;
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uPower.value = pw;

    clamps.rotation.z = -t * 0.18 * pw;
    rim.rotation.z = t * 0.5;
    for (const g of gyros) g.ring.rotation.z = t * g.speed * (0.7 + pw * 0.5);

    // tilt toward the mouse
    state.tiltX += (mouse.y * 0.25 - state.tiltX) * (1 - Math.exp(-dt * 3));
    state.tiltY += (mouse.x * 0.35 - state.tiltY) * (1 - Math.exp(-dt * 3));
    spin.rotation.x = state.tiltX;
    spin.rotation.y = state.tiltY;
    vortex.rotation.x = state.tiltX * 0.6;
    vortex.rotation.y = state.tiltY * 0.6;

    portalLight.intensity = 22 + 6 * Math.sin(t * 4.0) + pw * 6;

    // shards bob and flicker in stepped time
    const step = Math.floor(t * 12);
    for (const s of shards) {
      const u = s.userData;
      s.rotation.x += u.spin * dt;
      s.rotation.y += u.spin * 0.7 * dt;
      s.position.y = u.base.y + Math.sin(t * 0.6 + u.phase) * 0.6;
      s.visible = ((step + Math.floor(u.phase * 10)) % 37) !== 0;
    }
  }

  return { scene, portal, vortex, update, portalLight };
}
