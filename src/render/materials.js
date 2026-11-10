// Materials: Lambert surfaces lit by baked per-vertex light (plus the dynamic flashlight),
// and glow surfaces that show their baked emissive colour. Textures come from a worker.

import * as THREE from 'three';

// name -> { tex, scale: metres per texture repeat [u, v], color }
const DEFS = {
  carpetGold: { tex: 'carpetGold', scale: [1, 1] },
  carpetRust: { tex: 'carpetRust', scale: [1, 1] },
  carpetAvocado: { tex: 'carpetAvocado', scale: [1, 1] },
  carpetBlue: { tex: 'carpetBlue', scale: [1, 1] },
  wallpaperStripe: { tex: 'wallpaperStripe', scale: [1, 1] },
  wallpaperOval: { tex: 'wallpaperOval', scale: [1, 1] },
  wainscot: { tex: 'wainscot', scale: [2, 4] },
  walnut: { tex: 'walnut', scale: [1, 1] },
  woodVeneer: { tex: 'woodVeneer', scale: [0.6, 0.6] },
  woodDoor: { tex: 'woodDoor', scale: [0.92, 2.05] },
  acoustic: { tex: 'acoustic', scale: [1.2, 1.2] },
  terrazzo: { tex: 'terrazzo', scale: [2, 2] },
  vinylCheck: { tex: 'vinylCheck', scale: [1.2, 1.2] },
  paintMint: { tex: 'paintMint', scale: [1.6, 1.6] },
  paintCream: { tex: 'paintCream', scale: [2, 2], color: 0xd8d0b8 },
  concrete: { tex: 'concrete', scale: [2, 2] },
  whiteTile: { tex: 'whiteTile', scale: [1.2, 1.2] },
  stainless: { tex: 'stainless', scale: [0.8, 0.8], color: 0x8e908a },
  fabricFloral: { tex: 'fabricFloral', scale: [0.6, 0.6] },
  fabricOrange: { tex: 'fabricFloral', scale: [0.45, 0.45], color: 0xd08850 },
  vinylOrange: { tex: 'vinylOrange', scale: [1, 1] },
  vinylBrown: { tex: 'vinylBrown', scale: [1, 1] },
  laminate: { tex: 'laminate', scale: [1, 1] },
  paper: { tex: 'paper', scale: [0.25, 0.3] },
  manila: { tex: 'manila', scale: [0.5, 0.5] },
  paperTag: { tex: 'paperTag', scale: [0.2, 0.2] },
  cardboard: { tex: 'cardboard', scale: [0.5, 0.5] },
  mattress: { tex: 'mattress', scale: [1, 1] },
  linen: { tex: 'linen', scale: [1, 1] },
  doorFrame: { tex: 'doorFrame', scale: [1, 1] },
  baseboard: { tex: 'baseboard', scale: [1, 1] },
  threshold: { tex: 'threshold', scale: [0.5, 0.5] },
  clockFace: { tex: 'clockFace', scale: [1, 1] },
  digits: { tex: 'digits', scale: [1, 1] },
  signs: { tex: 'signs', scale: [1, 1] },
  mirror: { tex: 'mirror', scale: [1, 1] },
  // untextured
  chrome: { color: 0xb8bcbe },
  brass: { color: 0xb08a3e },
  blackPlastic: { color: 0x1c1a18 },
  beigePlastic: { color: 0xc8b896 },
  ceramic: { color: 0xd8d2c0 },
  soil: { color: 0x2a2018 },
  leaf: { color: 0x3c5a28 },
  sand: { color: 0xb8a882 },
  troffer: { color: 0xd8d6cc },
  metalGrey: { color: 0x7c7f78 },
  vendingBody: { color: 0x8a2a20 },
  redPaint: { color: 0xa0201a },
  glass: { color: 0x10120f },
  // glow (emissive) surfaces: colour comes from the baked vertex colour
  lamp: { glow: true },
  shade: { glow: true, color: 0xffffff },
  blinds: { glow: true, tex: 'blinds', scale: [1, 0.5] },
  tvStatic: { glow: true, tex: 'tvStatic', scale: [1, 1], animate: 'static' },
  signsGlow: { glow: true, tex: 'signsGlow', scale: [1, 1] },
  vendingGlow: { glow: true, tex: 'vendingGlow', scale: [1, 1] },
  scope: { glow: true, tex: 'scope', scale: [1, 1], animate: 'scroll' },
};

// textures whose UVs are explicit (uvRect) rather than metres
const EXPLICIT_UV = new Set(['clockFace', 'digits', 'signs', 'signsGlow', 'vendingGlow', 'scope', 'tvStatic']);

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
    this.shared = { uTime: { value: 0 } };
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
    m = glow || def.glow ? this._makeGlow(name, def) : this._makeLit(name, def);
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
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 bakeA;\nattribute vec3 bakeB;\nuniform float uFlicker;\nuniform float uDim;\nvarying vec3 vBake;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = (bakeA + bakeB * uFlicker) * uDim;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBake;\nuniform float uTime;');
    if (glow) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * vBake, opacity );',
      );
      if (mat.userData.animate === 'static') {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `vec2 suv = vMapUv + vec2(fract(sin(floor(uTime*24.0)*12.9898)*43758.5453), fract(sin(floor(uTime*24.0)*78.233)*43758.5453));
           vec4 sampledDiffuseColor = texture2D( map, suv );
           sampledDiffuseColor.rgb *= 0.8 + 0.2*sin(vMapUv.y*40.0 + uTime*7.0);
           diffuseColor *= sampledDiffuseColor;`,
        );
      } else if (mat.userData.animate === 'scroll') {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `vec4 sampledDiffuseColor = texture2D( map, vMapUv + vec2(uTime*0.15, 0.0) );
           diffuseColor *= sampledDiffuseColor;`,
        );
      }
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_maps>',
        '#include <lights_fragment_maps>\nirradiance += vBake * PI;',
      );
    }
  };
  mat.customProgramCacheKey = () => (glow ? 'bake-glow-' + (mat.userData.animate || '') : 'bake-lit');
}
