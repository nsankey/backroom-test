// THE SLEEP STUDY: a ward of monitored beds behind one-way glass. Mint cinder block, vinyl
// tile, oscilloscopes still drawing four lines. Nobody slept here for long.

import { rngFor } from '../../core/rng.js';
import { TILE, N, CELL } from '../constants.js';
import { placeLore } from '../kit.js';

export default {
  id: 'sleepLab',
  name: 'The Sleep Study',
  weight: 1.2,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const fx = rng.chance(0.5);
    const fz = rng.chance(0.5);
    // mirrored helpers
    const I = (i) => (fx ? N - 1 - i : i);
    const J = (j) => (fz ? N - 1 - j : j);
    const X = (x) => (fx ? CELL - x : x);
    const Z = (z) => (fz ? CELL - z : z);
    const R = (r) => {
      let o = r;
      if (fx) o = -o;
      if (fz) o = Math.PI - o;
      return o;
    };
    const F = (i0, j0, i1, j1, zone) => plan.fill(I(i0), J(j0), I(i1), J(j1), zone);
    const prop = (type, x, z, r, p) => plan.prop(type, X(x), Z(z), R(r), p);
    const T = TILE;

    plan.ambient = [0.014, 0.02, 0.016];
    const hall = plan.zone({ name: 'hall', ceil: 2.6, floor: 'vinylCheck', wall: 'paintMint', ceilMat: 'acoustic' });
    const ward = plan.zone({ name: 'ward', ceil: 2.75, floor: 'vinylCheck', wall: 'paintMint', ceilMat: 'acoustic' });
    const obs = plan.zone({ name: 'observation', ceil: 2.5, floor: 'carpetBlue', wall: 'walnut', ceilMat: 'acoustic' });

    // ward: x 1.5..10.5, z 2..8 ; observation: x 11..14.5, z 2..8
    F(3, 4, 20, 15, ward);
    F(22, 4, 28, 15, obs);
    const dw = plan.doorway(I(21), J(12), I(21), J(13), { wall: 'doorFrame', floor: 'threshold' });
    void dw;
    // hall: a corridor south of the rooms, x 1..15, z 9..10.5
    F(2, 18, 29, 21, hall);
    // a doorway from the hall into the ward
    plan.doorway(I(8), J(16), I(10), J(17));
    plan.connectDoors([I(15), J(19)], 3, hall);

    // beds against the ward's back wall, where it's solid behind
    const backSolid = (x0, x1) => {
      for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) if (plan.isFloor(I(i), J(3))) return false;
      return true;
    };
    let bedNo = 1;
    for (const bx of [2.6, 5.0, 7.4, 9.8]) {
      if (!backSolid(bx - 0.6, bx + 0.6)) continue;
      prop('labBed', bx, 2.0 + 1.0, 0, {});
      if (bx < 9.5) prop('eegCart', bx + 1.2, 2.45, 0, {});
      plan.interactions.push({ type: 'chart', x: X(bx), y: 0.9, z: Z(4.3), radius: 1.3, prompt: 'Read the chart', bed: bedNo++ });
    }
    // privacy screens and a clock with no hands
    prop('clock', 6.2, 2.0, 0, { y: 2.35 });
    prop('sign', 8.2, 8.0, Math.PI, { text: 'SLEEP STUDY  -  QUIET PLEASE', y: 2.2, w: 2.2, h: 0.13 });
    prop('shelf', 1.5 + 0.25, 7.0, Math.PI / 2, { w: 1.0 });

    // observation room: one-way glass on the divider, desk facing it
    prop('obsWindow', 10.5, 4.3, -Math.PI / 2, { w: 2.2 });
    prop('obsWindow', 11.0, 4.3, Math.PI / 2, { w: 2.2 });
    prop('desk', 11.45, 4.3, Math.PI / 2, { w: 1.5, papers: true });
    prop('officeChair', 12.25, 4.3, -Math.PI / 2, {});
    prop('tableLamp', 11.3, 3.75, 0, { y: 0.74, power: 0.55 });
    prop('filing', 14.15, 2.6, -Math.PI / 2, {});
    prop('filing', 14.15, 3.15, -Math.PI / 2, {});
    prop('eegCart', 13.9, 6.6, -Math.PI / 2, {});
    plan.interactions.push({ type: 'obsDesk', x: X(11.9), y: 0.9, z: Z(4.3), radius: 1.3, prompt: 'Look at the logs' });

    // lighting: ward troffers, a dim observation room, hall troffers
    for (const [x, z] of [[3.3, 4.2], [6.3, 4.2], [9.3, 4.2], [3.3, 6.8], [6.3, 6.8], [9.3, 6.8]]) {
      plan.troffer(X(x), Z(z), { power: 0.9, flicker: rng.chance(0.15), rot: Math.PI / 2 });
    }
    plan.troffer(X(12.75), Z(6.3), { power: 0.45, flicker: true });
    for (const x of [2.5, 6.5, 10.5, 14.0]) plan.troffer(X(x), Z(10), { power: 0.7, flicker: rng.chance(0.2) });
    plan.fillDarkGaps([hall], { gap: 4.2, power: 0.65, rng });

    placeLore(plan);
    plan.point('resident', X(6.2), Z(6.2));
    plan.point('observer', X(12.25), Z(4.3));
    return plan;
  },

  build() {},

  interactions: {
    chart(m, it) {
      m.sound('paper', m.at);
      const lines = [
        `Bed ${it.bed}. Hours slept: 0. Hours slept: 0. Hours slept: 0. Subject reports feeling "rested."`,
        `Bed ${it.bed}. Subject asked what time it was. Reminded there is no time here. Subject laughed.`,
        `Bed ${it.bed}. Subject checked out. (The rest of the line is scribbled through.)`,
        `Bed ${it.bed}. EEG normal. EEG normal. EEG shows a second rhythm under the first.`,
      ];
      m.caption(lines[(it.bed - 1) % lines.length], 5.5);
    },
    obsDesk(m) {
      m.sound('paper', m.at);
      m.caption('Shift log: "Lights checked. All on. Ward quiet. Glass is dark from this side tonight, which it should not be."', 6);
    },
  },

  sounds: { hum: { base: 50, buzz: 0.25, level: 0.75, hvac: 0.5 }, room: 'medium', ambience: ['scopeBeep', 'hvac'] },

  card: {
    title: 'The Sleep Study',
    blurb: 'Monitored beds, one-way glass, oscilloscopes still tracing four lines for four empty pillows.',
  },
};
