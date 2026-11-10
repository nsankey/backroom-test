// The camcorder look: soft lens, chromatic fringing, chroma bleed, grain, scanlines, a crushed
// and tinted grade, vignette and the occasional tracking wobble. Runs last, in display space.

import * as THREE from 'three';

export const CamcorderShader = {
  name: 'Camcorder',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uGrain: { value: 0.085 },
    uTracking: { value: 0 }, // 0..1 strength of a tracking glitch (hunters push this up)
    uFade: { value: 1 }, // 0 = black
    uDistort: { value: 0 }, // extra warp, used when something is close
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
    uniform float uGrain;
    uniform float uTracking;
    uniform float uFade;
    uniform float uDistort;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }
    float noise1(float x) {
      float i = floor(x); float f = fract(x);
      return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), smoothstep(0.0, 1.0, f));
    }
    vec3 rgb2yiq(vec3 c) {
      return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312)));
    }
    vec3 yiq2rgb(vec3 c) {
      return vec3(c.x + 0.956 * c.y + 0.621 * c.z, c.x - 0.272 * c.y - 0.647 * c.z, c.x - 1.106 * c.y + 1.703 * c.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      // gentle barrel distortion
      uv = 0.5 + cc * (1.0 + 0.045 * r2 + uDistort * 0.25 * r2);

      // tracking wobble: a band rolling up the frame, plus line jitter
      float band = smoothstep(0.36, 0.5, abs(fract(uv.y * 0.6 - uTime * 0.11) - 0.5));
      float track = uTracking * (band + 0.06);
      float lineJit = (hash(vec2(floor(uv.y * uRes.y * 0.5), floor(uTime * 30.0))) - 0.5);
      uv.x += lineJit * (0.0009 + track * 0.02) + sin(uv.y * 30.0 + uTime * 2.0) * 0.0006;

      // chromatic fringe, stronger at the edges
      vec2 dir = cc * (0.0035 + 0.006 * r2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;

      // soft lens: blend in a small blur
      vec2 px = 1.0 / uRes;
      vec3 blur = texture2D(tDiffuse, uv + vec2(px.x * 1.5, 0.0)).rgb
                + texture2D(tDiffuse, uv - vec2(px.x * 1.5, 0.0)).rgb
                + texture2D(tDiffuse, uv + vec2(0.0, px.y * 1.5)).rgb
                + texture2D(tDiffuse, uv - vec2(0.0, px.y * 1.5)).rgb;
      col = mix(col, blur * 0.25, 0.45);

      // chroma bleed: smear colour (not brightness) to the right, like tape
      vec3 yiq = rgb2yiq(col);
      vec3 chroma = vec3(0.0);
      for (int k = 1; k <= 4; k++) {
        chroma += rgb2yiq(texture2D(tDiffuse, uv - vec2(px.x * float(k) * 2.5, 0.0)).rgb);
      }
      chroma *= 0.25;
      yiq.yz = mix(yiq.yz, chroma.yz, 0.6) * 0.82;
      col = yiq2rgb(yiq);

      // grade: lift blacks toward green-grey, compress highlights, tint
      col = col * vec3(0.96, 1.02, 0.9) + vec3(0.016, 0.02, 0.014);
      col = col / (1.0 + col * 0.1);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 0.86);
      col = (col - 0.45) * 1.14 + 0.45;
      col = max(col, vec3(0.012, 0.016, 0.01));

      // grain, stronger in the shadows
      float g = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 1000.0) - 0.5;
      float g2 = hash(gl_FragCoord.xy * 0.5 + fract(uTime * 3.7) * 500.0) - 0.5;
      col += (g * 0.7 + g2 * 0.5) * uGrain * (1.15 - lum * 0.8);

      // scanlines and a faint rolling brightness bar
      col *= 0.965 + 0.035 * sin(gl_FragCoord.y * 3.14159);
      col *= 1.0 + 0.025 * sin(uv.y * 6.0 - uTime * 1.3);
      // brightness flutter
      col *= 0.985 + 0.03 * noise1(uTime * 9.0);

      // vignette
      float vig = smoothstep(0.85, 0.2, length(cc * vec2(1.0, 0.85)));
      col *= mix(0.42, 1.0, vig);

      // tracking band: noisy white streaks
      float row = floor(uv.y * uRes.y * 0.25);
      float fr = floor(uTime * 24.0);
      float seg = hash(vec2(floor(uv.x * 26.0 + hash(vec2(row, fr)) * 26.0), row + fr * 3.1));
      float spark = hash(gl_FragCoord.xy + fr);
      col += track * step(0.88, hash(vec2(row, fr))) * step(0.45, seg) * (0.12 + 0.3 * spark);

      // out-of-frame black
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0) * uFade, 1.0);
    }
  `,
};
