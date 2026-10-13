import * as THREE from 'three';

// GPU rain: line segments whose positions are computed entirely in the
// vertex shader and wrapped around a box that follows the camera.
export class Rain {
  constructor({ count = 9000, area = 90, height = 70 } = {}) {
    const pos = new Float32Array(count * 2 * 3);
    const tip = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      tip[i * 2] = 0;
      tip[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('tip', new THREE.BufferAttribute(tip, 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uArea: { value: area },
        uHeight: { value: height },
        uSpeed: { value: 38 },
        uLen: { value: 1.1 },
        uWind: { value: new THREE.Vector2(0.18, 0.05) },
        uColor: { value: new THREE.Color(0.75, 0.85, 1.2) },
        uOpacity: { value: 0.5 },
      },
      vertexShader: /* glsl */ `
        attribute float tip;
        uniform float uTime, uArea, uHeight, uSpeed, uLen;
        uniform vec3 uCenter;
        uniform vec2 uWind;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          float speed = uSpeed * (0.85 + 0.3 * fract(p.x * 91.7));
          vec3 w;
          w.x = uCenter.x + mod(p.x * uArea - uCenter.x, uArea) - uArea * 0.5;
          w.z = uCenter.z + mod(p.z * uArea - uCenter.z, uArea) - uArea * 0.5;
          w.y = uCenter.y + mod(p.y * uHeight - uTime * speed - uCenter.y, uHeight) - uHeight * 0.5;
          vec3 vel = normalize(vec3(uWind.x, -1.0, uWind.y));
          w -= vel * uLen * tip;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          float d = length(mv.xyz);
          vAlpha = smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(uArea * 0.25, uArea * 0.5, d)) * (0.4 + 0.6 * tip);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vAlpha;
        void main(){ gl_FragColor = vec4(uColor, vAlpha * uOpacity); }`,
    });
    this.mesh = new THREE.LineSegments(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  update(t, cameraPos) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uCenter.value.copy(cameraPos);
  }
}
