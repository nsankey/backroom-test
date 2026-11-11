// Procedural textures, drawn on OffscreenCanvas in a worker. Everything from scratch, seeded.
// Each generator draws a tileable image; the result is flipped so v=0 is the image bottom.

import { RNG, hash } from '../core/rng.js';
import { SIGN_ROWS, SIGN_ROW_COUNT } from '../world/signs.js';

const S = 512;

function canvas(w = S, h = S) {
  const c = new OffscreenCanvas(w, h);
  return [c, c.getContext('2d')];
}

const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/** Per-pixel noise multiply: amount 0..1. */
function noise(ctx, w, h, rng, amount = 0.15, mono = true) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let k = 0; k < d.length; k += 4) {
    const n = 1 + (rng.next() - 0.5) * 2 * amount;
    if (mono) {
      d[k] *= n;
      d[k + 1] *= n;
      d[k + 2] *= n;
    } else {
      d[k] *= 1 + (rng.next() - 0.5) * 2 * amount;
      d[k + 1] *= 1 + (rng.next() - 0.5) * 2 * amount;
      d[k + 2] *= 1 + (rng.next() - 0.5) * 2 * amount;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft radial blotches (stains, wear), wrapped so the texture still tiles. */
function blotches(ctx, w, h, rng, count, color, rMin, rMax, alpha) {
  for (let k = 0; k < count; k++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const r = rng.float(rMin, rMax);
    for (const ox of [-w, 0, w])
      for (const oy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, color.replace('A', alpha * rng.float(0.5, 1)));
        g.addColorStop(1, color.replace('A', 0));
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
  }
}

function specks(ctx, w, h, rng, count, cols, rMin = 0.5, rMax = 1.6) {
  for (let k = 0; k < count; k++) {
    ctx.fillStyle = rng.pick(cols);
    ctx.beginPath();
    ctx.arc(rng.float(0, w), rng.float(0, h), rng.float(rMin, rMax), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A thin wandering crack, wrapped. */
function crack(ctx, rng, w, h, col) {
  let x = rng.float(0, w);
  let y = rng.float(0, h);
  let a = rng.float(0, Math.PI * 2);
  ctx.strokeStyle = col;
  ctx.lineWidth = rng.float(0.8, 1.6);
  ctx.beginPath();
  ctx.moveTo(x, y);
  const n = rng.int(10, 30);
  for (let k = 0; k < n; k++) {
    a += rng.float(-0.6, 0.6);
    x += Math.cos(a) * rng.float(4, 12);
    y += Math.sin(a) * rng.float(4, 12);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Vertical streaks running down from the top (rain, rust, drips). */
function streaks(ctx, rng, w, h, count, col, maxLen = 1) {
  for (let k = 0; k < count; k++) {
    const x = rng.float(0, w);
    const len = rng.float(0.2, maxLen) * h;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, col.replace('A', rng.float(0.1, 0.35)));
    g.addColorStop(1, col.replace('A', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rng.float(1, 6), len);
  }
}

// ---- generators ---------------------------------------------------------------------------

const GEN = {
  // ---- floors ----
  sealedConcrete(rng) {
    // cargo deck plate (the old name stuck): 2 x 1 m plates in a grey-green deck paint, worn
    // through to bright steel down the lanes the loaders ran, tie-down cups at the corners
    // (the texture spans 4 m)
    const [c, x] = canvas();
    plates(x, S, S, rng, [98, 104, 98], 2, 4, { seam: 2, rivet: 0, vary: 0.04, lip: 0.2 });
    blotches(x, S, S, rng, 22, 'rgba(66,66,60,A)', 30, 110, 0.25);
    // loader lanes worn to the metal
    for (let k = 0; k < 4; k++) {
      x.strokeStyle = rgb(150, 150, 144, rng.float(0.1, 0.2));
      x.lineWidth = rng.float(10, 18);
      x.beginPath();
      const y0 = rng.float(0, S);
      x.moveTo(-10, y0);
      x.bezierCurveTo(S * 0.3, y0 + rng.float(-60, 60), S * 0.7, y0 + rng.float(-60, 60), S + 10, y0);
      x.stroke();
    }
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 2; k++) {
        const px = k * (S / 2) + 14;
        const py = r * (S / 4) + 14;
        x.fillStyle = 'rgba(30,30,28,0.75)';
        x.beginPath();
        x.arc(px, py, 6, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = 'rgba(170,170,160,0.45)';
        x.lineWidth = 1.5;
        x.stroke();
      }
    specks(x, S, S, rng, 1400, ['rgba(60,62,58,0.4)', 'rgba(170,172,166,0.3)']);
    noise(x, S, S, rng, 0.06);
    return c;
  },
  concrete(rng) {
    // walkway plate: smaller plates, a grey deck paint gone patchy
    const [c, x] = canvas();
    plates(x, S, S, rng, [104, 106, 104], 2, 2, { seam: 2, rivet: 24, vary: 0.05 });
    blotches(x, S, S, rng, 24, 'rgba(70,70,66,A)', 20, 90, 0.25);
    blotches(x, S, S, rng, 14, 'rgba(160,160,154,A)', 20, 60, 0.15);
    specks(x, S, S, rng, 1600, ['rgba(70,68,62,0.4)', 'rgba(180,178,170,0.3)']);
    noise(x, S, S, rng, 0.08);
    return c;
  },
  asphalt(rng) {
    // the landing pad: gunmetal deck plate under an anti-slip grit, burnt in rings where
    // engines have lit on it, the pad's paint flaking (the texture spans 3 m)
    const [c, x] = canvas();
    plates(x, S, S, rng, [62, 64, 66], 2, 2, { seam: 3, rivet: 26, vary: 0.06, lip: 0.25 });
    specks(x, S, S, rng, 9000, ['rgba(96,96,94,0.45)', 'rgba(30,30,32,0.5)', 'rgba(120,118,112,0.25)'], 0.4, 1.3);
    blotches(x, S, S, rng, 7, 'rgba(18,14,12,A)', 30, 110, 0.5);
    blotches(x, S, S, rng, 4, 'rgba(70,50,36,A)', 20, 60, 0.25);
    blotches(x, S, S, rng, 8, 'rgba(110,112,116,A)', 40, 120, 0.12);
    // flakes of the old pad markings
    for (let k = 0; k < 14; k++) {
      x.fillStyle = rng.chance(0.6) ? rgb(176, 150, 60, rng.float(0.15, 0.35)) : rgb(190, 190, 184, rng.float(0.12, 0.3));
      x.fillRect(rng.float(0, S), rng.float(0, S), rng.float(6, 30), rng.float(3, 10));
    }
    noise(x, S, S, rng, 0.07);
    return c;
  },
  freezerFloor(rng) {
    // pale epoxy with anti-slip grit and frost bloom
    const [c, x] = canvas();
    x.fillStyle = rgb(150, 156, 158);
    x.fillRect(0, 0, S, S);
    specks(x, S, S, rng, 7000, ['rgba(110,116,120,0.5)', 'rgba(196,202,206,0.5)'], 0.4, 1.1);
    blotches(x, S, S, rng, 14, 'rgba(226,234,240,A)', 30, 110, 0.3);
    blotches(x, S, S, rng, 6, 'rgba(90,90,84,A)', 20, 60, 0.2);
    noise(x, S, S, rng, 0.05);
    return c;
  },
  carpetTile(rng) {
    // 4 x 4 office carpet tiles (0.5 m), alternate pile direction, a few replaced in a newer dye
    const [c, x] = canvas();
    const T = S / 4;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const v = rng.float(0.92, 1.05);
        const odd = rng.chance(0.08);
        const base = odd ? [70, 86, 96] : [74, 78, 86];
        x.fillStyle = rgb(base[0] * v, base[1] * v, base[2] * v);
        x.fillRect(i * T, j * T, T, T);
        const across = (i + j) % 2 === 0;
        for (let k = 0; k < 60; k++) {
          x.fillStyle = rgb(base[0] * 1.25, base[1] * 1.25, base[2] * 1.2, 0.18);
          if (across) x.fillRect(i * T, j * T + rng.float(0, T), T, 1);
          else x.fillRect(i * T + rng.float(0, T), j * T, 1, T);
        }
        x.fillStyle = 'rgba(20,20,24,0.35)';
        x.fillRect(i * T, j * T, T, 1);
        x.fillRect(i * T, j * T, 1, T);
      }
    for (let k = 0; k < 24000; k++) {
      x.fillStyle = rng.chance(0.5) ? 'rgba(120,124,136,0.35)' : 'rgba(40,42,50,0.35)';
      x.fillRect(rng.float(0, S), rng.float(0, S), 1.5, 1.5);
    }
    blotches(x, S, S, rng, 6, 'rgba(40,34,26,A)', 20, 70, 0.25);
    noise(x, S, S, rng, 0.08);
    return c;
  },
  lino(rng) {
    // studded rubber deck covering in a dark green-grey, laid in sheets, worn smooth in paths
    // (spans 2.5 m; a stud every ~8 cm)
    const [c, x] = canvas();
    x.fillStyle = rgb(66, 74, 70);
    x.fillRect(0, 0, S, S);
    const st = 16;
    for (let py = st / 2; py < S; py += st)
      for (let px = st / 2; px < S; px += st) {
        x.fillStyle = 'rgba(20,24,22,0.45)';
        x.beginPath();
        x.arc(px + 0.8, py + 0.8, 4.2, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(112,122,116,0.5)';
        x.beginPath();
        x.arc(px - 0.4, py - 0.4, 3.6, 0, Math.PI * 2);
        x.fill();
      }
    // a worn path where the studs are flattened, and dust in the low places
    for (let k = 0; k < 3; k++) {
      x.strokeStyle = rgb(72, 80, 76, 0.55);
      x.lineWidth = rng.float(40, 70);
      x.beginPath();
      const y0 = rng.float(0, S);
      x.moveTo(-20, y0);
      x.bezierCurveTo(S * 0.3, y0 + rng.float(-40, 40), S * 0.6, y0 + rng.float(-40, 40), S + 20, y0);
      x.stroke();
    }
    blotches(x, S, S, rng, 12, 'rgba(40,36,28,A)', 20, 80, 0.25);
    x.fillStyle = 'rgba(20,22,20,0.7)';
    x.fillRect(0, 0, S, 2);
    noise(x, S, S, rng, 0.05);
    return c;
  },
  quarryTile(rng) {
    // red quarry tiles, 6 per metre row (texture spans 1.2 m: 8 x 8), dark grout
    const [c, x] = canvas();
    x.fillStyle = rgb(70, 58, 50);
    x.fillRect(0, 0, S, S);
    const T = S / 8;
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        const v = rng.float(0.85, 1.08);
        x.fillStyle = rgb(146 * v, 68 * v, 46 * v);
        x.fillRect(i * T + 3, j * T + 3, T - 6, T - 6);
      }
    blotches(x, S, S, rng, 10, 'rgba(40,30,24,A)', 30, 90, 0.3);
    noise(x, S, S, rng, 0.08);
    return c;
  },
  diamondPlate(rng) {
    // steel tread plate: raised lozenges in a herringbone, worn bright on top
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(112, 114, 112);
    x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, rng, 10, 'rgba(70,64,56,A)', 20, 60, 0.3);
    const step = 32;
    for (let j = 0; j < 9; j++)
      for (let i = 0; i < 9; i++) {
        const cx = i * step + (j % 2 ? step / 2 : 0);
        const cy = j * step;
        x.save();
        x.translate(cx, cy);
        x.rotate((i + j) % 2 ? 0.8 : -0.8);
        x.fillStyle = rgb(70, 72, 70, 0.9);
        x.fillRect(-11, -2, 22, 5);
        x.fillStyle = rgb(176, 178, 174, 0.9);
        x.fillRect(-11, -3, 22, 2);
        x.restore();
      }
    noise(x, 256, 256, rng, 0.06);
    return c;
  },
  steelGrate(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(14, 14, 14);
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = rgb(96, 98, 94);
    for (let k = 0; k < 128; k += 8) x.fillRect(k, 0, 3, 128);
    for (let k = 0; k < 128; k += 32) x.fillRect(0, k, 128, 3);
    noise(x, 128, 128, rng, 0.08);
    return c;
  },

  // ---- walls ----
  paintBlock(rng) {
    // painted blockwork, 0.4 x 0.2 m courses (texture spans 1.6 m): pale grey-green, scuffed low down
    return block(rng, [150, 158, 148], true);
  },
  paintBlockTeal(rng) {
    return block(rng, [88, 120, 118], true);
  },
  panelWhite(rng) {
    // insulated freezer panels: vertical seams every 1.2 m (two per 2.4 m texture), faint ribbing
    const [c, x] = canvas();
    x.fillStyle = rgb(212, 216, 212);
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < S; k += 16) {
      x.fillStyle = 'rgba(0,0,0,0.03)';
      x.fillRect(k, 0, 8, S);
    }
    for (const p of [0, S / 2]) {
      x.fillStyle = 'rgba(60,64,64,0.45)';
      x.fillRect(p, 0, 3, S);
      x.fillStyle = 'rgba(255,255,255,0.5)';
      x.fillRect(p + 3, 0, 2, S);
    }
    blotches(x, S, S, rng, 8, 'rgba(140,130,100,A)', 20, 80, 0.12);
    streaks(x, rng, S, S, 10, 'rgba(120,110,80,A)', 0.5);
    noise(x, S, S, rng, 0.03);
    return c;
  },
  corrugated(rng) {
    // a hold's bare hull: plating between deep frames every 0.8 m and a stringer across, the
    // frames' shadows and highlights painted in, stained where coolant ran (spans 1.6 m)
    const [c, x] = canvas();
    const base = [84, 96, 94];
    plates(x, S, S, rng, base, 2, 3, { seam: 2, rivet: 20, vary: 0.06 });
    for (const fx of [0, S / 2]) {
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const shade = 0.5 + 0.7 * Math.sin(t * Math.PI);
        x.fillStyle = rgb(base[0] * shade, base[1] * shade, base[2] * shade);
        x.fillRect(fx + k, 0, 1, S);
      }
      x.fillStyle = 'rgba(10,12,12,0.35)';
      x.fillRect(fx + 40, 0, 14, S);
    }
    x.fillStyle = rgb(base[0] * 1.1, base[1] * 1.1, base[2] * 1.1);
    x.fillRect(0, S * 0.62, S, 12);
    x.fillStyle = 'rgba(10,12,12,0.4)';
    x.fillRect(0, S * 0.62 + 12, S, 8);
    streaks(x, rng, S, S, 24, 'rgba(96,76,50,A)', 0.8);
    blotches(x, S, S, rng, 10, 'rgba(40,40,36,A)', 30, 100, 0.25);
    noise(x, S, S, rng, 0.06);
    return c;
  },
  facade(rng) {
    // outer hull plate (spans 3 m): a patchwork of 1.5 m plates in a dozen greys where they
    // were patched over the years, scorched and pitted by dust, stencils half gone
    const [c, x] = canvas();
    plates(x, S, S, rng, [112, 114, 112], 2, 4, { seam: 4, rivet: 16, vary: 0.08, lip: 0.5 });
    // brushed grain along the plates: it is metal, not stone
    for (let k = 0; k < 500; k++) {
      x.fillStyle = rng.chance(0.5) ? 'rgba(200,202,200,0.06)' : 'rgba(40,40,40,0.06)';
      x.fillRect(rng.float(0, S), rng.float(0, S), rng.float(30, 140), 1);
    }
    // patch plates: smaller squares of a different grey
    for (let k = 0; k < 4; k++) {
      const v = rng.float(0.78, 1.15);
      const px = rng.float(10, S - 120);
      const py = rng.float(10, S - 120);
      const w = rng.float(50, 110);
      const h = rng.float(40, 100);
      x.fillStyle = rgb(112 * v, 114 * v, 116 * v);
      x.fillRect(px, py, w, h);
      x.strokeStyle = 'rgba(40,40,40,0.6)';
      x.lineWidth = 2;
      x.strokeRect(px, py, w, h);
    }
    specks(x, S, S, rng, 900, ['rgba(70,70,68,0.4)', 'rgba(170,170,166,0.3)']);
    streaks(x, rng, S, S, 16, 'rgba(30,28,26,A)', 0.5);
    blotches(x, S, S, rng, 5, 'rgba(20,18,16,A)', 30, 100, 0.25);
    // stencil marks: bars and blocks of white and safety yellow, worn
    for (let k = 0; k < 3; k++) {
      x.fillStyle = rng.chance(0.5) ? 'rgba(210,206,190,0.35)' : 'rgba(200,160,50,0.35)';
      const px = rng.float(20, S - 100);
      const py = rng.float(20, S - 40);
      for (let b = 0; b < 4; b++) x.fillRect(px + b * 18, py, 12, 16);
    }
    noise(x, S, S, rng, 0.07);
    return c;
  },
  plasterOffice(rng) {
    // laminated wall board in a cream gone yellow: panels 1 m wide, screwed top and bottom
    const c = paint(rng, [188, 182, 160]);
    const x = c.getContext('2d');
    for (const px of [0, S / 2]) {
      x.fillStyle = 'rgba(70,64,50,0.55)';
      x.fillRect(px, 0, 2, S);
      x.fillStyle = 'rgba(255,250,235,0.35)';
      x.fillRect(px + 2, 0, 1, S);
      for (const py of [12, S / 2 + 12]) {
        x.fillStyle = 'rgba(60,56,48,0.6)';
        x.fillRect(px + 8, py, 3, 3);
        x.fillRect(px + S / 2 - 10, py, 3, 3);
      }
    }
    x.fillStyle = 'rgba(90,84,70,0.35)';
    x.fillRect(0, S / 2, S, 2);
    return c;
  },
  partition(rng) {
    // fabric-covered screen panels in a grey-blue weave
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(84, 92, 106);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 256; k += 2) {
      x.fillStyle = 'rgba(255,255,255,0.04)';
      x.fillRect(0, k, 256, 1);
      x.fillStyle = 'rgba(0,0,0,0.05)';
      x.fillRect(k, 0, 1, 256);
    }
    blotches(x, 256, 256, rng, 5, 'rgba(50,46,40,A)', 10, 40, 0.2);
    noise(x, 256, 256, rng, 0.06);
    return c;
  },
  vanInterior(rng) {
    // painted steel panels with rivet rows (spans 1.2 m)
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(108, 112, 102);
    x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, rng, 8, 'rgba(60,58,50,A)', 10, 50, 0.25);
    x.fillStyle = 'rgba(40,40,36,0.6)';
    x.fillRect(0, 0, 256, 2);
    x.fillRect(0, 0, 2, 256);
    for (let k = 8; k < 256; k += 21) {
      for (const y of [8, 128]) {
        x.fillStyle = 'rgba(30,30,28,0.6)';
        x.beginPath();
        x.arc(k, y, 2.6, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(200,200,190,0.4)';
        x.fillRect(k - 1.5, y - 2, 2, 1);
      }
    }
    noise(x, 256, 256, rng, 0.06);
    return c;
  },
  vanPaint(rng) {
    // the Strongbox's hull: the firm's bottle green, faded, on plates with sunk seams and
    // rivets, scuffed to primer where the docking collars rub (spans 1.5 m)
    const [c, x] = canvas(256, 256);
    plates(x, 256, 256, rng, [92, 112, 98], 2, 1, { seam: 2, rivet: 13, vary: 0.04, lip: 0.25 });
    blotches(x, 256, 256, rng, 12, 'rgba(120,116,96,A)', 6, 30, 0.25);
    blotches(x, 256, 256, rng, 5, 'rgba(30,28,24,A)', 10, 40, 0.3);
    for (let k = 0; k < 40; k++) {
      x.strokeStyle = rgb(150, 150, 140, rng.float(0.05, 0.2));
      x.lineWidth = 1;
      const px = rng.float(0, 256);
      const py = rng.float(0, 256);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + rng.float(-20, 20), py + rng.float(-3, 3));
      x.stroke();
    }
    noise(x, 256, 256, rng, 0.06);
    return c;
  },

  // ---- ceilings ----
  ceilTile(rng) {
    // deckhead: long dark plates, 0.6 m wide, butted along their length with a deep channel
    // between; a perforated strip down the middle of each, rivets along the edges, and a brown
    // bloom where something leaked through from the deck above
    const [c, x] = canvas();
    for (let i = 0; i < 2; i++) {
      const v = rng.float(0.9, 1.06);
      x.fillStyle = rgb(118 * v, 122 * v, 124 * v);
      x.fillRect(i * 256, 0, 256, S);
    }
    for (let py = 10; py < S; py += 9)
      for (let px = 0; px < S; px += 9) {
        const lx = px % 256;
        if (lx < 84 || lx > 172) continue;
        x.fillStyle = 'rgba(16,18,20,0.7)';
        x.fillRect(px, py, 2.4, 2.4);
      }
    // the perforated strip sits in a shallow tray
    x.fillStyle = 'rgba(0,0,0,0.18)';
    for (const p of [76, 332]) x.fillRect(p, 0, 4, S), x.fillRect(p + 100, 0, 4, S);
    x.fillStyle = 'rgba(220,224,226,0.12)';
    for (const p of [80, 336]) x.fillRect(p, 0, 1.5, S), x.fillRect(p + 104, 0, 1.5, S);
    blotches(x, S, S, rng, 2, 'rgba(110,84,50,A)', 20, 70, 0.3);
    // channels between plates, and a thin butt joint across every 1.2 m
    x.fillStyle = rgb(30, 32, 34);
    for (const p of [0, 256]) x.fillRect(p, 0, 10, S);
    x.fillStyle = 'rgba(200,204,206,0.22)';
    for (const p of [0, 256]) x.fillRect(p + 10, 0, 1.5, S);
    x.fillStyle = 'rgba(20,22,24,0.7)';
    x.fillRect(0, 0, S, 2.5);
    // rivets along both edges of each plate
    for (const p of [0, 256])
      for (let py = 16; py < S; py += 32) {
        for (const ox of [20, 236]) {
          x.fillStyle = 'rgba(12,12,12,0.5)';
          x.fillRect(p + ox - 2, py - 1, 5, 5);
          x.fillStyle = 'rgba(190,194,196,0.45)';
          x.fillRect(p + ox - 2, py - 2, 3, 3);
        }
      }
    noise(x, S, S, rng, 0.05);
    return c;
  },
  deckSteel(rng) {
    // underside of a profiled steel roof deck, troughs every 0.3 m (texture spans 2.4 m)
    const [c, x] = canvas();
    for (let py = 0; py < S; py++) {
      const t = (py % 64) / 64;
      const v = t < 0.4 ? 0.55 : t < 0.5 ? 0.8 : t < 0.9 ? 0.68 : 0.85;
      x.fillStyle = rgb(92 * v, 96 * v, 96 * v);
      x.fillRect(0, py, S, 1);
    }
    blotches(x, S, S, rng, 10, 'rgba(30,30,28,A)', 30, 120, 0.3);
    noise(x, S, S, rng, 0.06);
    return c;
  },

  // ---- props ----
  palletWood(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(150, 122, 82);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 80; k++) {
      x.strokeStyle = rgb(110, 84, 50, rng.float(0.15, 0.4));
      x.lineWidth = rng.float(0.5, 2);
      x.beginPath();
      const y = rng.float(0, 256);
      x.moveTo(0, y);
      x.bezierCurveTo(80, y + rng.float(-4, 4), 170, y + rng.float(-4, 4), 256, y);
      x.stroke();
    }
    blotches(x, 256, 256, rng, 6, 'rgba(60,44,26,A)', 10, 40, 0.3);
    noise(x, 256, 256, rng, 0.08);
    return c;
  },
  cardboard(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(160, 122, 78);
    x.fillRect(0, 0, 256, 256);
    // packing tape and a stencilled code
    x.fillStyle = rgb(186, 160, 110, 0.7);
    x.fillRect(0, 118, 256, 20);
    x.fillStyle = rgb(60, 40, 24, 0.7);
    x.font = 'bold 22px "Courier New", monospace';
    x.fillText('HV-' + rng.int(1000, 9999), 24, 70);
    x.fillText('THIS WAY UP', 24, 210);
    blotches(x, 256, 256, rng, 5, 'rgba(90,64,36,A)', 10, 50, 0.25);
    noise(x, 256, 256, rng, 0.06);
    return c;
  },
  paper(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(222, 216, 194);
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = rgb(60, 60, 70, 0.5);
    for (let y = 16; y < 120; y += 7) x.fillRect(12, y, rng.float(60, 104), 2);
    noise(x, 128, 128, rng, 0.04);
    return c;
  },
  laminate(rng) {
    // pale grey office melamine
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(170, 168, 158);
    x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, rng, 6, 'rgba(110,100,80,A)', 20, 60, 0.15);
    noise(x, 256, 256, rng, 0.03);
    return c;
  },
  hazard(rng) {
    // safety chevrons: yellow and black diagonals, chipped
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(210, 170, 40);
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = rgb(26, 24, 20);
    for (let k = -256; k < 512; k += 64) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k + 32, 0);
      x.lineTo(k + 32 + 256, 256);
      x.lineTo(k + 256, 256);
      x.fill();
    }
    blotches(x, 256, 256, rng, 14, 'rgba(110,104,90,A)', 4, 16, 0.6);
    noise(x, 256, 256, rng, 0.08);
    return c;
  },
  stripPlastic(rng) {
    // a strip curtain: overlapping frosted PVC strips, scuffed where trolleys pushed through
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(70, 86, 92);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 256; k += 32) {
      const g = x.createLinearGradient(k, 0, k + 32, 0);
      g.addColorStop(0, 'rgba(180,200,206,0.25)');
      g.addColorStop(0.5, 'rgba(120,140,148,0.1)');
      g.addColorStop(1, 'rgba(30,40,44,0.5)');
      x.fillStyle = g;
      x.fillRect(k, 0, 32, 256);
    }
    blotches(x, 256, 256, rng, 8, 'rgba(30,30,26,A)', 10, 40, 0.3);
    noise(x, 256, 256, rng, 0.05);
    return c;
  },
  doorFrame(rng) {
    return paint(rng, [96, 104, 100], 256);
  },
  threshold(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(104, 104, 98);
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 128; k += 6) {
      x.fillStyle = rgb(70, 70, 66);
      x.fillRect(0, k, 128, 2);
    }
    noise(x, 128, 128, rng, 0.08);
    return c;
  },
  stainless(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(160, 162, 160);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) {
      x.fillStyle = rgb(rng.float(120, 200), rng.float(120, 200), rng.float(120, 200), 0.25);
      x.fillRect(0, rng.float(0, 256), 256, 1);
    }
    blotches(x, 256, 256, rng, 6, 'rgba(90,80,60,A)', 20, 60, 0.15);
    noise(x, 256, 256, rng, 0.04);
    return c;
  },
  noticeboard(rng) {
    // cork, pinned with rotas, memos and a safety poster
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(150, 110, 70);
    x.fillRect(0, 0, 256, 256);
    specks(x, 256, 256, rng, 2500, ['rgba(110,76,44,0.6)', 'rgba(190,150,100,0.5)'], 0.4, 1.2);
    for (let k = 0; k < 7; k++) {
      const w = rng.float(40, 80);
      const h = rng.float(50, 90);
      const px = rng.float(0, 256 - w);
      const py = rng.float(0, 256 - h);
      x.save();
      x.translate(px + w / 2, py + h / 2);
      x.rotate(rng.float(-0.1, 0.1));
      x.fillStyle = rng.pick([rgb(224, 220, 200), rgb(230, 214, 150), rgb(200, 216, 220)]);
      x.fillRect(-w / 2, -h / 2, w, h);
      x.fillStyle = 'rgba(40,40,50,0.55)';
      for (let y = -h / 2 + 8; y < h / 2 - 6; y += 6) x.fillRect(-w / 2 + 5, y, rng.float(w * 0.4, w - 10), 1.5);
      x.fillStyle = rgb(170, 30, 30);
      x.beginPath();
      x.arc(0, -h / 2 + 4, 2.5, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    noise(x, 256, 256, rng, 0.05);
    return c;
  },
  timecards(rng) {
    // a rack of punch cards, every one sitting in the IN column
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(80, 84, 78);
    x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 10; r++)
      for (const col of [0, 1]) {
        const px = 12 + col * 124;
        const py = 10 + r * 24;
        x.fillStyle = rgb(40, 42, 38);
        x.fillRect(px, py + 14, 108, 6);
        if (col === 0 || rng.chance(0.04)) {
          x.fillStyle = rgb(214, 204, 168);
          x.fillRect(px + 8, py, 90, 18);
          x.fillStyle = 'rgba(80,40,30,0.6)';
          x.fillRect(px + 12, py + 4, rng.float(30, 70), 2);
        }
      }
    x.fillStyle = rgb(220, 216, 200);
    x.font = 'bold 12px "Courier New", monospace';
    x.fillText('IN', 54, 252);
    x.fillText('OUT', 176, 252);
    noise(x, 256, 256, rng, 0.05);
    return c;
  },
  bottles(rng) {
    // a crate face of empty green-glass bottles
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(20, 28, 22);
    x.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const g = x.createRadialGradient(i * 32 + 13, j * 32 + 13, 2, i * 32 + 16, j * 32 + 16, 14);
        g.addColorStop(0, 'rgba(150,200,160,0.9)');
        g.addColorStop(1, 'rgba(40,80,50,0.9)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(i * 32 + 16, j * 32 + 16, 13, 0, Math.PI * 2);
        x.fill();
      }
    noise(x, 128, 128, rng, 0.05);
    return c;
  },

  // ---- glow / screens ----
  signs(rng) {
    return signAtlas(rng, false);
  },
  signsGlow(rng) {
    return signAtlas(rng, true);
  },
  screen(rng) {
    // a dot-matrix-era terminal: amber text on black, the cursor block
    const [c, x] = canvas(256, 192);
    x.fillStyle = rgb(8, 6, 2);
    x.fillRect(0, 0, 256, 192);
    x.fillStyle = rgb(255, 176, 60);
    x.font = 'bold 13px "Courier New", monospace';
    const lines = ['GRISHOLM & DAUGHTERS', 'RECEIVERS / LIQUIDATORS', '', '> MANIFEST', '> WRITS', '> REQUISITION', '> LEDGER', '', 'READY_'];
    lines.forEach((l, k) => x.fillText(l, 12, 22 + k * 18));
    for (let y = 0; y < 192; y += 3) {
      x.fillStyle = 'rgba(0,0,0,0.35)';
      x.fillRect(0, y, 256, 1);
    }
    noise(x, 256, 192, rng, 0.08);
    return c;
  },
  vendingGlow(rng) {
    const [c, x] = canvas(256, 512);
    x.fillStyle = rgb(30, 34, 40);
    x.fillRect(0, 0, 256, 512);
    const cols = [[170, 60, 40], [200, 170, 60], [60, 110, 170], [210, 210, 200], [110, 60, 30], [40, 130, 80]];
    for (let r = 0; r < 6; r++) {
      const y = 20 + r * 80;
      x.fillStyle = rgb(150, 150, 150);
      x.fillRect(10, y + 64, 236, 4);
      for (let k = 0; k < 5; k++) {
        if (rng.chance(0.45)) continue; // picked half clean
        const col = rng.pick(cols);
        x.fillStyle = rgb(col[0], col[1], col[2]);
        x.fillRect(18 + k * 46, y + 14, 34, 50);
        x.fillStyle = rgb(255, 255, 255, 0.4);
        x.fillRect(22 + k * 46, y + 20, 6, 36);
      }
    }
    noise(x, 256, 512, rng, 0.05);
    return c;
  },
  noiseGrain(rng) {
    const [c, x] = canvas(256, 256);
    const img = x.createImageData(256, 256);
    for (let k = 0; k < img.data.length; k += 4) {
      img.data[k] = rng.float(0, 255);
      img.data[k + 1] = rng.float(0, 255);
      img.data[k + 2] = rng.float(0, 255);
      img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  },
};

// ---- shared painters --------------------------------------------------------------------

function paint(rng, col, size = S) {
  const [c, x] = canvas(size, size);
  x.fillStyle = rgb(...col);
  x.fillRect(0, 0, size, size);
  blotches(x, size, size, rng, 10, 'rgba(110,100,70,A)', size / 16, size / 5, 0.12);
  noise(x, size, size, rng, 0.05);
  return c;
}

/**
 * Plating: a grid of plates (cols x rows over the whole texture), each a touch different in
 * tone, with recessed seams (a dark line and a lit lip) and rivet rows along them.
 * opts: { seam: px, rivet: spacing px or 0, vary: tone spread, lip }
 */
function plates(x, w, h, rng, col, cols, rows, opts = {}) {
  const pw = w / cols;
  const ph = h / rows;
  const vary = opts.vary ?? 0.05;
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const v = 1 + rng.float(-vary, vary);
      x.fillStyle = rgb(col[0] * v, col[1] * v, col[2] * v);
      x.fillRect(k * pw, r * ph, pw, ph);
    }
  const seam = opts.seam ?? 3;
  x.fillStyle = rgb(col[0] * 0.45, col[1] * 0.45, col[2] * 0.45, 0.85);
  for (let k = 0; k < cols; k++) x.fillRect(k * pw, 0, seam, h);
  for (let r = 0; r < rows; r++) x.fillRect(0, r * ph, w, seam);
  x.fillStyle = rgb(Math.min(255, col[0] * 1.35), Math.min(255, col[1] * 1.35), Math.min(255, col[2] * 1.35), opts.lip ?? 0.35);
  for (let k = 0; k < cols; k++) x.fillRect(k * pw + seam, 0, 1.5, h);
  for (let r = 0; r < rows; r++) x.fillRect(0, r * ph + seam, w, 1.5);
  const sp = opts.rivet ?? 0;
  if (sp) {
    const dot = (px, py) => {
      x.fillStyle = rgb(col[0] * 0.5, col[1] * 0.5, col[2] * 0.5, 0.7);
      x.beginPath();
      x.arc(px, py, 2.2, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = rgb(Math.min(255, col[0] * 1.5), Math.min(255, col[1] * 1.5), Math.min(255, col[2] * 1.5), 0.45);
      x.fillRect(px - 1.4, py - 1.8, 1.6, 1);
    };
    for (let k = 0; k < cols; k++) for (let py = sp / 2; py < h; py += sp) dot(k * pw + seam + 7, py);
    for (let r = 0; r < rows; r++) for (let px = sp / 2; px < w; px += sp) dot(px, r * ph + seam + 7);
  }
}

/** Painted bulkhead panels (spans 1.6 m): a ship's inner walls, scuffed low down. */
function block(rng, col, scuffs) {
  const [c, x] = canvas();
  plates(x, S, S, rng, col, 2, 2, { seam: 3, rivet: 22, vary: 0.035 });
  // a stiffener rib down one seam: shadow, face, highlight
  x.fillStyle = rgb(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55, 0.8);
  x.fillRect(0, 0, 10, S);
  x.fillStyle = rgb(col[0] * 0.92, col[1] * 0.92, col[2] * 0.92);
  x.fillRect(10, 0, 18, S);
  x.fillStyle = rgb(Math.min(255, col[0] * 1.2), Math.min(255, col[1] * 1.2), Math.min(255, col[2] * 1.2), 0.6);
  x.fillRect(27, 0, 3, S);
  // one faded stencil number, off-centre (more would show the tiling)
  x.fillStyle = rgb(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55, 0.4);
  const px = rng.float(S * 0.6, S * 0.8);
  const py = rng.float(S * 0.15, S * 0.35);
  x.fillRect(px, py, 22, 8);
  x.fillRect(px + 27, py, 12, 8);
  specks(x, S, S, rng, 900, [rgb(col[0] * 0.75, col[1] * 0.75, col[2] * 0.75, 0.4)], 0.5, 1.2);
  if (scuffs) blotches(x, S, S, rng, 10, 'rgba(60,58,50,A)', S / 20, S / 7, 0.16);
  streaks(x, rng, S, S, 8, 'rgba(70,60,40,A)', 0.4);
  noise(x, S, S, rng, 0.04);
  return c;
}

function signAtlas(rng, glow) {
  const W = 1024;
  const R = SIGN_ROW_COUNT;
  const rowH = 64;
  const [c, x] = canvas(W, rowH * R);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let r = 0; r < R; r++) {
    const text = SIGN_ROWS[r] || '';
    const y = r * rowH;
    if (glow) {
      x.fillStyle = rgb(6, 40, 16);
      x.fillRect(0, y, W, rowH);
      x.fillStyle = rgb(200, 255, 210);
    } else {
      // Halvard house style: cream stencil on faded teal
      x.fillStyle = rgb(40, 76, 74);
      x.fillRect(0, y, W, rowH);
      x.fillStyle = rgb(222, 214, 186);
    }
    const size = text.length > 18 ? 34 : 46;
    x.font = `bold ${size}px "Arial Narrow", "Helvetica Neue", "Arial", sans-serif`;
    const spaced = text.split('').join(String.fromCharCode(8202));
    x.fillText(spaced, W / 2, y + rowH / 2 + 2, W - 40);
    // stencil bridges: thin gaps cut across the letters
    if (!glow) {
      x.fillStyle = rgb(40, 76, 74);
      for (let k = 0; k < W; k += 37) x.fillRect(k, y + rowH / 2 - 1, 2, 3);
    }
  }
  noise(x, W, rowH * R, rng, 0.06);
  if (!glow) blotches(x, W, rowH * R, rng, 30, 'rgba(30,24,16,A)', 10, 50, 0.25);
  return c;
}

// ---- worker plumbing ----------------------------------------------------------------------

self.onmessage = async (e) => {
  const { name } = e.data;
  const gen = GEN[name];
  if (!gen) {
    self.postMessage({ name, error: 'unknown texture ' + name });
    return;
  }
  try {
    const rng = new RNG(hash('tex', name));
    const c = gen(rng);
    const bmp = await createImageBitmap(c, { imageOrientation: 'flipY' });
    self.postMessage({ name, bitmap: bmp }, [bmp]);
  } catch (err) {
    self.postMessage({ name, error: String(err) });
  }
};

export const TEXTURE_NAMES = Object.keys(GEN);
