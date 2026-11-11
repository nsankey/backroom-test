// Materials: Lambert surfaces lit by baked per-vertex light (plus the dynamic flashlight),
// and glow surfaces that show their baked emissive colour. Textures come from a worker.

import * as THREE from 'three';
import { viewportMaterial } from './space.js';

// name -> { tex, scale: metres per texture repeat [u, v], color }
const DEFS = {
  // floors
  sealedConcrete: { tex: 'sealedConcrete', scale: [4, 4] },
  concrete: { tex: 'concrete', scale: [2, 2] },
  asphalt: { tex: 'asphalt', scale: [3, 3] },
  freezerFloor: { tex: 'freezerFloor', scale: [2.5, 2.5] },
  carpetTile: { tex: 'carpetTile', scale: [2, 2] },
  lino: { tex: 'lino', scale: [2.5, 2.5] },
  quarryTile: { tex: 'quarryTile', scale: [1.2, 1.2] },
  diamondPlate: { tex: 'diamondPlate', scale: [0.8, 0.8] },
  steelGrate: { tex: 'steelGrate', scale: [0.5, 0.5] },
  // walls
  paintBlock: { tex: 'paintBlock', scale: [1.6, 1.6] },
  paintBlockTeal: { tex: 'paintBlockTeal', scale: [1.6, 1.6] },
  panelWhite: { tex: 'panelWhite', scale: [2.4, 2.4] },
  corrugated: { tex: 'corrugated', scale: [1.6, 1.6] },
  facade: { tex: 'facade', scale: [3, 3] },
  plasterOffice: { tex: 'plasterOffice', scale: [2, 2] },
  partition: { tex: 'partition', scale: [0.8, 0.8] },
  vanInterior: { tex: 'vanInterior', scale: [1.2, 1.2] },
  vanPaint: { tex: 'vanPaint', scale: [1.5, 1.5] },
  // ceilings
  ceilTile: { tex: 'ceilTile', scale: [1.2, 1.2] },
  deckSteel: { tex: 'deckSteel', scale: [2.4, 2.4] },
  // props
  palletWood: { tex: 'palletWood', scale: [1.2, 1.2] },
  cardboard: { tex: 'cardboard', scale: [0.6, 0.6] },
  paper: { tex: 'paper', scale: [0.25, 0.3] },
  laminate: { tex: 'laminate', scale: [1, 1] },
  hazard: { tex: 'hazard', scale: [0.6, 0.6] },
  stripPlastic: { tex: 'stripPlastic', scale: [1.2, 2.4] },
  doorFrame: { tex: 'doorFrame', scale: [1, 1] },
  threshold: { tex: 'threshold', scale: [0.5, 0.5] },
  stainless: { tex: 'stainless', scale: [0.8, 0.8], color: 0x9a9c98 },
  tankSteel: { tex: 'stainless', scale: [1.6, 1.6], color: 0x8a8e8a },
  noticeboard: { tex: 'noticeboard', scale: [1, 1] },
  timecards: { tex: 'timecards', scale: [1, 1] },
  bottles: { tex: 'bottles', scale: [0.4, 0.4] },
  signs: { tex: 'signs', scale: [1, 1] },
  baseboard: { color: 0x2c2c2a },
  // untextured
  chrome: { color: 0xb8bcbe },
  brass: { color: 0xa08640 },
  blackPlastic: { color: 0x1c1c1a },
  beigePlastic: { color: 0xc4bca4 },
  rubber: { color: 0x141414 },
  troffer: { color: 0xd8d6cc },
  metalGrey: { color: 0x7a7e7a },
  steelDark: { color: 0x34393a },
  steelPaint: { color: 0x3f6f6c }, // Halvard teal racking
  oxblood: { color: 0x6e2420 },
  safetyYellow: { color: 0xc89a26 },
  enamelGreen: { color: 0x2f4a3e },
  glass: { color: 0x0e1214 },
  ice: { color: 0xd8e4ea },
  copper: { color: 0xa0603a },
  // glow (emissive) surfaces: colour comes from the baked vertex colour
  lamp: { glow: true },
  shade: { glow: true, color: 0xffffff },
  signsGlow: { glow: true, tex: 'signsGlow', scale: [1, 1] },
  vendingGlow: { glow: true, tex: 'vendingGlow', scale: [1, 1] },
  screen: { glow: true, tex: 'screen', scale: [1, 1], animate: 'flicker' },
  // a porthole's glass: shows the sky by view direction
  viewport: { sky: true },
};

// textures whose UVs are explicit (uvRect) rather than metres
const EXPLICIT_UV = new Set(['signs', 'signsGlow', 'vendingGlow', 'screen', 'timecards', 'noticeboard']);

export class MaterialLibrary {
  constructor(renderer) {
    this.renderer = renderer;
    this.textures = new Map();
    this.base = new Map();
    this.worker = new Worker(new URL('./textures.worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.worker.onmessage = (e) => this._onTexture(e.data);
    this.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    // shared uniforms used by every material
    // uDark: a moving patch where the baked light goes out (x, z, radius, strength): the Unlit
    this.shared = { uTime: { value: 0 }, uDark: { value: new THREE.Vector4(0, 0, 1, 0) } };
  }

  /** Request every texture up front; resolves when all are loaded. */
  loadAll() {
    const names = new Set();
    for (const d of Object.values(DEFS)) if (d.tex) names.add(d.tex);
    names.add('noiseGrain');
    return Promise.all([...names].map((n) => this.texture(n)));
  }

  texture(name) {
    if (this.textures.has(name)) return Promise.resolve(this.textures.get(name));
    if (this.pending.has(name)) return this.pending.get(name).promise;
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    this.pending.set(name, { promise, resolve });
    this.worker.postMessage({ name });
    return promise;
  }

  _onTexture({ name, bitmap, error }) {
    const p = this.pending.get(name);
    if (error) {
      console.error('texture', name, error);
      p?.resolve(null);
      return;
    }
    const t = new THREE.Texture(bitmap);
    t.flipY = false;
    t.colorSpace = name === 'noiseGrain' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.anisotropy;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    this.textures.set(name, t);
    p?.resolve(t);
  }

  /** The shared base material for a name (cells clone it to get their own uniforms). */
  get(name, glow = false) {
    const key = (glow ? 'glow:' : '') + name;
    let m = this.base.get(key);
    if (m) return m;
    const def = DEFS[name] || { color: 0xff00ff };
    m = def.sky ? viewportMaterial() : glow || def.glow ? this._makeGlow(name, def) : this._makeLit(name, def);
    this.base.set(key, m);
    return m;
  }

  _texFor(name, def) {
    if (!def.tex) return null;
    const t = this.textures.get(def.tex);
    if (!t) return null;
    if (EXPLICIT_UV.has(name)) return t;
    // metres -> repeats: clone so each material can have its own repeat
    const c = t.clone();
    c.repeat.set(1 / def.scale[0], 1 / def.scale[1]);
    c.needsUpdate = true;
    return c;
  }

  _makeLit(name, def) {
    const m = new THREE.MeshLambertMaterial({ color: def.color ?? 0xffffff, map: this._texFor(name, def) });
    m.userData.kind = 'lit';
    injectBake(m, this.shared, false);
    return m;
  }

  _makeGlow(name, def) {
    const m = new THREE.MeshBasicMaterial({ color: def.color ?? 0xffffff, map: this._texFor(name, def) });
    m.userData.kind = 'glow';
    m.userData.animate = def.animate;
    injectBake(m, this.shared, true);
    return m;
  }

  /** A per-cell material instance with its own flicker/dim uniforms. */
  instance(name, glow, cellUniforms) {
    const base = this.get(name, glow);
    const m = base.clone();
    m.userData = { ...base.userData };
    if (m.userData.kind === 'sky') {
      m.uniforms = base.uniforms; // one turning sky, shared
      return m;
    }
    injectBake(m, this.shared, m.userData.kind === 'glow', cellUniforms);
    return m;
  }

  update(t) {
    this.shared.uTime.value = t;
  }
}

/**
 * Add baked light: vBake = bakeA + bakeB * uFlicker, scaled by uDim. Lit materials add it to
 * the irradiance (so the flashlight adds on top); glow materials output it as their colour.
 */
function injectBake(mat, shared, glow, cell = null) {
  const uniforms = cell || { uFlicker: { value: 1 }, uDim: { value: 1 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlicker = uniforms.uFlicker;
    shader.uniforms.uDim = uniforms.uDim;
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uDark = shared.uDark;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 bakeA;\nattribute vec3 bakeB;\nuniform float uFlicker;\nuniform float uDim;\nvarying vec3 vBake;\nvarying vec3 vWPos;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBake = (bakeA + bakeB * uFlicker) * uDim;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    // the Unlit: baked light (and the glow of tubes) goes out inside a soft, restless circle;
    // only the flashlight, which is a real light, still reaches in
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vBake;
      varying vec3 vWPos;
      uniform float uTime;
      uniform vec4 uDark;
      float darkK() {
        if (uDark.w <= 0.0) return 1.0;
        vec2 q = vWPos.xz - uDark.xy;
        float d = length(q);
        float a = atan(q.y, q.x);
        float edge = uDark.z * (1.0 + 0.08 * sin(a * 5.0 + uTime * 1.7) + 0.05 * sin(a * 11.0 - uTime * 2.9));
        float inside = 1.0 - smoothstep(edge * 0.6, edge, d);
        return 1.0 - uDark.w * inside;
      }`,
    );
    if (glow) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        // a browned-out tube fades faster than the light it throws, and warms as it starves
        'vec4 diffuseColor = vec4( diffuse * vBake * darkK() * uDimG * vec3(1.0, 0.8 + 0.2 * uDimG, 0.55 + 0.45 * uDimG), opacity );',
      );
      shader.fragmentShader = shader.fragmentShader.replace('uniform float uTime;', 'uniform float uTime;\nuniform float uDimG;');      shader.uniforms.uDimG = uniforms.uDim;
      if (mat.userData.animate === 'flicker') {
        // a CRT: a slow roll bar and a faint mains flicker
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `vec4 sampledDiffuseColor = texture2D( map, vMapUv );
           sampledDiffuseColor.rgb *= 0.86 + 0.1 * smoothstep(0.0, 0.1, abs(fract(vMapUv.y * 0.7 - uTime * 0.21) - 0.5)) + 0.04 * sin(uTime * 50.0);
           diffuseColor *= sampledDiffuseColor;`,
        );
      }
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_maps>',
        '#include <lights_fragment_maps>\nirradiance += vBake * darkK() * PI;',
      );
    }
  };
  mat.customProgramCacheKey = () => (glow ? 'bake-glow-' + (mat.userData.animate || '') : 'bake-lit');
}
