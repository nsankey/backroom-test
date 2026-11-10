// Full-screen panels: the floor plan, the logbook, the discoveries screen, options and paper
// documents. Plain DOM, rendered into #panel from save data (no game state is changed here).

import { KIND_LIST, KINDS } from '../world/kinds/index.js';
import { ENTITY_LIST } from '../entities/index.js';
import { CELL, N } from '../world/constants.js';
import { unpackCellMask } from '../game/save.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function head(title, sub) {
  return `<div class="panel-head"><div><div class="eyebrow">${esc(sub)}</div><h2>${esc(title)}</h2></div><button data-close>Close</button></div>`;
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ---- map --------------------------------------------------------------------------------------

export function mapPanel(el, save, game) {
  const visited = save.data.visited;
  const keys = Object.keys(visited);
  el.innerHTML = `<div class="panel-inner">${head('FLOOR PLAN', `${keys.length} place${keys.length === 1 ? '' : 's'} surveyed · drawn as walked`)}
    <canvas id="mapcanvas"></canvas>
    <p class="map-note">You are the red mark. Places you have not walked are not on the plan, because they were not there yet.</p></div>`;
  const cv = el.querySelector('#mapcanvas');
  requestAnimationFrame(() => drawMap(cv, save, game));
}

function drawMap(cv, save, game) {
  const visited = save.data.visited;
  const keys = Object.keys(visited);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = cv.clientWidth || 800;
  const cssH = Math.min(window.innerHeight * 0.68, cssW * 0.66);
  cv.style.height = cssH + 'px';
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  const g = cv.getContext('2d');
  g.fillStyle = '#0f2236';
  g.fillRect(0, 0, cv.width, cv.height);
  // faint drafting grid
  g.strokeStyle = 'rgba(160, 200, 255, 0.06)';
  g.lineWidth = 1;
  for (let x = 0; x < cv.width; x += 12 * dpr) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, cv.height);
    g.stroke();
  }
  for (let y = 0; y < cv.height; y += 12 * dpr) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(cv.width, y);
    g.stroke();
  }
  if (!keys.length) return;

  const p = game?.player;
  const cells = keys.map((k) => {
    const [cx, cz] = k.split(',').map(Number);
    return { k, cx, cz };
  });
  let minX = Math.min(...cells.map((c) => c.cx));
  let maxX = Math.max(...cells.map((c) => c.cx));
  let minZ = Math.min(...cells.map((c) => c.cz));
  let maxZ = Math.max(...cells.map((c) => c.cz));
  // keep the player's cell centred when the plan is small, fit it when it is large
  const pad = 0.6;
  const spanX = maxX - minX + 1 + pad * 2;
  const spanZ = maxZ - minZ + 1 + pad * 2;
  const cellPx = Math.min(cv.width / spanX, cv.height / spanZ, 200 * dpr);
  const tilePx = cellPx / N;
  const ox = (cv.width - (maxX - minX + 1) * cellPx) / 2 - minX * cellPx;
  const oz = (cv.height - (maxZ - minZ + 1) * cellPx) / 2 - minZ * cellPx;

  for (const c of cells) {
    const mask = save.data.maps[c.k];
    const x0 = ox + c.cx * cellPx;
    const z0 = oz + c.cz * cellPx;
    if (!mask) {
      g.strokeStyle = 'rgba(200, 225, 255, 0.4)';
      g.strokeRect(x0 + 2, z0 + 2, cellPx - 4, cellPx - 4);
      continue;
    }
    const { floor, blocked } = unpackCellMask(mask, N);
    g.fillStyle = 'rgba(190, 215, 255, 0.13)';
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) if (floor[j * N + i]) g.fillRect(x0 + i * tilePx, z0 + j * tilePx, tilePx + 0.5, tilePx + 0.5);
    // furniture as small hatched blocks
    g.fillStyle = 'rgba(190, 215, 255, 0.22)';
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        if (floor[j * N + i] && blocked[j * N + i]) g.fillRect(x0 + i * tilePx + tilePx * 0.2, z0 + j * tilePx + tilePx * 0.2, tilePx * 0.6, tilePx * 0.6);
    // walls: edges between floor and solid, drawn in ink
    g.strokeStyle = 'rgba(215, 232, 255, 0.85)';
    g.lineWidth = Math.max(1, tilePx * 0.22);
    g.beginPath();
    const isF = (i, j) => i >= 0 && j >= 0 && i < N && j < N && floor[j * N + i] === 1;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (!isF(i, j)) continue;
        const x = x0 + i * tilePx;
        const z = z0 + j * tilePx;
        // boundary tiles open into the neighbour only where the neighbour's edge is floor too
        if (!isF(i - 1, j) && !(i === 0 && openAcross(save, c.cx - 1, c.cz, N - 1, j))) {
          g.moveTo(x, z);
          g.lineTo(x, z + tilePx);
        }
        if (!isF(i + 1, j) && !(i === N - 1 && openAcross(save, c.cx + 1, c.cz, 0, j))) {
          g.moveTo(x + tilePx, z);
          g.lineTo(x + tilePx, z + tilePx);
        }
        if (!isF(i, j - 1) && !(j === 0 && openAcross(save, c.cx, c.cz - 1, i, N - 1))) {
          g.moveTo(x, z);
          g.lineTo(x + tilePx, z);
        }
        if (!isF(i, j + 1) && !(j === N - 1 && openAcross(save, c.cx, c.cz + 1, i, 0))) {
          g.moveTo(x, z + tilePx);
          g.lineTo(x + tilePx, z + tilePx);
        }
      }
    g.stroke();
    // label
    if (cellPx > 70 * dpr) {
      const kind = KINDS[save.data.visited[c.k]];
      g.fillStyle = 'rgba(225, 238, 255, 0.75)';
      g.font = `${Math.round(Math.min(13, cellPx / 11) * dpr)}px Consolas, monospace`;
      g.textAlign = 'center';
      g.fillText((kind?.card?.title || kind?.name || '?').toUpperCase(), x0 + cellPx / 2, z0 + cellPx - 6 * dpr);
    }
  }

  // the player
  if (p) {
    const px = ox + (p.x / CELL) * cellPx;
    const pz = oz + (p.z / CELL) * cellPx;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const r = Math.max(5 * dpr, tilePx * 1.4);
    g.fillStyle = '#ff4a3a';
    g.beginPath();
    g.moveTo(px + fx * r * 1.6, pz + fz * r * 1.6);
    g.lineTo(px - fz * r * 0.8 - fx * r * 0.6, pz + fx * r * 0.8 - fz * r * 0.6);
    g.lineTo(px + fz * r * 0.8 - fx * r * 0.6, pz - fx * r * 0.8 - fz * r * 0.6);
    g.closePath();
    g.fill();
  }
}

/** Is tile (i, j) of a neighbouring cell surveyed floor? (Unsurveyed neighbours draw as open.) */
function openAcross(save, cx, cz, i, j) {
  const mask = save.data.maps[`${cx},${cz}`];
  if (!mask) return true;
  const k = j * N + i;
  return ((atob(mask).charCodeAt(k >> 3) >> (k & 7)) & 1) === 1;
}

// ---- logbook ----------------------------------------------------------------------------------

export function logPanel(el, save) {
  const log = [...save.data.log].reverse();
  const rows = log.length
    ? log
        .map((e) => {
          const where = e.key.startsWith('place:') ? 'NEW PLACE' : KINDS[e.kind]?.card?.title || '';
          return `<div class="log-entry"><div class="where">${esc(where.toUpperCase())}</div>${esc(e.text)}</div>`;
        })
        .join('')
    : '<p class="empty">Nothing yet. Walk. Look. Read what was left on the desks.</p>';
  el.innerHTML = `<div class="panel-inner">${head('LOGBOOK', `${log.length} entr${log.length === 1 ? 'y' : 'ies'} · tape time ${fmtTime(save.data.tapeSeconds || 0)}`)}<div class="log">${rows}</div></div>`;
}

// ---- discoveries ------------------------------------------------------------------------------

export function discoveriesPanel(el, save) {
  const card = (key, c, kindLabel) => {
    const found = save.isDiscovered(key);
    const thumb = save.thumbs[key];
    const img = found && thumb ? `<img src="${thumb}" alt="">` : `<div class="noimg${found ? ' nosignal' : ''}">${found ? 'NO SIGNAL' : '?'}</div>`;
    return `<div class="card ${found ? '' : 'locked'}">${img}<div class="body"><div class="kindlabel">${kindLabel}</div><div class="name">${esc(found ? c.title : '? ? ?')}</div><div class="blurb">${esc(found ? c.blurb : 'Not yet found.')}</div></div></div>`;
  };
  const places = KIND_LIST.map((k) => card('place:' + k.id, k.card, 'PLACE')).join('');
  const people = ENTITY_LIST.map((e) => card('entity:' + e.id, e.card, e.role === 'hunter' ? 'HUNTER' : 'RESIDENT')).join('');
  const nP = KIND_LIST.filter((k) => save.isDiscovered('place:' + k.id)).length;
  const nE = ENTITY_LIST.filter((e) => save.isDiscovered('entity:' + e.id)).length;
  const nL = Object.keys(save.data.lore || {}).length;
  el.innerHTML = `<div class="panel-inner">${head('DISCOVERIES', `${nP}/${KIND_LIST.length} places · ${nE}/${ENTITY_LIST.length} occupants · ${nL}/${KIND_LIST.length} documents · played ${fmtTime(save.data.playSeconds || 0)}`)}
    <h3>PLACES</h3><div class="cards">${places}</div>
    <h3>OCCUPANTS</h3><div class="cards">${people}</div></div>`;
}

// ---- options ----------------------------------------------------------------------------------

export function optionsPanel(el, save, { onSettings, onImported, onNewTape }) {
  const s = save.data.settings;
  el.innerHTML = `<div class="panel-inner narrow">${head('OPTIONS', `world seed ${save.data.worldSeed}`)}
    <div class="opt-row"><label for="opt-sens">Look sensitivity</label><input id="opt-sens" type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}"></div>
    <div class="opt-row"><label for="opt-vol">Volume</label><input id="opt-vol" type="range" min="0" max="1" step="0.02" value="${s.volume}"></div>
    <h3>SAVE CODE</h3>
    <p class="note">Your progress is saved in this browser. Copy this code to carry it somewhere else (photos stay behind).</p>
    <textarea id="opt-export" readonly spellcheck="false"></textarea>
    <div class="opt-row"><button id="opt-copy">Copy code</button><span id="opt-copy-msg" class="note"></span></div>
    <textarea id="opt-import" placeholder="Paste a save code (ML2-...)" spellcheck="false"></textarea>
    <div class="opt-row"><button id="opt-load">Load code</button><span id="opt-load-msg" class="note"></span></div>
    <h3>TAPE</h3>
    <div class="opt-row"><button id="opt-newtape">Start a new tape</button><span class="note">A new building. Discoveries and the logbook are kept.</span></div></div>`;
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
    $('#opt-load-msg').textContent = ok ? 'Loaded. Rewinding...' : 'That code did not take.';
    if (ok) setTimeout(() => onImported?.(), 600);
  });
  let armed = false;
  $('#opt-newtape').addEventListener('click', (e) => {
    if (!armed) {
      armed = true;
      e.target.textContent = 'Really? Click again';
      return;
    }
    onNewTape?.();
  });
}

// ---- paper documents (lore) -------------------------------------------------------------------

/** A typed document on paper. `body` may contain [[redacted]] spans. */
export function paperPanel(el, doc) {
  const body = esc(doc.body).replace(/\[\[(.+?)\]\]/g, (_, t) => `<span class="redact">${t}</span>`);
  el.innerHTML = `<div class="paper"><div class="doc-head">${esc(doc.head)}</div>${body}${doc.sign ? `\n\n<span class="sign">${esc(doc.sign)}</span>` : ''}<div class="hint">E / Esc to put it down</div></div>`;
}
