// A run (a "contract" with Grisholm & Daughters): the ledger, the Instalment schedule and the
// history of nights. Plain data, changed only by these functions (the host's, in co-op).

import { SITES } from '../world/site.js';

export const NIGHTS_PER_INSTALMENT = 3;
// a site holds far more than one crew can carry out before 04:00: the squeeze is time and hands
export const START_LEDGER = 40;
export const FIRST_TARGET = 400;
export const LEFT_BEHIND_FEE = 0.25;

export function newRun(seed) {
  return {
    seed, // world seed: every site's building derives from it
    night: 1, // the night about to be worked (or being worked)
    ledger: START_LEDGER,
    instalment: { n: 1, target: FIRST_TARGET, due: NIGHTS_PER_INSTALMENT },
    siteId: 'coldstore', // tonight's writ
    visits: {}, // siteId -> times worked (the building is new each time)
    tools: [], // requisitioned tools (types), kept in the van between nights
    history: [], // [{ night, siteId, banked, fees, items, leftBehind, note }]
    paid: 0, // instalments met
    banked: 0, // all salvage banked, ever
    best: null, // { type, value }
    over: null, // { night, reason } when the contract has ended
  };
}

export const nightsLeft = (run) => run.instalment.due - run.night + 1;

/** Value multiplier for salvage from a site (riskier writs pay better). */
export const siteValueK = (siteId) => [1, 1, 1.15, 1.3][SITES[siteId]?.hazard || 1];

export function nextTarget(t) {
  return Math.round((t * 1.5 + 50) / 10) * 10;
}

/**
 * Close a night: apply fees, record it, and settle the Instalment if it was due. `report` holds
 * { banked, items, overtime, leftBehind: [pid], lost: [{type}] }. Returns a summary for the
 * report screen: { paid, missed, target, nextTarget, skip }.
 */
export function closeNight(run, report, { solo = true } = {}) {
  const out = { night: run.night, siteId: run.siteId, banked: report.banked, items: report.items, fees: [], paid: false, missed: false, skip: 0 };
  if (report.overtime > 0) {
    run.ledger -= report.overtime;
    out.fees.push({ what: 'Overtime past 03:00', v: report.overtime });
  }
  if (report.leftBehind.length) {
    const fee = Math.max(20, Math.round(run.ledger * LEFT_BEHIND_FEE));
    run.ledger -= fee * report.leftBehind.length;
    out.fees.push({ what: report.leftBehind.length > 1 ? `Recovery of ${report.leftBehind.length} crew` : 'Recovery of crew left behind', v: fee * report.leftBehind.length });
    if (solo) out.skip = 1; // the recovered worker is stood down for a night
  }
  const dead = report.dead || [];
  if (dead.length && !solo) {
    // the crew goes on; the firm bills for bringing the lost ones home
    const fee = Math.max(30, Math.round(Math.max(0, run.ledger) * LEFT_BEHIND_FEE));
    run.ledger -= fee * dead.length;
    out.fees.push({ what: dead.length > 1 ? `Recovery of ${dead.length} crew (signal lost)` : 'Recovery of crew (signal lost)', v: fee * dead.length });
  }
  run.visits[run.siteId] = (run.visits[run.siteId] || 0) + 1;
  run.history.push({ night: run.night, siteId: run.siteId, banked: report.banked, fees: out.fees.reduce((s, f) => s + f.v, 0), items: report.items.length, leftBehind: report.leftBehind.length, dead: dead.length });
  if (dead.length && solo) {
    // a lone receiver whose signal is lost: the contract ends with them
    run.over = { night: run.night, reason: 'clockedOut', cause: dead[0].cause };
    out.missed = true;
    out.clockedOut = dead[0].cause;
    run.night += 1;
    out.ledger = run.ledger;
    return out;
  }
  // the instalment falls due at the end of its last night (a skipped night still counts)
  const endNight = run.night + out.skip;
  out.skipped = out.skip ? run.night + 1 : null;
  if (endNight >= run.instalment.due) {
    out.target = run.instalment.target;
    if (run.ledger >= run.instalment.target) {
      run.ledger -= run.instalment.target;
      run.paid++;
      out.paid = true;
      run.instalment = { n: run.instalment.n + 1, target: nextTarget(run.instalment.target), due: run.instalment.due + NIGHTS_PER_INSTALMENT };
      out.nextTarget = run.instalment.target;
    } else {
      out.missed = true;
      run.over = { night: run.night, reason: 'missed' };
    }
  }
  if (run.ledger < 0 && !run.over) {
    run.over = { night: run.night, reason: 'debt' };
    out.missed = true;
  }
  run.night = endNight + 1;
  out.ledger = run.ledger;
  return out;
}

/** Credit a deposit. */
export function bank(run, item) {
  run.ledger += item.value;
  run.banked += item.value;
  if (!run.best || item.value > run.best.value) run.best = { type: item.type, value: item.value };
}
