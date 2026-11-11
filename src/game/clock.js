// The night clock: Grisholm's policy window runs 21:00 to 04:00. Everything here is a pure
// function of the shift tick, so every client derives the same time, brownout and alarms.

import { TICK_HZ } from './constants.js';
import { hashFloat } from '../core/rng.js';

export const START_MIN = 21 * 60; // 21:00
export const SHIFT_MIN = 7 * 60; // to 04:00
export const LAST_CALL_MIN = 6 * 60; // 03:00, the horn
export const OVERTIME_PER_10 = 5; // ħ per ten minutes past last call
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
// real seconds in a full shift (default nine minutes); ?shift=120 for quick tests
export const SHIFT_SECONDS = Math.max(30, Number(params.get('shift')) || 540);

/** Minutes since 21:00 after `ticks` of shift time. */
export const shiftMinutes = (ticks) => (ticks / (SHIFT_SECONDS * TICK_HZ)) * SHIFT_MIN;
/** Ticks at which the shift reaches `min` minutes past 21:00. */
export const ticksAt = (min) => Math.round((min / SHIFT_MIN) * SHIFT_SECONDS * TICK_HZ);

/** "23:41" for minutes since 21:00. */
export function fmtClock(min) {
  const t = Math.floor(START_MIN + min) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Facility power, 1 = full. The generators shed load through the night: steady until 23:00,
 * then down to about half by 02:00 and a third by 04:00.
 */
export function facilityPower(min) {
  const k = [
    [0, 1],
    [120, 1],
    [300, 0.55],
    [420, 0.35],
  ];
  for (let i = 1; i < k.length; i++) {
    if (min <= k[i][0]) {
      const t = (min - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * s;
    }
  }
  return k[k.length - 1][1];
}

/**
 * When a cell's flickering bank of lights trips out for good (minutes since 21:00), or Infinity.
 * About two cells in three lose their bank some time between midnight and half past three.
 */
export function bankTripMin(siteSeed, cx, cz) {
  if (hashFloat(siteSeed, 'trip?', cx, cz) > 0.68) return Infinity;
  return 180 + hashFloat(siteSeed, 'trip', cx, cz) * 210;
}

/** Overtime charged for leaving at `min`. */
export function overtimeFee(min) {
  if (min <= LAST_CALL_MIN) return 0;
  return Math.ceil((min - LAST_CALL_MIN) / 10) * OVERTIME_PER_10;
}
