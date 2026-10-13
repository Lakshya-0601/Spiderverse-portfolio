import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The "Spider-Verse" lens: chromatic misprint, Ben-Day halftone dots,
// block glitching during dimension jumps, film grain and a vignette.
const SpiderVerseShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAberration: { value: 0.0015 },
    uGlitch: { value: 0 },
    uHalftone: { value: 0.18 },
    uFlash: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.05 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAberration, uGlitch, uHalftone, uFlash, uVignette, uGrain;
    uniform vec2 uResolution;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;

      // Blocky horizontal tearing — animated "on twos" (stepped time) like the films.
      float stepT = floor(uTime * 12.0);
      if (uGlitch > 0.0) {
        float row = floor(uv.y * 24.0);
        float r = hash(vec2(row, stepT));
        float tear = step(1.0 - uGlitch * 0.6, r) * (hash(vec2(stepT, row)) - 0.5) * 0.18 * uGlitch;
        uv.x += tear;
        float block = hash(floor(uv * vec2(12.0, 8.0)) + stepT);
        uv += step(1.0 - uGlitch * 0.15, block) * (vec2(hash(vec2(block, 1.0)), hash(vec2(block, 2.0))) - 0.5) * 0.05;
      }

      // Radial chromatic aberration = offset print plates.
      vec2 dir = uv - 0.5;
      float amt = uAberration + uGlitch * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * amt * 2.0 + vec2(amt * 0.6, 0.0)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * amt * 2.0 - vec2(amt * 0.6, 0.0)).b;

      // Ben-Day halftone dots, stronger in mid-tones.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec2 px = uv * uResolution;
      float a = 0.7854;
      mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
      vec2 cell = rot * px / 6.0;
      float d = length(fract(cell) - 0.5);
      float radius = sqrt(clamp(1.0 - lum, 0.0, 1.0)) * 0.55;
      float dots = smoothstep(radius, radius - 0.12, d);
      float midMask = smoothstep(0.03, 0.2, lum) * (1.0 - smoothstep(0.55, 0.9, lum));
      col *= 1.0 - dots * uHalftone * midMask;

      // Grain
      col += (hash(px + fract(uTime) * 100.0) - 0.5) * uGrain;

      // Vignette
      float v = smoothstep(0.85, 0.2, length(dir) * uVignette);
      col *= mix(0.55, 1.0, v);

      col *= uTint;
      col = mix(col, vec3(1.0, 0.97, 0.9), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera, { mobile }) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.9, 0.55, 0.62);
  if (mobile) bloom.resolution.set(size.x / 2, size.y / 2);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  const sv = new ShaderPass(SpiderVerseShader);
  composer.addPass(sv);

  const setSize = (w, h, pr) => {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    sv.uniforms.uResolution.value.set(w * pr, h * pr);
  };

  return { composer, renderPass, bloom, sv, setSize };
}
