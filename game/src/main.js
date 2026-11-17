// Velamar Heat: the page's entry point. It makes the canvas, builds the world, runs the fixed step
// against the real keyboard and mouse, draws the frame and the HUD, and keeps the title card,
// the pause menu and the save file. ?shot=name stages one of the scenes in shots.js instead, for
// the entry's screenshots.
import { STEP, COLORS } from './config.js';
import { Input } from './input.js';
import { World } from './game.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { drawTitle, drawPause, drawEndCard, saveGame, loadSave, hasSave } from './screens.js';
import { SoundBoard } from './audio.js';
import { stageShot } from './shots.js';
import { currentMarker } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = new Input();
const sound = new SoundBoard();
const shotName = new URLSearchParams(window.location.search).get('shot');

/** Anything that goes wrong is kept here so the game can be checked from outside a browser. */
window.__velamarErrors = [];
window.addEventListener('error', (event) => window.__velamarErrors.push(String(event.message)));
window.addEventListener('unhandledrejection', (event) => window.__velamarErrors.push(String(event.reason)));

const world = new World(20261118);
let mode = shotName ? 'shot' : 'title';
let message = '';
let lastTime = performance.now();
let accumulator = 0;
let staged = null;

function resize() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.max(480, Math.floor(width));
  canvas.height = Math.max(320, Math.floor(height));
}

/** Say what the canvas HUD is showing, for a screen reader. */
function say(text) {
  if (status && status.textContent !== text) status.textContent = text;
}

function startGame(loaded) {
  const save = loaded ?? null;
  if (save) {
    world.restore(save.data);
    world.notify('Save loaded — back on the coast', 'big');
  } else {
    world.reset(20261118);
    world.notify('Velamar. Take the courier board or the yellow job marker.', 'objective');
  }
  mode = 'playing';
  message = '';
  sound.start();
}

function tick(now) {
  requestAnimationFrame(tick);
  const delta = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= STEP && steps < 6) {
    accumulator -= STEP;
    steps += 1;
    stepOnce();
  }
  draw();
}

function stepOnce() {
  if (shotName) return;
  if (mode === 'title') {
    if (input.pressed('confirm')) {
      startGame(null);
    } else if (input.pressed('c')) {
      const save = loadSave();
      if (save) startGame(save);
      else message = 'No save file yet.';
    } else if (input.pressed('mute')) {
      message = sound.toggle() ? 'Sound off' : 'Sound on';
    }
    input.endStep();
    return;
  }
  if (mode === 'playing') {
    if (input.pressed('pause')) {
      mode = 'paused';
      message = '';
    }
    if (input.pressed('mute')) {
      const muted = sound.toggle();
      message = muted ? 'Sound off' : 'Sound on';
    }
    world.marker = currentMarker(world);
    world.step(STEP, input.sample(canvas.width, canvas.height, world.camera));
    sound.update(world);
    input.endStep();
    if (!world.player.dead) {
      say(`${world.cash} dollars, wanted level ${world.stars}, day ${world.day} at ${world.clockText()}`);
    }
    return;
  }
  if (mode === 'paused') {
    if (input.pressed('pause')) {
      mode = 'playing';
      message = '';
    } else if (input.pressed('save') || input.pressed('confirm')) {
      const saved = saveGame(world);
      message = saved ? 'Game saved — back to the coast.' : 'This browser refused the save.';
      if (saved) mode = 'playing';
    } else if (input.pressed('load')) {
      const save = loadSave();
      if (save) {
        world.restore(save.data);
        mode = 'playing';
        message = 'Save loaded.';
      } else message = 'No save file yet.';
    } else if (input.pressed('restart')) {
      world.reset(world.seed);
      mode = 'playing';
      world.notify('The story starts again.', 'big');
    } else if (input.pressed('quit')) {
      mode = 'title';
      message = '';
    } else if (input.pressed('mute')) {
      message = sound.toggle() ? 'Sound off' : 'Sound on';
    }
    input.endStep();
  }
}

function draw() {
  if (shotName) {
    if (!staged) {
      staged = stageShot(shotName, world);
      world.marker = currentMarker(world);
    }
    if (staged.screen === 'title') {
      drawTitle(ctx, canvas.width, canvas.height, world.time, hasSave() ? loadSave() : null);
    } else {
      drawWorld(ctx, world, canvas.width, canvas.height);
      drawHud(ctx, world, canvas.width, canvas.height);
    }
    window.__velamarReady = true;
    return;
  }
  if (mode === 'title') {
    drawTitle(ctx, canvas.width, canvas.height, world.time, hasSave() ? loadSave() : null);
  } else {
    drawWorld(ctx, world, canvas.width, canvas.height);
    drawHud(ctx, world, canvas.width, canvas.height);
    if (world.player.dead) drawEndCard(ctx, canvas.width, canvas.height, world, world.time);
    if (mode === 'paused') drawPause(ctx, canvas.width, canvas.height, world, message);
  }
  window.__velamarReady = true;
}

canvas.addEventListener('mousedown', () => {
  sound.start();
  if (mode === 'title') startGame(null);
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyC' && mode === 'title') {
    const save = loadSave();
    if (save) startGame(save);
  }
});
window.addEventListener('resize', resize);

resize();
input.attach(canvas);
world.marker = currentMarker(world);
window.__velamar = { world, sound, input, mode: () => mode, reset: () => world.reset(world.seed) };
requestAnimationFrame(tick);
