// Input -> actions. Everything the player does goes through here as a plain action object, so
// the same actions can come from a UI button, a test or (as intents) the network.

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
  KeyG: 'drop',
  KeyQ: 'drop',
  KeyF: 'lamp',
  KeyM: 'map',
  Tab: 'map',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
};

const EDGE_ACTIONS = new Set(['interact', 'drop', 'lamp', 'map', 'slot1', 'slot2', 'slot3', 'use', 'next', 'prev']);

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
    this._onDown = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.target) return;
      if (e.button === 0) {
        this.edges.add('use');
        this.held.add('use');
      }
    };
    this._onUp = (e) => {
      if (e.button === 0) this.held.delete('use');
    };
    this._onWheel = (e) => {
      if (!this.enabled || document.pointerLockElement !== this.target) return;
      this.edges.add(e.deltaY > 0 ? 'next' : 'prev');
    };
    this._onBlur = () => this.held.clear();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
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
    const e = this.edges;
    const slot = e.has('slot1') ? 0 : e.has('slot2') ? 1 : e.has('slot3') ? 2 : -1;
    const a = {
      moveX: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
      moveZ: (h.has('forward') ? 1 : 0) - (h.has('back') ? 1 : 0),
      run: h.has('run'),
      crouch: h.has('crouch'),
      interact: e.has('interact'),
      drop: e.has('drop'),
      lamp: e.has('lamp'),
      map: e.has('map'),
      use: e.has('use'),
      useHeld: h.has('use'),
      slot,
      cycle: e.has('next') ? 1 : e.has('prev') ? -1 : 0,
    };
    e.clear();
    return a;
  }

  /** Inject an action edge (for UI buttons, tests). */
  press(action) {
    this.edges.add(action);
  }

  clear() {
    this.held.clear();
    this.edges.clear();
    this.lookX = this.lookY = 0;
  }
}
