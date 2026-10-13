import * as THREE from 'three';
import { toonGradient, webTexture, spiderEmblem } from './textures.js';

// A stylised, fully procedural Spider-Man (Amazing Spider-Man red/blue suit),
// cel-shaded with inverted-hull ink outlines. Joints are plain Object3Ds so
// poses are just sets of Euler rotations that we blend between.

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

export class SpiderMan {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'spiderman';
    this.j = {};
    this.pose = {};
    this._stepClock = 0;
    this.onTwos = true;

    const gradientMap = toonGradient();
    const web = webTexture('#c8102e', '#1c0008');
    const webArm = webTexture('#c8102e', '#1c0008', 10, 8);
    const red = new THREE.MeshToonMaterial({ color: 0xffffff, map: web, gradientMap });
    const redArm = new THREE.MeshToonMaterial({ color: 0xffffff, map: webArm, gradientMap });
    const blue = new THREE.MeshToonMaterial({ color: 0x1a3fb8, gradientMap });
    const ink = new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.BackSide });
    const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.45) });
    this.materials = { red, blue, lens };

    // `outline` is the ink thickness in world units.
    const part = (geo, mat, parent, pos = [0, 0, 0], outline = 0.016) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      parent.add(m);
      if (outline) {
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        const o = new THREE.Mesh(geo, ink);
        o.scale.setScalar(1 + outline / Math.max(0.05, geo.boundingSphere.radius));
        m.add(o);
      }
      return m;
    };
    const capsule = (r, len) => {
      const g = new THREE.CapsuleGeometry(r, len, 6, 14);
      g.computeBoundingSphere();
      g.boundingSphere.radius = r;
      return g;
    };
    const joint = (name, parent, pos) => {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(...pos);
      parent.add(o);
      this.j[name] = o;
      return o;
    };

    // Pelvis sits 1.0 above the feet.
    const hips = joint('hips', this.root, [0, 1.0, 0]);
    part(new THREE.SphereGeometry(0.17, 18, 14).scale(1.15, 0.8, 0.85), blue, hips, [0, 0, 0]);

    const spine = joint('spine', hips, [0, 0.05, 0]);
    const torso = part(capsule(0.17, 0.32), red, spine, [0, 0.3, 0]);
    torso.scale.set(1.28, 1, 0.82);
    const belly = part(capsule(0.15, 0.12), blue, spine, [0, 0.12, 0], 0);
    belly.scale.set(1.15, 1, 0.9);
    // chest emblem
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ map: spiderEmblem(), transparent: true, depthWrite: false })
    );
    emblem.position.set(0, 0.36, 0.142);
    spine.add(emblem);

    // neck + head (sphere rotated so its UV pole faces forward → radial web on the face)
    const neck = part(capsule(0.06, 0.06), red, spine, [0, 0.58, 0], 0);
    neck.rotation.x = 0.1;
    const head = joint('head', spine, [0, 0.62, 0]);
    const headGeo = new THREE.SphereGeometry(0.135, 28, 22);
    headGeo.rotateX(Math.PI / 2);
    headGeo.scale(0.92, 1.12, 1.0);
    headGeo.computeBoundingSphere();
    part(headGeo, red, head, [0, 0.13, 0.01], 0.016);
    // Big angular lenses
    for (const s of [1, -1]) {
      const eyeGeo = new THREE.SphereGeometry(1, 20, 12);
      eyeGeo.scale(0.058, 0.04, 0.02);
      const ring = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x050308 }));
      ring.position.set(0.052 * s, 0.155, 0.122);
      ring.rotation.set(0.15, 0.38 * s, -0.5 * s);
      ring.scale.setScalar(1.28);
      head.add(ring);
      const eye = new THREE.Mesh(eyeGeo, lens);
      eye.position.set(0.054 * s, 0.155, 0.128);
      eye.rotation.copy(ring.rotation);
      head.add(eye);
    }

    // Arms
    for (const [side, s] of [['l', 1], ['r', -1]]) {
      const sh = joint(`${side}Shoulder`, spine, [0.25 * s, 0.48, 0]);
      part(new THREE.SphereGeometry(0.085, 14, 10), red, sh, [0, 0, 0], 0.02);
      part(capsule(0.066, 0.24), blue, sh, [0, -0.17, 0]);
      const el = joint(`${side}Elbow`, sh, [0, -0.33, 0]);
      part(capsule(0.056, 0.24), redArm, el, [0, -0.15, 0]);
      part(new THREE.SphereGeometry(0.062, 12, 10).scale(1, 1.15, 0.8), red, el, [0, -0.33, 0], 0.018);
      const hand = new THREE.Object3D();
      hand.position.set(0, -0.36, 0);
      el.add(hand);
      this.j[`${side}Hand`] = hand;
    }

    // Legs
    for (const [side, s] of [['l', 1], ['r', -1]]) {
      const hp = joint(`${side}Hip`, hips, [0.105 * s, -0.04, 0]);
      part(capsule(0.088, 0.34), blue, hp, [0, -0.22, 0]);
      const kn = joint(`${side}Knee`, hp, [0, -0.46, 0]);
      part(capsule(0.072, 0.34), red, kn, [0, -0.22, 0]);
      const foot = part(new THREE.BoxGeometry(0.11, 0.07, 0.24), red, kn, [0, -0.46, 0.05], 0.02);
      foot.geometry.computeBoundingSphere();
    }

    this.setPose('idle', 1);
    Object.assign(this.pose, structuredClone(POSES.idle));
    this._target = structuredClone(POSES.idle);
    this.apply(this.pose);
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
    this.j.hips.position.y = 1.0 + p.hipsY;
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
