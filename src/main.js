import { Game } from './game/game.js';
import { Save } from './game/save.js';
import { newRun } from './game/run.js';
import { UI } from './ui/ui.js';
import { terminalPanel, mapPanel, reportPanel, overPanel, optionsPanel } from './ui/panels.js';
import { fmtH } from './game/items.js';

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const $ = (s) => document.querySelector(s);

const save = new Save();
if (params.has('fresh')) save.reset();

const ui = new UI();
if (debug) ui.show('#debug');

let game = null;

async function boot() {
  game = new Game({ canvas: $('#view'), ui, save, debug });
  window.__game = game;
  window.__save = save;
  applySettings(save.data.settings);
  game.onUiAction = (name, arg) => onGameUi(name, arg);
  $('#loading').textContent = 'warming the sensor...';
  await game.boot();
  $('#loading').textContent = '';
  refreshTitle();
  if (params.has('autostart')) await (save.data.run ? continueContract() : newContract());
}

function refreshTitle() {
  const r = save.data.run;
  $('#btn-continue').classList.toggle('hidden', !r);
  if (r) $('#btn-continue').textContent = `Continue contract (night ${r.night}, ledger ${fmtH(r.ledger)})`;
  $('#btn-new').textContent = r ? 'Sign a new contract' : 'Sign a contract';
  delete $('#btn-new').dataset.armed;
  const rec = save.data.records;
  $('#records').textContent = rec.contracts ? `Best: ${rec.nights} nights · ${rec.paid} instalments paid · ${fmtH(rec.banked)} banked` : '';
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

async function load(run) {
  ui.show('#title', false);
  ui.show('#travel', true);
  $('#travel-eyebrow').textContent = 'STRONGBOX · DEPOT';
  $('#travel-site').textContent = `NIGHT ${run.night}`;
  $('#travel-blurb').textContent = 'Checking the van out of the depot.';
  ui.travelProgress(0, 1);
  await game.startContract(run, (msg) => ($('#travel-blurb').textContent = msg + '...'));
  ui.show('#travel', false);
  enter();
  if (run.night === 1 && !run.history.length) {
    setTimeout(() => ui.caption('Use the terminal (E) to choose tonight\'s writ, then pull the governor by the door.', 7), 900);
  }
}

async function newContract() {
  game.audio.init();
  const seed = params.has('seed') ? Number(params.get('seed')) || 0 : save.newSeed();
  const run = newRun(seed);
  save.checkpoint(run);
  await load(run);
}

async function continueContract() {
  game.audio.init();
  await load(JSON.parse(JSON.stringify(save.data.run)));
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
  panel = null;
  refreshTitle();
}

// ---- panels -------------------------------------------------------------------------------------

let panel = null; // { name, from }
const PANEL_KEYS = { map: ['KeyM', 'Tab'], terminal: ['KeyE'] };

function onGameUi(name, arg) {
  if (name === 'travel') {
    ui.show('#travel', true);
    $('#travel-eyebrow').textContent = `EN ROUTE · NIGHT ${arg.night}`;
    $('#travel-site').textContent = `${arg.site.writ} · ${arg.site.name.toUpperCase()}`;
    $('#travel-blurb').textContent = `${arg.site.place}. ${arg.site.blurb}`;
    ui.travelProgress(0, 1);
  } else if (name === 'travelDone') ui.show('#travel', false);
  else openPanel(name, 'game', arg);
}

function openPanel(name, from, arg) {
  if (!game) return;
  if (from === 'game' && !panel) {
    // the manifest always comes up, even over the pause screen; other panels need a live game
    if (game.paused && name !== 'report') return;
    ui.show('#pause', false);
    game.pause();
    try {
      document.exitPointerLock?.();
    } catch {
      /* ignore */
    }
  }
  const el = $('#panel');
  el.className = 'screen panel-' + name;
  const intent = (i) => game.session.applyIntent(game.pid, i);
  if (name === 'map') mapPanel(el, game);
  else if (name === 'terminal') terminalPanel(el, game, { onIntent: intent });
  else if (name === 'options') optionsPanel(el, save, { onSettings: applySettings, onImported: () => location.reload() });
  else if (name === 'report')
    reportPanel(el, arg, game.session.state.run, {
      onContinue: async () => {
        el.innerHTML = '<div class="term"><p>Driving back...</p></div>';
        const r = await game.afterReport();
        if (r === 'over') {
          const run = game.session.state.run;
          save.endContract(run);
          openPanel('over', 'over', run);
        } else enter();
      },
    });
  else if (name === 'over')
    overPanel(el, arg, {
      onNew: () => {
        panel = null;
        ui.show('#panel', false);
        newContract();
      },
      onTitle: toTitle,
    });
  panel = { name, from, arg };
  ui.show('#title', false);
  ui.show('#pause', false);
  ui.show('#hud', false);
  ui.show(el, true);
  el.scrollTop = 0;
  el.querySelector('[data-close]')?.addEventListener('click', closePanel);
}

function closePanel() {
  if (!panel || panel.name === 'report' || panel.name === 'over') return;
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
    // panel keys never reach the game's input
    e.stopImmediatePropagation();
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape' || keys.includes(e.code)) {
      e.preventDefault();
      closePanel();
    }
    return;
  }
  if (e.code === 'Escape' && game && !game.paused && params.has('autostart')) pauseGame();
}, true);

$('#panel').addEventListener('click', (e) => {
  if (e.target === e.currentTarget && (panel?.name === 'map' || panel?.name === 'terminal')) closePanel();
});

// ---- buttons ------------------------------------------------------------------------------------

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game && !game.paused && !panel && !params.has('autostart')) pauseGame();
});

$('#view').addEventListener('click', () => {
  if (game && !game.paused && !document.pointerLockElement) lockPointer();
});

$('#btn-new').addEventListener('click', () => {
  if (save.data.run) {
    const b = $('#btn-new');
    if (!b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Abandon the current contract?';
      return;
    }
  }
  newContract();
});
$('#btn-continue').addEventListener('click', continueContract);
$('#btn-options').addEventListener('click', () => openPanel('options', 'title'));
$('#btn-resume').addEventListener('click', enter);
$('#btn-pause-map').addEventListener('click', () => openPanel('map', 'pause'));
$('#btn-pause-options').addEventListener('click', () => openPanel('options', 'pause'));
$('#btn-quit').addEventListener('click', () => {
  game.session = null;
  toTitle();
});

// HUD and debug readout
setInterval(() => {
  if (!game || !game.session) return;
  ui.update(game.hud());
  if (debug) {
    const c = game.currentCell;
    const p = game.player;
    ui.debug(
      `${game.fps.value.toFixed(0)} fps  worst ${(game.fps.lastWorst || 0).toFixed(1)} ms  ` +
        `cell ${c ? c.cx + ',' + c.cz + ' ' + c.kindId : '-'}  pos ${p.x.toFixed(1)},${p.z.toFixed(1)}  ` +
        `cells ${game.world.cells.size}  calls ${game.renderer.info.render.calls}  tris ${game.renderer.info.render.triangles}`,
    );
  }
}, 100);

boot().catch((err) => {
  console.error(err);
  $('#loading').textContent = 'signal lost: ' + err.message;
});
