import { Game } from './game/game.js';
import { Save } from './game/save.js';
import { UI } from './ui/ui.js';
import { mapPanel, logPanel, discoveriesPanel, optionsPanel, paperPanel } from './ui/panels.js';

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const $ = (s) => document.querySelector(s);

const save = new Save();
if (params.has('fresh')) save.reset(params.has('seed') ? Number(params.get('seed')) || 0 : undefined);
else if (params.has('seed')) save.data.worldSeed = Number(params.get('seed')) || 0;

const ui = new UI();
if (debug) ui.show('#debug');

let game = null;

async function boot() {
  const canvas = $('#view');
  game = new Game({ canvas, ui, save, worldSeed: save.data.worldSeed, debug, kindAtOrigin: params.get('kind') });
  window.__game = game;
  window.__save = save;
  applySettings(save.data.settings);
  game.onUiAction = (name, arg) => openPanel(name, 'game', arg);
  $('#loading').textContent = 'rewinding tape...';
  await game.load((msg) => ($('#loading').textContent = msg + '...'));
  $('#loading').textContent = '';
  if (save.data.player) {
    $('#btn-continue').classList.remove('hidden');
    $('#btn-new').textContent = 'New tape';
  }
  if (params.has('autostart')) enter();
}

function applySettings(s) {
  if (!game) return;
  game.input.sensitivity = 0.0022 * (s.sensitivity || 1);
  game.audio.setMasterVolume(s.volume ?? 0.9);
}

function lockPointer() {
  try {
    const p = $('#view').requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  } catch {
    /* pointer lock may be unavailable (automation, iframes) */
  }
}

function enter() {
  ui.show('#title', false);
  ui.show('#pause', false);
  ui.show('#panel', false);
  ui.show('#hud', true);
  panel = null;
  game.start();
  lockPointer();
}

function pauseGame() {
  if (!game || game.paused) return;
  game.pause();
  ui.show('#pause', true);
}

function toTitle() {
  ui.show('#pause', false);
  ui.show('#panel', false);
  ui.show('#hud', false);
  ui.show('#title', true);
  if (save.data.player) {
    $('#btn-continue').classList.remove('hidden');
    $('#btn-new').textContent = 'New tape';
  }
}

/** Reload into a fresh world (new tape, imported code). Keeps debug flags, drops seed/fresh. */
function rewind() {
  const q = new URLSearchParams(location.search);
  q.delete('fresh');
  q.delete('seed');
  q.delete('kind');
  rewinding = true; // don't let the unload autosave write the old tape back
  location.search = q.toString().replace(/=(&|$)/g, '$1');
}
let rewinding = false;

// ---- panels -------------------------------------------------------------------------------------

let panel = null; // { name, from }
const PANEL_KEYS = { map: ['KeyM', 'Tab'], log: ['KeyL', 'KeyJ'], paper: ['KeyE'] };

function openPanel(name, from, arg) {
  if (!game) return;
  if (from === 'game') {
    if (game.paused) return;
    game.pause();
    try {
      document.exitPointerLock?.();
    } catch {
      /* ignore */
    }
  }
  const el = $('#panel');
  el.className = 'screen panel-' + name;
  if (name === 'map') mapPanel(el, save, game);
  else if (name === 'log') logPanel(el, save);
  else if (name === 'discoveries') discoveriesPanel(el, save);
  else if (name === 'paper') paperPanel(el, arg);
  else if (name === 'options')
    optionsPanel(el, save, {
      onSettings: applySettings,
      onImported: rewind,
      onNewTape: () => {
        save.newTape();
        rewind();
      },
    });
  panel = { name, from };
  ui.show('#title', false);
  ui.show('#pause', false);
  ui.show('#hud', from === 'game' && name === 'paper');
  ui.show(el, true);
  el.scrollTop = 0;
  el.querySelector('[data-close]')?.addEventListener('click', closePanel);
}

function closePanel() {
  if (!panel) return;
  const { from } = panel;
  panel = null;
  ui.show('#panel', false);
  if (from === 'game') enter();
  else if (from === 'pause') ui.show('#pause', true);
  else ui.show('#title', true);
}

window.addEventListener('keydown', (e) => {
  if (panel) {
    const keys = PANEL_KEYS[panel.name] || [];
    if (e.code === 'Escape' || keys.includes(e.code)) {
      e.preventDefault();
      closePanel();
    }
    return;
  }
  if (e.code === 'Escape' && game && !game.paused && params.has('autostart')) pauseGame();
});

$('#panel').addEventListener('click', (e) => {
  // clicking the paper (or outside it) puts the document down
  if (panel?.name === 'paper') closePanel();
  else if (e.target === e.currentTarget && panel?.name === 'map') closePanel();
});

// ---- buttons ------------------------------------------------------------------------------------

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game && !game.paused && !params.has('autostart')) pauseGame();
});

$('#view').addEventListener('click', () => {
  if (game && !game.paused && !document.pointerLockElement) lockPointer();
});

$('#btn-new').addEventListener('click', () => {
  if (save.data.player) {
    const b = $('#btn-new');
    if (b.dataset.armed) {
      save.newTape();
      rewind();
    } else {
      b.dataset.armed = '1';
      b.textContent = 'Erase this tape?';
    }
    return;
  }
  game.audio.init();
  enter();
});
$('#btn-continue').addEventListener('click', () => {
  game.audio.init();
  enter();
});
$('#btn-discoveries').addEventListener('click', () => openPanel('discoveries', 'title'));
$('#btn-options').addEventListener('click', () => openPanel('options', 'title'));
$('#btn-resume').addEventListener('click', enter);
$('#btn-pause-log').addEventListener('click', () => openPanel('log', 'pause'));
$('#btn-pause-map').addEventListener('click', () => openPanel('map', 'pause'));
$('#btn-pause-options').addEventListener('click', () => openPanel('options', 'pause'));
$('#btn-quit').addEventListener('click', toTitle);

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

window.addEventListener('beforeunload', () => {
  if (!rewinding) game?.autosave();
});

boot().catch((err) => {
  console.error(err);
  $('#loading').textContent = 'tape error: ' + err.message;
});
