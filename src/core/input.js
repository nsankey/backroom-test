// Input -> actions. Everything the player does goes through here as a plain action object,
// so later the same actions can arrive over the network.

const BINDINGS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyC: 'crouch',
  ControlLeft: 'crouch',
  KeyE: 'interact',
  KeyF: 'flashlight',
  KeyM: 'map',
  Tab: 'map',
  KeyL: 'log',
  KeyJ: 'log',
};

const EDGE_ACTIONS = new Set(['interact', 'flashlight', 'map', 'log']);

export class Input {
  constructor(target) {
    this.target = target;
    this.held = new Set();
    this.edges = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.sensitivity = 0.0022;
    this.enabled = true;
    this._onKeyDown = (e) => {
      const a = BINDINGS[e.code];
      if (!a) return;
      if (e.code === 'Tab') e.preventDefault();
      if (!this.enabled) return;
      if (!this.held.has(a) && EDGE_ACTIONS.has(a)) this.edges.add(a);
      this.held.add(a);
    };
    this._onKeyUp = (e) => {
      const a = BINDINGS[e.code];
      if (a) this.held.delete(a);
    };
    this._onMouse = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.target) return;
      // ignore the giant spikes some browsers send on lock
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    };
    this._onBlur = () => this.held.clear();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('blur', this._onBlur);
  }

  /** Look deltas since last call, in radians. */
  takeLook() {
    const out = { yaw: -this.lookX * this.sensitivity, pitch: -this.lookY * this.sensitivity };
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  /** The action snapshot for one simulation tick. Edge actions fire once. */
  takeActions() {
    const h = this.held;
    const a = {
      moveX: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
      moveZ: (h.has('forward') ? 1 : 0) - (h.has('back') ? 1 : 0),
      run: h.has('run'),
      crouch: h.has('crouch'),
      interact: this.edges.has('interact'),
      flashlight: this.edges.has('flashlight'),
      map: this.edges.has('map'),
      log: this.edges.has('log'),
    };
    this.edges.clear();
    return a;
  }

  /** Inject an action edge (for UI buttons, tests, or the network later). */
  press(action) {
    this.edges.add(action);
  }

  clear() {
    this.held.clear();
    this.edges.clear();
    this.lookX = this.lookY = 0;
  }
}
