import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();

// A glowing web strand between two world points. `extend` (0..1) animates
// the strand shooting out from the start point.
export class WebLine {
  constructor(radius = 0.025) {
    const geo = new THREE.CylinderGeometry(radius, radius * 0.6, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.4), transparent: true, opacity: 0.95 })
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(from, to, extend = 1) {
    tmp.subVectors(to, from);
    const len = tmp.length() * extend;
    if (len < 0.01) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.copy(from);
    this.mesh.quaternion.setFromUnitVectors(UP, tmp.normalize());
    this.mesh.scale.set(1, len, 1);
  }

  hide() {
    this.mesh.visible = false;
  }
}
