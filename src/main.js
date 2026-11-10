import { Game } from './game/game.js';
import { Save } from './game/save.js';
import { UI } from './ui/ui.js';

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const $ = (s) => document.querySelector(s);

const save = new Save();
if (params.has('seed')) save.data.worldSeed = Number(params.get('seed')) || 0;
if (params.has('fresh')) save.reset(Number(params.get('seed')) || undefined);

const ui = new UI();
if (debug) ui.show('#debug');

let game = null;

async function boot() {
  const canvas = $('#view');
  game = new Game({ canvas, ui, save, worldSeed: save.data.worldSeed, debug, kindAtOrigin: params.get('kind') });
  window.__game = game;
  $('#loading').textContent = 'rewinding tape...';
  await game.load((msg) => ($('#loading').textContent = msg + '...'));
  $('#loading').textContent = '';
  if (save.data.player) $('#btn-continue').classList.remove('hidden');
  if (params.has('autostart')) enter();
}

function enter() {
  ui.show('#title', false);
  ui.show('#pause', false);
  ui.show('#panel', false);
  ui.show('#hud', true);
  game.start();
  const canvas = $('#view');
  try {
    const p = canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  } catch {
    /* pointer lock may be unavailable (automation, iframes) */
  }
}

function pauseGame() {
  if (!game || game.paused) return;
  game.pause();
  ui.show('#pause', true);
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game && !game.paused && !params.has('autostart')) pauseGame();
});

$('#view').addEventListener('click', () => {
  if (game && !game.paused && !document.pointerLockElement) {
    try {
      $('#view').requestPointerLock?.()?.catch?.(() => {});
    } catch {
      /* ignore */
    }
  }
});

$('#btn-new').addEventListener('click', () => {
  game.audio.init();
  enter();
});
$('#btn-continue').addEventListener('click', () => {
  game.audio.init();
  enter();
});
$('#btn-resume').addEventListener('click', enter);
$('#btn-quit').addEventListener('click', () => {
  ui.show('#pause', false);
  ui.show('#hud', false);
  ui.show('#title', true);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game && !game.paused && params.has('autostart')) pauseGame();
});

// HUD clock and debug readout
setInterval(() => {
  if (!game || !game.player) return;
  ui.setStamp(game.time);
  ui.setRec(Math.floor(performance.now() / 600) % 2 === 0);
  ui.setPrompt(game.nearInteraction && !game.paused ? game.nearInteraction.it.prompt : '');
  ui.setBattery(game.player.battery, game.player.flashlight);
  if (debug) {
    const c = game.currentCell;
    const p = game.player;
    ui.debug(
      `${game.fps.value.toFixed(0)} fps  worst ${(game.fps.lastWorst || 0).toFixed(1)} ms  ` +
        `cell ${c ? c.cx + ',' + c.cz + ' ' + c.kindId : '-'}  pos ${p.x.toFixed(1)},${p.z.toFixed(1)}  ` +
        `cells ${game.world.cells.size}  calls ${game.renderer.info.render.calls}`,
    );
  }
}, 100);

boot().catch((err) => {
  console.error(err);
  $('#loading').textContent = 'tape error: ' + err.message;
});
