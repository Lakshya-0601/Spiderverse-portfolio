import * as THREE from 'three';
import { rng } from '../core/util.js';

// Instanced traffic: every car is 5 instances (body, cabin, headlights,
// taillights, light-spill on the wet road). ~5 draw calls total.
export class Traffic {
  constructor({ count, pitch, extent, roadsN, lightTex }) {
    this.count = count;
    this.extent = extent;
    const R = rng(77);
    this.cars = [];
    const lanes = [];
    for (let i = -roadsN; i < roadsN; i++) {
      const c = (i + 0.5) * pitch;
      lanes.push({ axis: 'x', c, dir: 1, off: 2.6 }, { axis: 'x', c, dir: -1, off: -2.6 });
      lanes.push({ axis: 'z', c, dir: 1, off: -2.6 }, { axis: 'z', c, dir: -1, off: 2.6 });
    }
    const paints = ['#ffcc00', '#ffcc00', '#c9c9d4', '#1e1e28', '#7a0d1a', '#16305e', '#e8e8f0', '#2b2b33'];
    for (let i = 0; i < count; i++) {
      const lane = lanes[(R() * lanes.length) | 0];
      this.cars.push({
        lane,
        s: (R() - 0.5) * extent,
        speed: 9 + R() * 9,
        color: new THREE.Color(paints[(R() * paints.length) | 0]),
        len: 4.2 + R() * 0.8,
        bus: R() < 0.06,
      });
    }

    const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.25, envMapIntensity: 1.2 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b0d14, metalness: 0.9, roughness: 0.1, envMapIntensity: 1.5 });
    this.body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paint, count);
    this.cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glass, count);
    this.head = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.2), side: THREE.DoubleSide }),
      count
    );
    this.tail = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.15, 0.1), side: THREE.DoubleSide }),
      count
    );
    const spillGeo = new THREE.PlaneGeometry(1, 1);
    spillGeo.rotateX(-Math.PI / 2);
    this.spill = new THREE.InstancedMesh(
      spillGeo,
      new THREE.MeshBasicMaterial({
        map: lightTex, color: new THREE.Color(0.9, 0.85, 0.7), transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      count
    );
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.cars[i].color);
    this.meshes = [this.body, this.cabin, this.head, this.tail, this.spill];
    for (const m of this.meshes) m.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
  }

  update(dt) {
    const half = this.extent / 2;
    const { _m: m, _q: q, _p: p, _s: s, _e: e } = this;
    for (let i = 0; i < this.count; i++) {
      const c = this.cars[i];
      c.s += c.speed * c.lane.dir * dt;
      if (c.s > half) c.s -= this.extent;
      if (c.s < -half) c.s += this.extent;
      const L = c.bus ? 10 : c.len;
      const H = c.bus ? 3.2 : 0.75;
      // world position + heading
      const x = c.lane.axis === 'x' ? c.s : c.lane.c + c.lane.off;
      const z = c.lane.axis === 'x' ? c.lane.c + c.lane.off : c.s;
      const yaw = c.lane.axis === 'x' ? (c.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : c.lane.dir > 0 ? 0 : Math.PI;
      e.set(0, yaw, 0);
      q.setFromEuler(e);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);

      p.set(x, 0.35 + H / 2, z); s.set(2.0, H, L);
      this.body.setMatrixAt(i, m.compose(p, q, s));
      p.set(x - fx * 0.3, 0.35 + H + 0.3, z - fz * 0.3); s.set(c.bus ? 0.01 : 1.7, c.bus ? 0.01 : 0.6, L * 0.5);
      this.cabin.setMatrixAt(i, m.compose(p, q, s));
      p.set(x + fx * (L / 2 + 0.02), 0.75, z + fz * (L / 2 + 0.02)); s.set(1.7, 0.22, 1);
      this.head.setMatrixAt(i, m.compose(p, q, s));
      p.set(x - fx * (L / 2 + 0.02), 0.8, z - fz * (L / 2 + 0.02)); s.set(1.8, 0.18, 1);
      this.tail.setMatrixAt(i, m.compose(p, q, s));
      p.set(x + fx * (L / 2 + 5), 0.06, z + fz * (L / 2 + 5)); s.set(4.5, 1, 11);
      this.spill.setMatrixAt(i, m.compose(p, q, s));
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}
