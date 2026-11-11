// The insurer's helmet camera: a cheap digital sensor behind a wide plastic lens. Strong barrel
// distortion with soft corners, auto-exposure that hunts (driven from the game), digital gain
// noise that climbs in the dark, a cold blue-grey toe and highlights that clip to orange, and
// compression smear when something is close. Runs last, in display space.

import * as THREE from 'three';

export const HelmetCamShader = {
  name: 'HelmetCam',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uExposure: { value: 1 }, // the auto-exposure multiplier
    uGain: { value: 0.3 }, // 0..1 sensor gain: more noise, more smear
    uGlitch: { value: 0 }, // 0..1 compression breakup (creatures push this up)
    uFade: { value: 1 }, // 0 = black (signal lost)
    uFrame: { value: 0 }, // integer frame counter for noise
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uExposure;
    uniform float uGain;
    uniform float uGlitch;
    uniform float uFade;
    uniform float uFrame;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    vec3 sampleLens(vec2 uv, float soft) {
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if (soft < 0.02) return c;
      vec2 o = px * (1.0 + soft * 3.0);
      vec3 b = texture2D(tDiffuse, uv + vec2(o.x, o.y)).rgb + texture2D(tDiffuse, uv + vec2(-o.x, o.y)).rgb
             + texture2D(tDiffuse, uv + vec2(o.x, -o.y)).rgb + texture2D(tDiffuse, uv + vec2(-o.x, -o.y)).rgb;
      return mix(c, b * 0.25, clamp(soft, 0.0, 1.0));
    }

    void main() {
      vec2 cc = vUv - 0.5;
      cc.x *= uRes.x / uRes.y;
      float r2 = dot(cc, cc);
      // wide cheap lens: strong barrel distortion, zoomed so the edges stay filled
      vec2 uv = vUv - 0.5;
      uv *= (1.0 + 0.16 * r2 + 0.06 * r2 * r2) * 0.9;
      uv += 0.5;

      // compression: 8 px macroblocks that smear sideways and hold stale colour
      float g = uGlitch;
      if (g > 0.01) {
        vec2 blk = floor(uv * uRes / 8.0);
        float fr = floor(uTime * 12.0);
        float hit = step(1.0 - g * 0.35, hash(blk * 0.37 + fr));
        float row = step(1.0 - g * 0.2, hash(vec2(blk.y, fr * 1.7)));
        uv.x += (hit * (hash(blk + fr) - 0.5) * 0.04 + row * 0.03 * (hash(vec2(fr, blk.y)) - 0.3)) * g;
        uv = mix(uv, (blk + 0.5) * 8.0 / uRes, hit * 0.85);
      }

      // corners go soft; a little lateral colour at the very edge
      float soft = smoothstep(0.12, 0.42, r2);
      vec2 ca = (uv - 0.5) * 0.004 * soft;
      vec3 col;
      col.r = sampleLens(uv + ca, soft).r;
      col.g = sampleLens(uv, soft).g;
      col.b = sampleLens(uv - ca, soft).b;

      // exposure (the camera's own, hunting) and sensor response
      col *= uExposure;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // cold blue-grey toe: shadows sit on a slate floor, never true black
      vec3 toe = vec3(0.028, 0.034, 0.044);
      col = toe + col * (1.0 - toe * 1.6);
      col = mix(vec3(lum), col, 0.78) * vec3(0.95, 1.0, 1.06);
      // highlights clip hard and go orange, like a cheap sensor's red channel saturating first
      float hi = smoothstep(0.62, 1.05, lum);
      col = mix(col, vec3(1.0, 0.72, 0.42) * (0.85 + 0.15 * lum), hi * 0.55);
      col = min(col, vec3(1.0, 0.93, 0.84));

      // digital gain noise: per-pixel luma speckle plus a softer colour speckle, worst in the
      // dark (frame-varying offsets keep it from settling into a visible grid)
      vec2 fc = gl_FragCoord.xy + vec2(mod(uFrame * 37.0, 113.0), mod(uFrame * 53.0, 127.0));
      float n1 = hash(fc * 1.003) - 0.5;
      float n2 = hash(fc * 0.731 + 17.0) - 0.5;
      float n3 = hash(fc * 1.379 + 41.0) - 0.5;
      float amt = (0.02 + uGain * 0.085) * (1.15 - min(lum, 1.0) * 0.9);
      col += (n1 + (hash(fc * 0.5 + 3.0) - 0.5) * 0.6) * amt;
      col += vec3(n2, -0.5 * (n2 + n3), n3) * amt * 0.55;

      // vignette: heavy, a little oval
      float vig = smoothstep(1.05, 0.25, length(cc * vec2(0.9, 1.15)));
      col *= mix(0.3, 1.0, vig);

      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0) * uFade, 1.0);
    }
  `,
};
