// Outer space: the one sky every craft shares. A starfield in two layers, a faint band of the
// galaxy, a little nebula dust, and a big ringless planet lit from below by a sun the hull
// hides. Used by the sky dome and by every porthole (which look at the same sky by direction).
// The sky turns slowly: the derelicts are in orbit, and so is everything docked to them.

import * as THREE from 'three';

const SPACE_GLSL = /* glsl */ `
  uniform mat3 uSkyRot;
  float sh(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  vec3 sh3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  float vn(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sh(i), sh(i + vec3(1, 0, 0)), f.x), mix(sh(i + vec3(0, 1, 0)), sh(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(sh(i + vec3(0, 0, 1)), sh(i + vec3(1, 0, 1)), f.x), mix(sh(i + vec3(0, 1, 1)), sh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.07) * 0.125 + vn(p * 8.11) * 0.0625; }

  // one layer of stars: a point in some of the grid cells around the ray, a soft disc each
  vec3 stars(vec3 d, float scale, float density, float size, float bright) {
    vec3 p = d * scale;
    vec3 c = floor(p);
    vec3 r = sh3(c);
    if (r.x > density) return vec3(0.0);
    vec3 s = c + 0.25 + 0.5 * sh3(c + 7.0);
    vec3 q = s - p;
    float perp = length(q - d * dot(q, d));
    float k = exp(-pow(perp / size, 2.0));
    float b = bright * pow(r.y, 3.0) + bright * 0.08;
    // colour by temperature: mostly white, some blue, a few amber and red
    vec3 col = r.z < 0.55 ? vec3(0.9, 0.95, 1.0) : r.z < 0.8 ? vec3(0.65, 0.78, 1.0) : r.z < 0.95 ? vec3(1.0, 0.82, 0.55) : vec3(1.0, 0.55, 0.4);
    return col * k * b;
  }

  vec3 space(vec3 dir) {
    vec3 d = normalize(uSkyRot * dir);
    vec3 c = vec3(0.0015, 0.0018, 0.0026);
    // the galaxy's band, tilted across the sky, with dark lanes of dust in it
    vec3 bandN = normalize(vec3(0.35, 0.82, -0.45));
    float bd = dot(d, bandN);
    float band = exp(-bd * bd / 0.035);
    float dust = fbm(d * 5.0 + 3.0);
    float lane = smoothstep(0.42, 0.62, fbm(d * 9.0 + 11.0));
    c += vec3(0.020, 0.019, 0.024) * band * (0.4 + dust) * (1.0 - 0.75 * lane);
    // thin nebula: two faint colours that never quite meet
    float neb = fbm(d * 2.2 + 21.0);
    c += vec3(0.012, 0.004, 0.016) * smoothstep(0.55, 0.85, neb);
    c += vec3(0.002, 0.010, 0.012) * smoothstep(0.6, 0.9, fbm(d * 3.1 - 5.0));
    // stars: many faint, fewer bright, thicker along the band
    c += stars(d, 90.0, 0.06 + 0.3 * band, 0.16, 0.3);
    c += stars(d.yzx, 34.0, 0.1, 0.075, 1.3);
    c += stars(d.zxy, 13.0, 0.12, 0.04, 1.8);

    // the planet: a sphere at unit distance, lit by a sun below the hull
    // (placed so that at the start of a shift it hangs over the open side of the docking deck)
    vec3 P = normalize(vec3(0.902, 0.429, -0.05));
    vec3 S = normalize(vec3(0.522, -0.553, -0.649)); // below the hull: the planet is lit from underneath
    float R = 0.34;
    float tca = dot(d, P);
    float d2 = 1.0 - tca * tca;
    float miss = sqrt(max(d2, 0.0)) - R;
    if (tca > 0.0 && miss < 0.0) {
      float t = tca - sqrt(R * R - d2);
      vec3 N = normalize(d * t - P);
      float l = dot(N, S);
      float day = smoothstep(-0.08, 0.35, l);
      // a cold, banded world with no land: belts of grey-green cloud drawn out by its winds,
      // pale storms at the edges of the belts
      vec3 u = N * 3.0;
      float lat = N.y * 0.85 + N.x * 0.3;
      float wob = fbm(u * 1.5 + 7.0) * 0.6;
      float belts = 0.5 + 0.5 * sin(lat * 15.0 + wob * 5.0);
      float fine = fbm(vec3(lat * 40.0, u.x * 2.0, u.z * 2.0));
      vec3 surf = mix(vec3(0.03, 0.04, 0.045), vec3(0.34, 0.31, 0.24), clamp(pow(belts, 1.3) * 0.9 + (fine - 0.5) * 0.5, 0.0, 1.0));
      surf = mix(surf, vec3(0.16, 0.22, 0.24), smoothstep(0.55, 0.7, fbm(u * 0.8 + 9.0)) * 0.5);
      surf = mix(surf, vec3(0.4, 0.39, 0.35), smoothstep(0.74, 0.8, fbm(u * 2.5 + 3.0)) * 0.6);
      c = surf * (day * 0.9 + 0.003);
      // the terminator's warm edge and the atmosphere's limb
      float rim = pow(1.0 - max(dot(N, -d), 0.0), 3.0);
      c += vec3(0.3, 0.45, 0.6) * rim * smoothstep(-0.25, 0.3, l) * 0.35;
      c += vec3(0.5, 0.25, 0.08) * exp(-l * l / 0.004) * 0.05;
    } else if (tca > 0.0 && miss < 0.05) {
      // haze just off the limb, on the lit side
      vec3 N = normalize(d - P);
      float l = dot(N, S);
      c += vec3(0.18, 0.36, 0.7) * exp(-miss / 0.012) * smoothstep(-0.2, 0.5, l) * 0.35;
    }
    // the sun's glare from below the hull, where portholes can still catch it
    float sd = max(dot(d, S), 0.0);
    c += vec3(1.0, 0.9, 0.75) * (pow(sd, 3000.0) * 40.0 + pow(sd, 60.0) * 0.12 + pow(sd, 8.0) * 0.012);
    return c;
  }
`;

export const skyUniforms = { uSkyRot: { value: new THREE.Matrix3() } };

/** The sky dome: drawn behind everything, unaffected by fog. */
export function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vDir;
      ${SPACE_GLSL}
      void main() { gl_FragColor = vec4(space(normalize(vDir)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
}

/**
 * A porthole's glass: the same sky, looked at through the hull, behind a little grime and a
 * cold reflection. Ignores baked light (there is nothing out there to light it).
 */
export function viewportMaterial() {
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: skyUniforms,
    vertexShader: `varying vec3 vW; varying vec2 vUv; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; varying vec2 vUv;
      ${SPACE_GLSL}
      void main() {
        vec3 d = normalize(vW - cameraPosition);
        vec3 c = space(d) * 1.4;
        // grime and a sheen: the glass is thick, old, and has not been cleaned in years; the
        // room's light catches its curve in one soft highlight (vUv is metres from the centre)
        float g = fbm(vec3(vUv * 30.0, 1.0));
        c = c * (0.7 + 0.3 * g) + vec3(0.008, 0.01, 0.013) * (0.5 + g);
        vec2 hq = vUv - vec2(-0.07, 0.08);
        c += vec3(0.05, 0.055, 0.06) * exp(-dot(hq, hq) / 0.003);
        c += vec3(0.012, 0.014, 0.016) * smoothstep(0.12, 0.3, length(vUv));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  mat.userData.kind = 'sky';
  return mat;
}

/** Turn the sky: the derelict's orbit, a full turn every ~70 minutes about a tilted axis. */
const AXIS = new THREE.Vector3(0.25, 1, 0.15).normalize();
const _m4 = new THREE.Matrix4();
export function turnSky(t) {
  _m4.makeRotationAxis(AXIS, t * 0.0015);
  skyUniforms.uSkyRot.value.setFromMatrix4(_m4);
}
