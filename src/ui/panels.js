// Full-screen paperwork, all on Grisholm's amber terminal: the ship's terminal (writs, ledger), the
// site plan, the night's manifest, the termination notice and options. Plain DOM. Panels never
// change game state themselves: they call back with intents.

import { SITE_LIST, SITES } from '../world/site.js';
import { KINDS } from '../world/kinds/index.js';
import { CELL, N } from '../world/constants.js';
import { ITEMS, TOOL_LIST, fmtH } from '../game/items.js';
import { fmtClock } from '../game/clock.js';
import { CAUSE_TEXT } from '../creatures/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const HAZARD = ['', 'LOW', 'MODERATE', 'HIGH'];

function head(title, sub, close = true) {
  return `<div class="foot" style="margin:0"><div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>${close ? '<button data-close>Close [Esc]</button>' : ''}</div>`;
}

// ---- the ship's terminal ----------------------------------------------------------------------

/** The firm's standing notices: each thing aboard the derelicts, its tell, and what to do. */
const NOTICES = [
  {
    title: 'NOTICE 14 · QUIET HOURS',
    where: 'ALL CRAFT',
    text: 'A humming like a struck tuning fork means the night quiet-keeper is on its rounds. It is blind and hears very well. It goes to where it heard something and listens; if it hears you again close by it whistles and comes at once. Crouch, keep still, set things down gently. A noise made elsewhere will draw it off.',
  },
  {
    title: 'NOTICE 22 · STOCK UNDER COUNT',
    where: 'ALL CRAFT',
    text: 'Stock found piled on a chalked floor is still under count by the clerk who stands over it. You will hear the counter click. It counts every twenty seconds and pursues any shortfall until the item is set down again. It counts pieces, not value.',
  },
  {
    title: 'NOTICE 31 · LIGHTING FAILURES',
    where: 'AFTER MIDNIGHT, SHIP TIME',
    text: 'Where tubes fail in a ring and the ears feel pressure, keep under working light and keep moving toward the Strongbox. In darkness it comes quickly; into light, only slowly, and only by putting the light out.',
  },
  {
    title: 'NOTICE 3 · NO WORKING ALONE',
    where: 'ALL CRAFT',
    text: 'Receivers will work within sight of one another. A receiver who has been on their own too long may hear whistling, and the helmet counter may read PERSONS 2. Do not stop. Do not wait for it. Rejoin the crew or return to the Strongbox.',
  },
];

export function terminalPanel(el, game, { onIntent, tab = null }) {
  const s = game.session.state;
  const run = s.run;
  const brief = s.phase === 'brief';
  tab = tab || (brief ? 'writs' : 'ledger');
  const tabs = (brief ? ['writs', 'stores', 'notices', 'ledger'] : ['ledger', 'site', 'notices']).map((t) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${t.toUpperCase()}</button>`).join('');
  let body = '';
  if (tab === 'writs') {
    body =
      `<p class="muted">Tonight's writs: derelict Halvard craft the court has handed to the firm. Choose one, then pull the governor by the door to fly out. The Strongbox docks and the door unlocks at 21:00 ship time; at 04:00 the governor undocks her and flies her home, with or without you.</p>` +
      SITE_LIST.map((site) => {
        const n = (run.visits[site.id] || 0) + 1;
        return `<div class="writ${site.id === run.siteId ? ' on' : ''}" data-writ="${site.id}">
          <div class="h"><span>${esc(site.writ)} &middot; ${esc(site.name.toUpperCase())}</span><span>HAZARD ${HAZARD[site.hazard]}</span></div>
          <div class="b">${esc(site.place)}. ${esc(site.blurb)} Boarding ${n}. ${site.cells[0]}-${site.cells[1]} sections.</div></div>`;
      }).join('');
  } else if (tab === 'ledger') {
    const left = run.instalment.due - run.night + 1;
    const rows = run.history
      .slice(-8)
      .map((h) => `<tr><td>NIGHT ${h.night}</td><td>${esc(SITES[h.siteId].name)}</td><td class="v">${fmtH(h.banked)}</td><td class="v">${h.fees ? '-' + fmtH(h.fees) : ''}</td></tr>`)
      .join('');
    const tonight = s.phase === 'night' ? `<p>Banked tonight: <b>${fmtH(s.tonight.banked)}</b> (${s.tonight.items.length} items)</p>` : '';
    body = `<div class="foot" style="margin:0 0 12px"><div><div class="muted">LEDGER</div><div class="big">${fmtH(run.ledger)}</div></div>
      <div><div class="muted">INSTALMENT ${run.instalment.n}</div><div class="big">${fmtH(run.instalment.target)}</div><div class="muted">due end of night ${run.instalment.due} &middot; ${left <= 1 ? 'TONIGHT' : left + ' nights left'}</div></div>
      <div><div class="muted">STILL OWED</div><div class="big ${run.ledger >= run.instalment.target ? 'good' : ''}">${fmtH(Math.max(0, run.instalment.target - run.ledger))}</div></div></div>
      ${tonight}
      <table><tr><th>NIGHT</th><th>WRIT</th><th class="v">BANKED</th><th class="v">FEES</th></tr>${rows || '<tr><td colspan="4" class="muted">No nights worked yet.</td></tr>'}</table>
      <p class="muted">Salvage is valued by the strongroom when it goes down the night safe. Anything still aboard the Strongbox when she undocks is banked automatically. Overtime after 03:00 is charged at ħ5 per ten minutes.</p>`;
  } else if (tab === 'stores') {
    const crew = Object.keys(s.players).length;
    body =
      `<p class="muted">Requisition from the firm's stores, charged to your ledger. Tools wait on the starboard rack in the hold; whatever you leave aboard a derelict is written off. One of each per receiver.</p>` +
      TOOL_LIST.map((t) => {
        const d = ITEMS[t];
        const owned = run.tools.filter((x) => x === t).length;
        const can = owned < crew && run.ledger >= d.price;
        return `<div class="writ"><div class="h"><span>${esc(d.name.toUpperCase())}${d.strange ? ' &middot; <span class="bad">UNCATALOGUED</span>' : ''}</span><span>${fmtH(d.price)}</span></div>
          <div class="b">${esc(d.blurb)}</div>
          <div class="foot" style="margin-top:6px"><span class="muted">${owned ? `${owned} on the rack` : 'none on the rack'}</span><button data-buy="${t}" ${can ? '' : 'disabled'}>${owned >= crew ? 'Issued' : 'Requisition'}</button></div></div>`;
      }).join('');
  } else if (tab === 'notices') {
    body =
      `<p class="muted">Standing notices to receivers aboard Halvard craft. Read before every shift. The firm accepts no liability for receivers who did not.</p>` +
      NOTICES.map((n) => `<div class="writ"><div class="h"><span>${esc(n.title)}</span><span>${esc(n.where)}</span></div><div class="b">${esc(n.text)}</div></div>`).join('');
  } else if (tab === 'site') {
    const site = SITES[s.site.siteId];
    const left = s.items.filter((i) => !i.holder).length;
    body = `<p>${esc(site.writ)} &middot; ${esc(site.name)}, ${esc(site.place)}</p><p class="muted">${esc(site.blurb)}</p>
      <p>Time now ${fmtClock(game.minutes)}. The derelict's reserve power ${Math.round(game.world.cells.get('0,-1')?.uniforms.uDim.value * 100 || 100)}% and falling.</p>
      <p class="muted">${left} items of salvage still aboard, by the inventory.</p>`;
  }
  el.innerHTML = `<div class="term">${head('GRISHOLM & DAUGHTERS · FIELD TERMINAL', `STRONGBOX ${game.hud().crew} · NIGHT ${run.night}`)}<div class="tabs">${tabs}</div>${body}</div>`;
  for (const b of el.querySelectorAll('[data-tab]')) b.addEventListener('click', () => terminalPanel(el, game, { onIntent, tab: b.dataset.tab }));
  for (const b of el.querySelectorAll('[data-buy]'))
    b.addEventListener('click', () => {
      onIntent({ type: 'buy', tool: b.dataset.buy });
      terminalPanel(el, game, { onIntent, tab: 'stores' });
    });
  for (const w of el.querySelectorAll('[data-writ]'))
    w.addEventListener('click', () => {
      onIntent({ type: 'writ', siteId: w.dataset.writ });
      terminalPanel(el, game, { onIntent, tab: 'writs' });
    });
}

// ---- site plan --------------------------------------------------------------------------------

export function mapPanel(el, game) {
  const d = game.planData();
  const site = game.session.state.site ? SITES[game.session.state.site.siteId] : null;
  el.innerHTML = `<div class="term">${head('SITE PLAN', site ? `${site.writ} · ${site.name.toUpperCase()} · ${d.cells.length - 1} sections walked` : 'THE DOCKING DECK')}
    <canvas id="mapcanvas"></canvas>
    <p class="muted">Drawn from your helmet camera as you walk. You are the arrow. The Strongbox is marked on the docking deck.</p></div>`;
  const cv = el.querySelector('#mapcanvas');
  requestAnimationFrame(() => drawMap(cv, d));
}

function drawMap(cv, { cells, player }) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = cv.clientWidth || 800;
  const cssH = Math.min(window.innerHeight * 0.62, cssW * 0.7);
  cv.style.height = cssH + 'px';
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  const g = cv.getContext('2d');
  g.fillStyle = '#0d0a05';
  g.fillRect(0, 0, cv.width, cv.height);
  if (!cells.length) return;
  const minX = Math.min(...cells.map((c) => c.cx));
  const maxX = Math.max(...cells.map((c) => c.cx));
  const minZ = Math.min(...cells.map((c) => c.cz));
  const maxZ = Math.max(...cells.map((c) => c.cz));
  const pad = 0.4;
  const cellPx = Math.min(cv.width / (maxX - minX + 1 + pad * 2), cv.height / (maxZ - minZ + 1 + pad * 2), 220 * dpr);
  const tp = cellPx / N;
  const ox = (cv.width - (maxX - minX + 1) * cellPx) / 2 - minX * cellPx;
  const oz = (cv.height - (maxZ - minZ + 1) * cellPx) / 2 - minZ * cellPx;
  const have = new Map(cells.map((c) => [c.key, c]));
  const floorAt = (c, i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) {
      const ncx = c.cx + (i < 0 ? -1 : i >= N ? 1 : 0);
      const ncz = c.cz + (j < 0 ? -1 : j >= N ? 1 : 0);
      const nc = have.get(`${ncx},${ncz}`);
      if (!nc) return true; // unwalked: draw as open
      return nc.tiles[((j + N) % N) * N + ((i + N) % N)] !== 0;
    }
    return c.tiles[j * N + i] !== 0;
  };
  for (const c of cells) {
    const x0 = ox + c.cx * cellPx;
    const z0 = oz + c.cz * cellPx;
    g.fillStyle = 'rgba(255, 182, 72, 0.09)';
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (c.tiles[j * N + i]) g.fillRect(x0 + i * tp, z0 + j * tp, tp + 0.5, tp + 0.5);
    g.fillStyle = 'rgba(255, 182, 72, 0.22)';
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (c.tiles[j * N + i] && c.blocked[j * N + i]) g.fillRect(x0 + i * tp + tp * 0.2, z0 + j * tp + tp * 0.2, tp * 0.6, tp * 0.6);
    g.strokeStyle = 'rgba(255, 190, 90, 0.9)';
    g.lineWidth = Math.max(1, tp * 0.22);
    g.beginPath();
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (!c.tiles[j * N + i]) continue;
        const x = x0 + i * tp;
        const z = z0 + j * tp;
        if (!floorAt(c, i - 1, j)) g.moveTo(x, z), g.lineTo(x, z + tp);
        if (!floorAt(c, i + 1, j)) g.moveTo(x + tp, z), g.lineTo(x + tp, z + tp);
        if (!floorAt(c, i, j - 1)) g.moveTo(x, z), g.lineTo(x + tp, z);
        if (!floorAt(c, i, j + 1)) g.moveTo(x, z + tp), g.lineTo(x + tp, z + tp);
      }
    g.stroke();
    if (cellPx > 70 * dpr) {
      g.fillStyle = 'rgba(255, 190, 90, 0.75)';
      g.font = `${Math.round(Math.min(12, cellPx / 12) * dpr)}px Consolas, monospace`;
      g.textAlign = 'center';
      g.fillText((KINDS[c.kindId]?.name || '?').toUpperCase(), x0 + cellPx / 2, z0 + cellPx - 6 * dpr);
    }
  }
  // the ship
  g.fillStyle = 'rgba(93, 255, 138, 0.8)';
  g.fillRect(ox + (9.5 / CELL) * cellPx, oz + (8 / CELL) * cellPx, (2 / CELL) * cellPx, (4.5 / CELL) * cellPx);
  if (player) {
    const px = ox + (player.x / CELL) * cellPx;
    const pz = oz + (player.z / CELL) * cellPx;
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const r = Math.max(5 * dpr, tp * 1.4);
    g.fillStyle = '#ff4a36';
    g.beginPath();
    g.moveTo(px + fx * r * 1.6, pz + fz * r * 1.6);
    g.lineTo(px - fz * r * 0.8 - fx * r * 0.6, pz + fx * r * 0.8 - fz * r * 0.6);
    g.lineTo(px + fz * r * 0.8 - fx * r * 0.6, pz - fx * r * 0.8 - fz * r * 0.6);
    g.closePath();
    g.fill();
  }
}

// ---- the night's manifest ---------------------------------------------------------------------

export function reportPanel(el, report, run, { onContinue }) {
  const site = SITES[report.siteId];
  const items = report.items
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((i) => `<tr><td>${esc(ITEMS[i.type].name)}${i.dropped ? ' <span class="muted">(damaged)</span>' : ''}</td><td class="v">${fmtH(i.value)}</td></tr>`)
    .join('');
  const fees = report.fees.map((f) => `<tr><td>${esc(f.what)}</td><td class="v bad">-${fmtH(f.v)}</td></tr>`).join('');
  const lost =
    (report.lost.length ? `<tr><td class="bad">Lost with the crew left behind: ${report.lost.map((l) => esc(ITEMS[l.type].name)).join(', ')}</td><td></td></tr>` : '') +
    (report.toolsLost?.length ? `<tr><td class="bad">Tools written off (left aboard the derelict): ${report.toolsLost.map((t) => esc(ITEMS[t].name)).join(', ')}</td><td></td></tr>` : '');
  const how =
    report.reason === 'wiped'
      ? `Signal lost from every helmet by ${fmtClock(Math.max(...report.dead.map((d) => d.min ?? report.departed)))}. The governor undocked the Strongbox and flew her home with nobody aboard.`
      : report.reason === 'lever'
        ? `Undocked ${fmtClock(report.departed)} on the governor.`
        : `The governor undocked at 04:00${report.leftBehind.length ? ', without everyone' : ''}.`;
  const lostCrew = (report.dead || []).length && !report.clockedOut ? `<p class="bad">Signal lost: ${report.dead.length} of the crew. ${esc(CAUSE_TEXT[report.dead[0].cause] || '')}</p>` : '';
  const clocked = report.clockedOut ? `<p class="bad">${esc(CAUSE_TEXT[report.clockedOut] || 'Your signal was lost.')}</p>` : '';
  let inst = '';
  if (report.clockedOut) inst = `<p><span class="stamp bad">CLOCKED OUT</span> &nbsp; A receiver working alone cannot be recovered. The contract ends tonight.</p>`;
  else if (report.paid) inst = `<p><span class="stamp good">INSTALMENT PAID</span> &nbsp; ${fmtH(report.target)} taken. The next Instalment is ${fmtH(report.nextTarget)}, due in three nights.</p>`;
  else if (report.missed && report.target == null) inst = `<p><span class="stamp bad">IN DEBT</span> &nbsp; The fees have put the ledger below nothing. Grisholm &amp; Daughters do not carry debtors' debts.</p>`;
  else if (report.missed) inst = `<p><span class="stamp bad">INSTALMENT MISSED</span> &nbsp; ${fmtH(report.target)} was due.</p>`;
  else inst = `<p class="muted">Instalment ${fmtH(run.instalment.target)} due at the end of night ${run.instalment.due}. Still owed: ${fmtH(Math.max(0, run.instalment.target - run.ledger))}.</p>`;
  const behind = report.leftBehind.length ? `<p class="bad">You were not aboard at 04:00. A recovery tug cut you out of the derelict the next ship's morning. Everything you carried is gone, and you are stood down for night ${report.skipped}.</p>` : '';
  el.innerHTML = `<div class="term">${head(`NIGHT ${report.night} · MANIFEST`, `${site.writ} · ${site.name.toUpperCase()} · ${site.place.toUpperCase()}`, false)}
    <p>${how}</p>${clocked}${lostCrew}${behind}
    <table><tr><th>BANKED</th><th class="v">${report.items.length} ITEMS</th></tr>${items || '<tr><td class="muted">Nothing banked tonight.</td><td></td></tr>'}
    <tr><td><b>Total</b></td><td class="v"><b>${fmtH(report.banked)}</b></td></tr>${fees}${lost}</table>
    <div class="foot"><div><div class="muted">LEDGER</div><div class="big">${fmtH(report.ledger)}</div></div><button data-continue>${run.over ? 'Read the notice' : 'Back to the ship'}</button></div>
    ${inst}</div>`;
  el.querySelector('[data-continue]').addEventListener('click', onContinue);
}

// ---- the end of a contract ----------------------------------------------------------------------

export function overPanel(el, run, { onNew, onTitle }) {
  const best = run.best ? `${ITEMS[run.best.type].name}, ${fmtH(run.best.value)}` : 'nothing of note';
  const clocked = run.over?.reason === 'clockedOut';
  const why = clocked
    ? `${CAUSE_TEXT[run.over.cause] || 'Your signal was lost.'} Night ${run.over.night}.`
    : run.over?.reason === 'debt'
      ? 'Your ledger went into the red.'
      : `The Instalment of ${fmtH(run.instalment.target)} fell due and was not met.`;
  const tail = clocked
    ? 'Your contract is closed. Your ledger passes to your next of kin, with the debt.'
    : 'Your contract is terminated with effect from 04:00. Your debt has been sold on to a sister firm. They will be in touch.';
  el.innerHTML = `<div class="term">${head(clocked ? 'NOTICE OF SIGNAL LOSS' : 'NOTICE OF TERMINATION', 'GRISHOLM & DAUGHTERS · RECEIVERS AND LIQUIDATORS', false)}
    <p>${esc(why)} ${esc(tail)}</p>
    <table>
      <tr><td>Nights worked</td><td class="v">${run.history.length}</td></tr>
      <tr><td>Instalments paid</td><td class="v">${run.paid}</td></tr>
      <tr><td>Salvage banked in all</td><td class="v">${fmtH(run.banked)}</td></tr>
      <tr><td>Best find</td><td class="v">${esc(best)}</td></tr>
      <tr><td>Ledger at termination</td><td class="v ${run.ledger < 0 ? 'bad' : ''}">${fmtH(run.ledger)}</td></tr>
    </table>
    <p class="muted">Grisholm & Daughters thank you for your service. Please return your helmet and suit.</p>
    <div class="foot"><button data-title>Title screen</button><button data-new>Sign a new contract</button></div></div>`;
  el.querySelector('[data-new]').addEventListener('click', onNew);
  el.querySelector('[data-title]').addEventListener('click', onTitle);
}

// ---- options ------------------------------------------------------------------------------------

export function optionsPanel(el, save, { onSettings, onImported }) {
  const s = save.data.settings;
  el.innerHTML = `<div class="term" style="max-width:640px">${head('OPTIONS', save.data.run ? `CONTRACT IN PROGRESS · NIGHT ${save.data.run.night}` : 'NO CONTRACT')}
    <div class="opt-row"><label for="opt-sens">Look sensitivity</label><input id="opt-sens" type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}"></div>
    <div class="opt-row"><label for="opt-vol">Volume</label><input id="opt-vol" type="range" min="0" max="1" step="0.02" value="${s.volume}"></div>
    <p class="muted">SAVE CODE: the contract as it stood in the hold before the last night. Copy it to carry it to another browser.</p>
    <textarea id="opt-export" readonly spellcheck="false"></textarea>
    <div class="opt-row"><button id="opt-copy">Copy code</button><span id="opt-copy-msg" class="muted"></span></div>
    <textarea id="opt-import" placeholder="Paste a save code (NR1-...)" spellcheck="false"></textarea>
    <div class="opt-row"><button id="opt-load">Load code</button><span id="opt-load-msg" class="muted"></span></div></div>`;
  const $ = (q) => el.querySelector(q);
  save.exportCode().then((c) => ($('#opt-export').value = c));
  $('#opt-sens').addEventListener('input', (e) => {
    s.sensitivity = +e.target.value;
    save.write();
    onSettings?.(s);
  });
  $('#opt-vol').addEventListener('input', (e) => {
    s.volume = +e.target.value;
    save.write();
    onSettings?.(s);
  });
  $('#opt-copy').addEventListener('click', async () => {
    const ta = $('#opt-export');
    ta.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(ta.value);
      ok = true;
    } catch {
      ok = document.execCommand?.('copy');
    }
    $('#opt-copy-msg').textContent = ok ? 'Copied.' : 'Select the text and copy it.';
  });
  $('#opt-load').addEventListener('click', async () => {
    const ok = await save.importCode($('#opt-import').value);
    $('#opt-load-msg').textContent = ok ? 'Loaded. Restarting...' : 'That code did not take.';
    if (ok) setTimeout(() => onImported?.(), 600);
  });
}
