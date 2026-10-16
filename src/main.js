import * as THREE from 'three';
import gsap from 'gsap';
import { createPost } from './core/post.js';
import { T, activeSection } from './core/timeline.js';
import { clamp, lerp, seg, easeInOut, smooth, damp, isMobile, prefersReducedMotion } from './core/util.js';
import { createPortalScene } from './scenes/portal.js';
import { createCityScene, PERCH } from './scenes/city.js';
import { SpiderMan } from './world/spiderman.js';
import { WebLine } from './world/webline.js';
import { UI } from './ui/ui.js';
import { AudioFX } from './ui/audio.js';
import { sections } from './content.js';
import './style.css';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const mobile = isMobile();
const reduced = prefersReducedMotion();
const canvas = document.getElementById('webgl');
document.body.classList.add('loading');

const loaderStatus = document.getElementById('loader-status');
const loaderBar = document.getElementById('loader-bar');
const status = (msg, pct) => {
  loaderStatus.textContent = msg;
  loaderBar.style.width = `${pct}%`;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

async function boot() {
  status('Loading fonts…', 8);
  await Promise.race([
    Promise.all([
      document.fonts.load('96px "Bangers"'),
      document.fonts.load('700 46px "Space Grotesk"'),
      document.fonts.load('600 26px "JetBrains Mono"'),
      document.fonts.load('700 38px "Cinzel"'),
      document.fonts.load('600 29px "Cormorant Garamond"'),
      document.fonts.load('700 29px "Cormorant Garamond"'),
      document.fonts.load('italic 600 28px "Cormorant Garamond"'),
      document.fonts.load('700 120px "Noto Sans JP"', 'スパイダー渋谷ラーメンネオン東京カラオケ居酒屋ホテル寿司ゲーム多元宇宙'),
    ]),
    new Promise((r) => setTimeout(r, 5000)),
  ]);

  // ── Renderer / camera / post ──
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    status('WebGL is not available on this device — the Spider-Verse needs it.', 100);
    return;
  }
  const pr = Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2500);
  camera.position.set(0, 0, 18);

  status('Opening the portal…', 30);
  await nextFrame();
  const portal = createPortalScene({ mobile });

  status('Raising the city…', 55);
  await nextFrame();
  const city = createCityScene({ renderer, mobile, sections });

  status('Suiting up…', 80);
  await nextFrame();
  const spidey = new SpiderMan();
  spidey.onTwos = !reduced;
  const rig = new THREE.Group(); // outer transform (position / tilt)
  rig.rotation.order = 'YXZ';
  rig.add(spidey.root);
  const web = new WebLine(0.03);

  // landing shockwave rings
  const shock = [0, 1].map((i) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1, 96),
      new THREE.MeshBasicMaterial({
        color: i ? new THREE.Color(1.4, 0.2, 0.6) : new THREE.Color(0.3, 1.1, 1.4),
        transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(PERCH).add(V(0, 0.05, 0));
    city.scene.add(m);
    return m;
  });

  const post = createPost(renderer, portal.scene, camera, { mobile });
  post.setSize(window.innerWidth, window.innerHeight, pr);

  status('Compiling shaders…', 92);
  await nextFrame();
  renderer.compile(portal.scene, camera);
  renderer.compile(city.scene, camera);

  // ── UI / audio ──
  const audio = new AudioFX();
  let navTween = null;
  const stopNav = () => {
    navTween?.kill();
    navTween = null;
  };
  const scrollMax = () => document.documentElement.scrollHeight - window.innerHeight;
  const navigate = (p, duration) => {
    const from = window.scrollY;
    const to = p * scrollMax();
    const dist = Math.abs(to - from) / scrollMax();
    stopNav();
    const proxy = { y: from };
    navTween = gsap.to(proxy, {
      y: to,
      duration: reduced ? 0.01 : duration ?? 1 + dist * 5,
      ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, proxy.y),
      onComplete: () => (navTween = null),
    });
  };
  const ui = new UI({ onNavigate: navigate, onReturn: () => returnToPortal(), audio });

  // ── Section snapping in the city ──
  // From the skyline reveal onward, one scroll gesture (a wheel notch or two,
  // one trackpad/phone swipe, or an arrow key) moves to the next stop.
  const mid = (r) => (r[0] + r[1]) / 2;
  const SNAPS = [mid(T.reveal), mid(T.about), mid(T.projects), mid(T.goals), 0.98];
  const SNAP_ZONE = T.reveal[0] - 0.015;
  const snap = { busy: false, last: 0, acc: 0 };
  const scrollP = () => window.scrollY / scrollMax();
  const EPS = 0.004;
  // Does a gesture in this direction belong to the snapping zone?
  const snapsHere = (dir) => {
    const p = scrollP();
    if (p < SNAP_ZONE) return false;
    if (dir < 0 && p <= SNAPS[0] + EPS) return false; // scrolling back up out of the city stops → free scroll
    return true;
  };
  const snapStep = (dir) => {
    const p = scrollP();
    const next = dir > 0 ? SNAPS.find((s) => s > p + EPS) : [...SNAPS].reverse().find((s) => s < p - EPS);
    if (next === undefined) return;
    snap.busy = true;
    navigate(next, 1.1);
  };
  // Let a glass panel scroll its own overflow before the page snaps.
  const panelScrolls = (target, dir) => {
    const el = target.closest?.('.panel');
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  };
  window.addEventListener(
    'wheel',
    (e) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      const dir = Math.sign(dy);
      if (!dir || e.target.closest?.('.volume') || panelScrolls(e.target, dir)) return;
      if (!snapsHere(dir)) {
        stopNav(); // free-scroll region: the user's wheel wins over any nav animation
        snap.busy = false;
        return;
      }
      e.preventDefault();
      const now = performance.now();
      const gap = now - snap.last;
      snap.last = now;
      // ignore trackpad momentum until the move has finished and the wheel has gone quiet
      if (snap.busy) {
        if (navTween || gap < 220) return;
        snap.busy = false;
      }
      if (gap > 300) snap.acc = 0;
      snap.acc += dy;
      if (Math.abs(snap.acc) >= 60) {
        snap.acc = 0;
        snapStep(dir);
      }
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key);
    const up = ['ArrowUp', 'PageUp'].includes(e.key);
    if ((!down && !up) || e.target.closest?.('input, textarea')) return;
    const dir = down ? 1 : -1;
    if (!snapsHere(dir)) return stopNav();
    e.preventDefault();
    if (!navTween) snapStep(dir);
  });
  const touch = { y: 0, done: false, snapping: false };
  window.addEventListener('touchstart', (e) => {
    touch.y = e.touches[0].clientY;
    touch.done = false;
    touch.snapping = null;
  }, { passive: true });
  window.addEventListener(
    'touchmove',
    (e) => {
      const dy = touch.y - e.touches[0].clientY;
      if (touch.snapping === null) {
        if (Math.abs(dy) < 6) return;
        const dir = Math.sign(dy);
        touch.snapping = snapsHere(dir) && !panelScrolls(e.target, dir);
        if (!touch.snapping) stopNav();
      }
      if (!touch.snapping) return;
      e.preventDefault();
      if (!touch.done && Math.abs(dy) > 40 && !navTween) {
        touch.done = true;
        snapStep(Math.sign(dy));
      }
    },
    { passive: false }
  );

  // ── Interaction state ──
  const state = {
    p: 0, prevP: 0, t: 0,
    mouse: new THREE.Vector2(), mouseS: new THREE.Vector2(),
    shake: 0, impactT: -1,
    web: null, section: null,
    scene: null, hovered: null, returnGlitch: 0,
  };

  // Jump straight back to the portal page with a reverse dimension-jump flash,
  // instead of scrolling backwards through the whole story.
  function returnToPortal() {
    stopNav();
    ui.flash(1);
    audio.whoosh();
    state.returnGlitch = 1;
    window.scrollTo({ top: 0, behavior: 'instant' });
    state.p = state.prevP = 0;
    state.web = null;
    state.section = null;
    state.impactT = -1;
    gsap.fromTo('.hero > *', { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.8, ease: 'back.out(1.6)', delay: 0.15 });
  }
  window.addEventListener('pointermove', (e) => {
    state.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });

  const raycaster = new THREE.Raycaster();
  const screens = city.billboards.map((b) => b.bb.screen);
  canvas.addEventListener('click', () => {
    if (!state.hovered) return;
    const bb = state.hovered;
    // focused on Projects: open the repo of the project showing on the screen
    if (bb.section.id === 'projects' && activeSection(state.p) === 'projects' && bb.currentLink) {
      window.open(bb.currentLink, '_blank', 'noopener');
      return;
    }
    const i = city.billboards.findIndex((b) => b.bb === bb);
    const range = [T.about, T.projects, T.goals][i];
    navigate((range[0] + range[1]) / 2);
  });

  // ── Camera choreography for the city ──
  const isWide = () => window.innerWidth / window.innerHeight > 1;
  function fallCam(tf, spPos, out) {
    const ang = lerp(0.35, 1.05, tf);
    const dist = lerp(15, 10.5, smooth(tf));
    const h = lerp(17, 3.6, Math.pow(tf, 0.7));
    out.pos.set(spPos.x + Math.sin(ang) * dist, spPos.y + h, spPos.z + Math.cos(ang) * dist);
    out.target.copy(spPos).add(tmpV.set(0, -lerp(9, -0.3, tf), 0));
    return out;
  }
  let keys = [];
  function buildKeys() {
    const wide = isWide();
    const land = fallCam(1, PERCH, { pos: V(), target: V() });
    const focus = (i) => {
      const b = city.billboards[i];
      // wide screens: board sits between the music card (bottom-left) and the glass panel (right)
      const dist = wide ? 46 : 72;
      const shift = wide ? 9 : 0;
      // portrait: aim below the board so it sits in the top half, above the bottom sheet
      const target = b.center.clone().addScaledVector(b.right, shift).add(V(0, wide ? -3 : -21, 0));
      const pos = b.center.clone().addScaledVector(b.normal, dist).addScaledVector(b.right, shift).add(V(0, 3, 0));
      return { pos, target };
    };
    const shoulder = { pos: PERCH.clone().add(V(-1.6, 3.6, 14)), target: V(0, 60, -90) };
    const outro = { pos: V(0, 82, 54), target: V(0, 50, -70) };
    keys = [
      { p: T.fallEnd, ...land },
      { p: T.reveal[0], ...shoulder },
      { p: T.reveal[1], ...shoulder },
      { p: T.about[0], ...focus(0) },
      { p: T.about[1], ...focus(0) },
      { p: T.projects[0], ...focus(1) },
      { p: T.projects[1], ...focus(1) },
      { p: T.goals[0], ...focus(2) },
      { p: T.goals[1], ...focus(2) },
      { p: T.outro[0], ...outro },
      { p: 1.01, ...outro },
    ];
  }
  buildKeys();
  const camOut = { pos: V(), target: V() };
  function keyCam(p, out) {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    const a = keys[i], b = keys[i + 1];
    const u = easeInOut(seg(p, a.p, b.p));
    out.pos.lerpVectors(a.pos, b.pos, u);
    out.target.lerpVectors(a.target, b.target, u);
    out.pos.y += Math.sin(Math.PI * u) * a.pos.distanceTo(b.pos) * 0.12; // swoop arc
    return out;
  }

  // ── Scene switching ──
  function useScene(which) {
    if (state.scene === which) return;
    state.scene = which;
    const s = which === 'city' ? city.scene : portal.scene;
    s.add(rig);
    s.add(web.mesh);
    post.renderPass.scene = s;
    // billboards only exist in the city — drop any hover state when leaving it
    if (which === 'portal' && state.hovered) {
      state.hovered = null;
      state.hoverLabel = '';
      ui.setHover(false);
      for (const b of city.billboards) b.bb.hover = 0;
    }
    if (which === 'city') {
      post.bloom.strength = 0.7;
      post.bloom.threshold = 0.8;
      post.bloom.radius = 0.45;
      post.sv.uniforms.uHalftone.value = 0.12;
      rig.scale.setScalar(1.35);
      spidey.setRim(0x4cc4ff, 0.4);
    } else {
      post.bloom.strength = 0.75;
      post.bloom.threshold = 0.82;
      post.bloom.radius = 0.45;
      post.sv.uniforms.uHalftone.value = 0.22;
      rig.scale.setScalar(2.3);
      spidey.setRim(0xff9a2e, 0.45);
    }
  }

  // ── Per-phase updates ──
  const ANCHOR = V(0, 10.5, -2.5);
  function updatePortal(p, dt) {
    const wide = isWide();
    const push = easeInOut(seg(p, T.pushStart, T.swap));
    const settle = 1 - push;
    const frameX = wide ? -4.2 * settle : 0;
    const frameY = wide ? 0 : -1.8 * settle;
    camera.fov = lerp(wide ? 50 : 66, 100, push * push);
    camera.position.set(frameX + state.mouseS.x * 1.4 * settle, frameY + state.mouseS.y * 0.9 * settle, lerp(18, -18, push));
    camera.lookAt(frameX + state.mouseS.x * 0.3 * settle, frameY, camera.position.z - 12);
    camera.rotation.z = push * push * 0.6; // barrel roll into the tunnel

    const swingT = seg(p, T.swingStart, T.swingEnd);
    const power = 1 + seg(p, 0.02, T.swingEnd) * 0.8 + push * 2.5 + (state.hovered ? 0.3 : 0);
    portal.update(state.t, dt, { mouse: state.mouseS, power });

    // Spider-Man swings in on a web, down through the membrane.
    const th = lerp(1.4, 0.0, smooth(swingT));
    const L = 10.5;
    rig.position.set(lerp(-11, 0.2, swingT * swingT), ANCHOR.y - Math.cos(th) * L, ANCHOR.z + Math.sin(th) * L);
    rig.rotation.set(-th, 0, Math.sin(state.t * 3) * 0.05);
    spidey.root.rotation.set(0, Math.PI / 2 + 0.5 + swingT * 0.6, 0); // face the direction of travel
    spidey.setPose('swing');
    rig.visible = swingT > 0 && swingT < 1 && rig.position.z > -0.6;
    if (rig.visible) {
      rig.updateMatrixWorld(true);
      web.set(spidey.getWorldHand('r', tmpV2), ANCHOR, 1);
    } else web.hide();
  }

  const spPos = V();
  function updateCity(p, dt) {
    const tf = seg(p, T.swap, T.fallEnd);
    const wide = isWide();
    camera.fov = (wide ? 50 : 64) + 6 * seg(p, T.fallEnd, T.reveal[0]) * (1 - seg(p, T.reveal[1], T.about[0]));
    camera.rotation.z = 0;
    rig.visible = true;

    if (p < T.fallEnd) {
      // ── the drop ──
      const fallY = lerp(330, PERCH.y, Math.pow(tf, 1.45));
      spPos.set(lerp(3.5, PERCH.x, smooth(tf)), fallY, lerp(-5.5, PERCH.z, smooth(tf)));
      rig.position.copy(spPos);
      let pitch = Math.PI / 2 + Math.sin(state.t * 2.2) * 0.08;
      if (tf > 0.62) pitch = lerp(Math.PI / 2, Math.PI * 2, easeInOut(seg(tf, 0.62, 0.93)));
      rig.rotation.set(pitch, Math.PI + Math.sin(state.t * 0.7) * 0.3 * (1 - tf), 0);
      spidey.root.rotation.set(0, 0, 0);
      if (tf < 0.62) spidey.setPose('dive');
      else if (tf < 0.9) spidey.setPose('tuck');
      else spidey.setPose('land');
      fallCam(tf, spPos, camOut);
      web.hide();
    } else {
      // ── on the rooftop ──
      rig.position.copy(PERCH);
      rig.rotation.set(0, Math.PI, 0);
      spidey.root.rotation.set(0, 0, 0);
      spidey.root.position.y = Math.sin(state.t * 1.6) * 0.01;
      spidey.setPose(p < T.reveal[0] - 0.015 ? 'land' : 'perch');
      keyCam(p, camOut);

      // look at (and web-zip toward) the active billboard
      const sec = activeSection(p);
      const idx = ['about', 'projects', 'goals'].indexOf(sec);
      rig.updateMatrixWorld(true);
      const lookTarget = idx >= 0 ? city.billboards[idx].center : V(0, 62, -90);
      const head = spidey.j.head;
      head.parent.getWorldQuaternion(tmpQ).invert();
      tmpV.subVectors(lookTarget, head.getWorldPosition(tmpV2)).normalize().applyQuaternion(tmpQ);
      spidey.override('head', [clamp(-Math.asin(tmpV.y), -0.9, 0.4), clamp(Math.atan2(tmpV.x, tmpV.z), -1.0, 1.0), 0]);

      if (state.web) {
        const w = state.web;
        w.t += dt;
        const side = w.target.x < -1 ? 'l' : 'r';
        const sh = spidey.j[`${side}Shoulder`];
        sh.parent.getWorldQuaternion(tmpQ).invert();
        tmpV.subVectors(w.target, sh.getWorldPosition(tmpV2)).normalize().applyQuaternion(tmpQ);
        const aim = [Math.atan2(-tmpV.z, -tmpV.y), 0, Math.asin(clamp(tmpV.x, -1, 1))];
        spidey.override(`${side}Shoulder`, aim);
        spidey.override(`${side}Elbow`, [0, 0, 0]);
        const ext = w.t < 0.2 ? smooth(w.t / 0.2) : w.t < 1.4 ? 1 : 1 - smooth((w.t - 1.4) / 0.25);
        if (w.t > 0.12) web.set(spidey.getWorldHand(side, tmpV2), w.target, ext);
        if (w.t > 1.65) {
          state.web = null;
          web.hide();
        }
      } else web.hide();
    }

    // camera with parallax + shake
    camera.position.copy(camOut.pos);
    camera.lookAt(camOut.target);
    tmpV.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const par = p < T.fallEnd ? 0.6 : 1.4;
    camera.position.addScaledVector(tmpV, state.mouseS.x * par);
    camera.position.y += state.mouseS.y * par * 0.6;
    if (state.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * state.shake * 0.9;
      camera.position.y += (Math.random() - 0.5) * state.shake * 0.9;
    }
    camera.lookAt(camOut.target);

    city.update(state.t, dt, camera);

    // landing shockwave
    if (state.impactT >= 0) {
      state.impactT += dt;
      shock.forEach((m, i) => {
        const k = clamp((state.impactT - i * 0.12) / 0.8);
        m.scale.setScalar(1 + k * (16 + i * 6));
        m.material.opacity = k > 0 && k < 1 ? (1 - k) * (1 - k) * 0.8 : 0;
      });
      if (state.impactT > 1.2) state.impactT = -1;
    }

    // billboard hover
    raycaster.setFromCamera(state.mouse, camera);
    const hit = p > T.reveal[0] - 0.01 ? raycaster.intersectObjects(screens, false)[0] : null;
    const hb = hit ? hit.object.userData.billboard : null;
    const act = activeSection(p);
    // on the Projects board, clicking opens the project currently on screen
    const opensRepo = hb && hb.section.id === 'projects' && act === 'projects' && hb.currentLink;
    const label = !hb ? '' : opensRepo ? `Open ${hb.section.items.find((it) => it.link === hb.currentLink)?.name ?? 'project'} on GitHub ↗` : `${hb.section.title} ⟶`;
    if (hb !== state.hovered || label !== state.hoverLabel) {
      state.hovered = hb;
      state.hoverLabel = label;
      ui.setHover(!!hb, label);
    }
    for (const b of city.billboards) {
      b.bb.hover = b.bb === hb ? 1 : 0;
      b.bb.focus = act === b.section.id ? 1 : 0;
    }

  }

  // ── Event triggers when scroll crosses a mark ──
  const crossed = (mark) => state.prevP < mark && state.p >= mark;
  function triggers() {
    if (crossed(T.swingStart + 0.005)) {
      ui.sfx('THWIP!', { x: 30, y: 26, color: '#ffffff', rotate: -12 });
      audio.thwip();
    }
    if (crossed(T.pushStart + 0.03)) {
      ui.sfx('WHOOSH', { x: 62, y: 60, color: '#ffd400', size: 1.2, rotate: 6 });
      audio.whoosh();
    }
    if (crossed(T.swap) || (state.prevP >= T.swap && state.p < T.swap)) ui.flash(1);
    if (crossed(T.fallEnd - 0.002)) {
      state.impactT = 0;
      state.shake = 1;
      ui.sfx('THUD!', { x: 50, y: 62, color: '#ff2d6f', size: 1.5, rotate: -6 });
      ui.flash(0.15);
      audio.impact();
    }
    if (state.scene === 'city' && state.p >= T.fallEnd) {
      const sec = activeSection(state.p);
      const idx = ['about', 'projects', 'goals'].indexOf(sec);
      if (sec !== state.section) {
        state.section = sec;
        if (idx >= 0) {
          const b = city.billboards[idx];
          // anchor the web on the tower corner beside the billboard
          const anchor = b.center.clone().addScaledVector(b.right, -b.bb.width / 2 - 1).add(V(0, b.bb.height / 2 + 2, 0));
          state.web = { t: 0, target: anchor };
          audio.thwip();
        }
      }
    } else state.section = null;
  }

  // ── Main loop ──
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    state.t += dt;
    const max = scrollMax();
    const target = max > 0 ? clamp(window.scrollY / max) : 0;
    state.p = damp(state.p, target, reduced ? 20 : 3.4, dt);
    if (Math.abs(state.p - target) < 1e-5) state.p = target;
    state.mouseS.x = damp(state.mouseS.x, state.mouse.x, 3, dt);
    state.mouseS.y = damp(state.mouseS.y, state.mouse.y, 3, dt);
    state.shake = Math.max(0, state.shake - dt * 2.2);
    state.returnGlitch = Math.max(0, state.returnGlitch - dt * 1.4);
    const p = state.p;

    const inCity = p >= T.swap;
    useScene(inCity ? 'city' : 'portal');
    if (inCity) updateCity(p, dt);
    else updatePortal(p, dt);
    if (state.debugCam) state.debugCam(camera, rig, spidey);
    camera.updateProjectionMatrix();
    spidey.update(dt);
    triggers();

    // post-processing mood
    const warp = seg(p, T.pushStart + 0.06, T.swap);
    const arrive = 1 - seg(p, T.swap, T.swap + 0.025);
    const u = post.sv.uniforms;
    u.uTime.value = state.t;
    u.uGlitch.value = (inCity ? arrive * 0.7 : warp * warp * 0.9) + state.returnGlitch * 0.8;
    u.uAberration.value = 0.0012 + (inCity ? arrive * 0.006 : warp * 0.008) + state.shake * 0.006;
    u.uFlash.value = Math.max(0, 1 - Math.abs(p - T.swap) / 0.012) * 0.9 + (inCity ? city.lightning.flash * 0.08 : 0);

    const falling = inCity ? seg(p, T.swap, T.swap + 0.01) * (1 - seg(p, T.fallEnd - 0.03, T.fallEnd)) : 0;
    ui.update(p, { warp, falling, inCity });
    audio.setMix(inCity ? 1 : 0, inCity ? 0 : warp);

    post.composer.render();
    state.prevP = p;
    adaptQuality(dt);
    requestAnimationFrame(frame);
  }

  // Dynamic resolution: trade pixels for frame-rate on weaker GPUs.
  const quality = { pr, acc: 0, frames: 0, min: 0.6 };
  function setPixelRatio(v) {
    quality.pr = v;
    renderer.setPixelRatio(v);
    post.setSize(window.innerWidth, window.innerHeight, v);
  }
  function adaptQuality(dt) {
    quality.acc += dt;
    quality.frames++;
    if (quality.acc < 1.2) return;
    const avg = quality.acc / quality.frames;
    if (avg > 1 / 45 && quality.pr > quality.min) setPixelRatio(Math.max(quality.min, quality.pr - 0.15));
    else if (avg < 1 / 58 && quality.pr < pr) setPixelRatio(Math.min(pr, quality.pr + 0.1));
    quality.acc = 0;
    quality.frames = 0;
  }

  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    post.setSize(w, h, quality.pr);
    buildKeys();
  });

  // Pre-warm the city behind the loader: the first real render uploads every texture,
  // render target and the street reflection, which otherwise freezes the dimension jump.
  status('Warming up the city…', 96);
  await nextFrame();
  useScene('city');
  for (const p of [T.swap + 0.005, T.fallEnd + 0.06, mid(T.about)]) {
    updateCity(p, 1 / 60);
    camera.updateProjectionMatrix();
    post.composer.render();
  }
  renderer.getContext().finish();
  state.web = null;
  state.section = null;
  web.hide();
  useScene('portal');
  requestAnimationFrame(frame);

  status('Collider stable. Ready when you are.', 100);
  const actions = document.getElementById('loader-actions');
  actions.classList.add('ready');
  document.getElementById('enter').addEventListener(
    'click',
    () => {
      // the click is the user gesture browsers need before audio can start; it fades in softly
      audio.toggle(true);
      audio.thwip();
      document.getElementById('loader').classList.add('done');
      document.body.classList.remove('loading');
      gsap.from('.hero > *', { y: 40, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'back.out(1.6)', delay: 0.2 });
      gsap.from('.hud > *, .nav', { y: -20, opacity: 0, stagger: 0.06, duration: 0.6, delay: 0.4 });
    },
    { once: true }
  );

  // handy for debugging in the console
  window.__spiderverse = { state, camera, city, portal, spidey, navigate, post, audio };
}

boot();
