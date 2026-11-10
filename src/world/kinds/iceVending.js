// ICE & VENDING: a low-ceilinged nook where the halls meet. The ice machine keeps making ice.

import { rngFor } from '../../core/rng.js';
import { TILE } from '../constants.js';
import { placeLore } from '../kit.js';

export default {
  id: 'iceVending',
  name: 'Ice & Vending',
  weight: 1.5,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    plan.ambient = [0.014, 0.016, 0.018];
    const hall = plan.zone({ name: 'hall', ceil: 2.55, floor: 'carpetGold', wall: 'wallpaperStripe', ceilMat: 'acoustic' });
    const nook = plan.zone({ name: 'nook', ceil: 2.35, floor: 'vinylCheck', wall: 'paintCream', ceilMat: 'acoustic' });

    // the nook: a 6 x 5 m room in the middle, open to the halls
    const ni0 = 10 + rng.int(-1, 1);
    const nj0 = 11 + rng.int(-1, 1);
    const ni1 = ni0 + 11;
    const nj1 = nj0 + 9;
    plan.fill(ni0, nj0, ni1, nj1, nook);
    plan.connectDoors([Math.floor((ni0 + ni1) / 2), Math.floor((nj0 + nj1) / 2)], 4, hall);

    // machines against the nook's north wall (or south, if the north is open)
    const T = TILE;
    // use whichever of the north/south walls has more solid wall behind it
    const openCount = (j) => [...Array(12).keys()].filter((k) => plan.isFloor(ni0 + k, j)).length;
    const northOpen = openCount(nj0 - 1) > openCount(nj1 + 1);
    const wallZ = northOpen ? (nj1 + 1) * T : nj0 * T;
    const behindJ = northOpen ? nj1 + 1 : nj0 - 1;
    const rot = northOpen ? Math.PI : 0;
    const inward = northOpen ? -1 : 1;
    const x0 = ni0 * T;
    const x1 = (ni1 + 1) * T;
    const solidBehind = (a, b) => {
      for (let i = Math.floor(a / T); i <= Math.floor((b - 0.001) / T); i++) if (plan.isFloor(i, behindJ)) return false;
      return true;
    };
    const width = { ice: 1.1, phone: 0.9, vend: 1.15, vend2: 1.15 };
    const order = rng.shuffle(['ice', 'vend', 'vend2', 'phone']);
    let x = x0 + 0.5;
    const machines = [];
    for (const m of order) {
      while (x + width[m] < x1 - 0.3 && !solidBehind(x - 0.3, x + width[m] + 0.3)) x += T;
      if (x + width[m] > x1 - 0.3) break;
      if (m === 'ice') {
        plan.prop('iceMachine', x + 0.4, wallZ + inward * 0.4, rot);
        machines.push(['ice', x + 0.4]);
        x += 1.1;
      } else if (m === 'phone') {
        plan.prop('payphone', x + 0.2, wallZ, rot);
        machines.push(['phone', x + 0.2]);
        x += 0.9;
      } else {
        plan.prop('vending', x + 0.5, wallZ + inward * 0.42, rot, { flicker: rng.chance(0.4) });
        machines.push(['vend', x + 0.5]);
        x += 1.15;
      }
    }
    for (const [type, mx] of machines) {
      const it = { ice: ['iceMachine', 'Take some ice'], phone: ['payphone', 'Pick up the phone'], vend: ['vending', 'Buy something'] }[type];
      plan.interactions.push({ type: it[0], x: mx, y: 1.1, z: wallZ + inward * 1.0, radius: 1.4, prompt: it[1] });
    }
    // two chairs and an ashtray on the opposite side
    // a chair and an ashtray against the east wall of the nook, if it is solid there
    const sideX = x1 - 0.6;
    const cz = (nj0 + nj1 + 1) * 0.5 * T;
    if (!plan.isFloor(ni1 + 1, Math.floor(cz / T)) && !plan.isFloor(ni1 + 1, Math.floor(cz / T) - 1) && !plan.isFloor(ni1 + 1, Math.floor(cz / T) + 1)) {
      plan.prop('chair', sideX, cz - 0.5, -Math.PI / 2, { mat: 'vinylOrange' });
      plan.prop('ashtray', sideX, cz + 0.4, 0);
    }

    // light: a few troffers in the nook, one bad; hall troffers along branches
    plan.troffers(x0 + 0.5, nj0 * T + 0.5, x1 - 0.5, (nj1 + 1) * T - 0.5, { spacing: 2.6, rng, flickerChance: 0.35, power: 0.75 });
    for (let k = 0; k < 6; k++) {
      const tx = rng.float(1.5, 14.5);
      const tz = rng.float(1.5, 14.5);
      const i = Math.floor(tx / T);
      const j = Math.floor(tz / T);
      if (plan.isFloor(i, j) && plan.zoneAt(i, j).name === 'hall' && plan.isFloor(i + 2, j) && plan.isFloor(i - 2, j))
        plan.troffer(tx, tz, { power: 0.7, flicker: rng.chance(0.15) });
    }
    if (rng.chance(0.5)) {
      const p = { x: (x0 + x1) / 2, z: wallZ };
      plan.prop('sign', p.x, p.z, rot, { text: rng.pick(['ICE', 'VENDING']), y: 2.0, w: 0.8, h: 0.12 });
    }
    plan.fillDarkGaps([hall], { gap: 4.2, power: 0.65, rng });
    placeLore(plan);
    plan.point('resident', (x0 + x1) / 2, (nj0 + nj1 + 1) * 0.5 * T);
    return plan;
  },

  build() {},

  interactions: {
    iceMachine(m) {
      m.sound('iceDrop', m.at);
      m.after(1.2, () => m.caption(m.pick(['The bin is full. It is always full.', 'The ice is warm.', 'Something small and hard rattles down the chute. It is a key.']), 3.5));
    },
    payphone(m) {
      m.sound('click', m.at);
      m.after(0.8, () => m.caption(m.pick(['Dial tone. Then, under it, someone breathing on the line.', '"Front desk. Your room is ready." Click.', 'A recorded voice reads out room numbers, slowly, in no order.']), 4.5));
    },
    vending(m) {
      m.sound('click', m.at);
      m.after(0.6, () => m.caption(m.pick(['OUT OF ORDER, says the little card. The machine hums anyway.', 'Every slot holds the same thing. You cannot tell what it is.', 'Your coin goes in. You hear it fall a very long way.']), 4));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.7, level: 1.0, hvac: 0.3 }, room: 'small', ambience: ['iceDrop', 'elevatorChime'] },

  card: {
    title: 'Ice & Vending',
    blurb: 'Where the halls meet. The ice machine keeps filling a bin nobody empties.',
  },
};
