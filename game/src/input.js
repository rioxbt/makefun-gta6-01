// Keyboard and mouse, read once a step. The game asks `held`, `pressed` and `aim`, never the
// events themselves, so a scripted scene can drive the same interface a player would.

const KEY_ALIASES = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'attack', KeyJ: 'attack', KeyE: 'enter', KeyX: 'weapon_prev',
  Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit4: 'w4',
  ShiftLeft: 'run', ShiftRight: 'run', Escape: 'pause', KeyM: 'mute', Enter: 'confirm', KeyH: 'horn',
  KeyF: 'save', KeyL: 'load', KeyR: 'restart', KeyQ: 'quit',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.fresh = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.aim = { x: 1, y: 0 };
    this.attached = false;
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.attack = false;
  }

  /** Wire the listeners to a canvas and a window, once. */
  attach(canvas) {
    if (this.attached) return;
    this.attached = true;
    this.canvas = canvas;
    window.addEventListener('keydown', (event) => {
      const name = KEY_ALIASES[event.code] ?? event.key.toLowerCase();
      if (!this.down.has(name)) this.fresh.add(name);
      this.down.add(name);
      if (name !== event.key.toLowerCase() || event.code === 'Tab') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.down.delete(KEY_ALIASES[event.code] ?? event.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) this.mouse.down = true;
      event.preventDefault();
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  held(name) {
    return this.down.has(name);
  }

  /** True once per press: the step the key went down. */
  pressed(name) {
    if (!this.fresh.has(name)) return false;
    this.fresh.delete(name);
    return true;
  }

  /**
   * Fold the keys and the pointer into one intent the world reads: a move axis, whether to run,
   * whether the trigger is down, and the direction the player faces.
   */
  sample(width, height, camera) {
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    const length = Math.hypot(x, y) || 1;
    this.move = { x, y, length: Math.hypot(x, y) };
    if (this.move.length > 0) this.move = { x: x / length, y: y / length, length: 1 };
    this.run = this.held('run');
    this.attack = this.held('attack') || this.mouse.down;
    const dx = this.mouse.x - width / 2;
    const dy = this.mouse.y - height / 2;
    const distance = Math.hypot(dx, dy) || 1;
    this.aim = { x: dx / distance, y: dy / distance };
    this.aimDistance = distance / (camera.zoom || 1);
    this.aimWorld = { x: camera.x + dx / (camera.zoom || 1), y: camera.y + dy / (camera.zoom || 1) };
    return this;
  }

  /** End the step: a key press is a one-step event. */
  endStep() {
    this.fresh.clear();
  }
}
