import { Game, crewId, channelOf } from './game/game.js';
import { Save } from './game/save.js';
import { newRun } from './game/run.js';
import { UI } from './ui/ui.js';
import { terminalPanel, mapPanel, reportPanel, overPanel, optionsPanel } from './ui/panels.js';
import { fmtH } from './game/items.js';
import { coopAvailable, roomCode, connect } from './game/coop.js';

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
  game.onCoopEvent = (e) => onCoopEvent(e);
  $('#loading').textContent = 'warming the sensor...';
  await game.boot();
  $('#loading').textContent = '';
  refreshTitle();
  ui.show('#crew-menu', coopAvailable());
  if (params.has('join')) await joinCrew(params.get('join'));
  else if (params.has('host')) await hostCrew();
  else if (params.has('autostart')) await (save.data.run ? continueContract() : newContract());
}

// ---- co-op --------------------------------------------------------------------------------------

/** Take the contract in hand (or a new one) out with a crew: open a room on the relay. */
async function hostCrew() {
  game.audio.init();
  const code = (params.get('room') || roomCode()).toUpperCase();
  $('#loading').textContent = 'opening a line to the relay...';
  let link;
  try {
    link = await connect(code, { host: true });
  } catch (err) {
    $('#loading').textContent = err.message === 'taken' ? `Room ${code} is in use. Try again.` : 'The relay did not answer. Is it running (server/: npx wrangler dev)?';
    return;
  }
  $('#loading').textContent = '';
  const seed = params.has('seed') ? Number(params.get('seed')) || 0 : null;
  const run = save.data.run && seed === null ? JSON.parse(JSON.stringify(save.data.run)) : newRun(seed ?? save.newSeed());
  if (!save.data.run || seed !== null) save.checkpoint(run);
  await load(run);
  game.hostCrew(link);
  ui.caption(`Room ${code}. Give the crew this code; they join from the title screen.`, 8);
}

async function joinCrew(raw) {
  game.audio.init();
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) {
    $('#loading').textContent = 'A room code is four letters.';
    return;
  }
  $('#loading').textContent = `calling room ${code}...`;
  let link;
  try {
    link = await connect(code, { name: crewId((Math.random() * 1e9) | 0) });
  } catch (err) {
    const why = { noRoom: `Nobody is working room ${code}.`, full: `Room ${code} has a full crew.` }[err.message];
    $('#loading').textContent = why || 'The relay did not answer. Is it running (server/: npx wrangler dev)?';
    return;
  }
  $('#loading').textContent = '';
  ui.show('#title', false);
  ui.show('#travel', true);
  $('#travel-eyebrow').textContent = `ROOM ${code} · CH ${channelOf(link.pid)}`;
  $('#travel-site').textContent = 'JOINING THE CREW';
  $('#travel-blurb').textContent = 'Patching your helmet into the van...';
  ui.travelProgress(0, 1);
  try {
    await game.joinCrew(link, (msg) => ($('#travel-blurb').textContent = msg + '...'));
  } catch (err) {
    game.leaveCrew();
    game.session = null;
    ui.show('#travel', false);
    toTitle();
    $('#loading').textContent = err.message;
    return;
  }
  ui.show('#travel', false);
  enter();
  ui.caption(`On the line to room ${code} as CH ${channelOf(link.pid)}. The crew chief pulls the governor.`, 6);
}

function onCoopEvent(e) {
  if (!game) return;
  if (game.coop?.client && (e.type === 'hostLeft' || e.type === 'relayLost')) {
    game.leaveCrew();
    game.session = null;
    game.clearDeathCut();
    game.views.clear();
    toTitle();
    $('#loading').textContent = e.type === 'hostLeft' ? 'The crew chief has gone off the line. The night is over for you.' : 'The line to the relay dropped.';
  } else if (game.coop?.host && e.type === 'relayLost') {
    // the crew are gone: carry on alone
    const s = game.session;
    for (const pid of Object.keys(s.state.players)) if (pid !== game.pid) s.removePlayer(pid);
    game.leaveCrew();
    ui.caption('The relay has dropped. You are on your own.', 5);
  }
}

$('#btn-host').addEventListener('click', () => hostCrew());
$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  joinCrew($('#join-code').value);
});

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
  const intent = (i) => game.intent(i);
  if (name === 'map') mapPanel(el, game);
  else if (name === 'terminal') terminalPanel(el, game, { onIntent: intent });
  else if (name === 'options') optionsPanel(el, save, { onSettings: applySettings, onImported: () => location.reload() });
  else if (name === 'report')
    reportPanel(el, arg, game.session.state.run, {
      onContinue: async () => {
        const say = (msg) => (el.innerHTML = `<div class="term"><p>${msg}...</p></div>`);
        say('Driving back');
        const r = await game.afterReport((msg) => say(msg === 'waiting for the crew chief' ? 'Waiting for the crew chief to sign the manifest' : 'Driving back'));
        if (r === 'over') {
          const run = game.session.state.run;
          if (!game.coop?.client) save.endContract(run); // the chief's contract, not ours
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
  game.leaveCrew();
  game.session = null;
  toTitle();
});

// HUD and debug readout
setInterval(() => {
  if (!game || !game.session) return;
  ui.update(game.hud());
  const c = game.coop;
  const room = c ? `ROOM ${c.code} · ${c.host ? `CHIEF · CREW ${Object.keys(game.session.state.players).length}` : `CH ${channelOf(game.pid)}`}` : '';
  const el = $('#hud-room');
  if (el.textContent !== room) el.textContent = room;
  el.classList.toggle('hidden', !c);
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
