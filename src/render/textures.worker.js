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
    // power-floated warehouse slab: swirl marks, a sealer sheen that has worn into paths,
    // and a saw-cut joint along two edges (the texture spans 4 m, so joints fall every 4 m)
    const [c, x] = canvas();
    x.fillStyle = rgb(126, 124, 116);
    x.fillRect(0, 0, S, S);
    blotches(x, S, S, rng, 26, 'rgba(96,94,86,A)', 30, 120, 0.25);
    blotches(x, S, S, rng, 16, 'rgba(160,158,150,A)', 30, 90, 0.18);
    for (let k = 0; k < 70; k++) {
      x.strokeStyle = rgb(150, 148, 140, rng.float(0.05, 0.14));
      x.lineWidth = rng.float(2, 6);
      x.beginPath();
      x.arc(rng.float(0, S), rng.float(0, S), rng.float(20, 70), rng.float(0, 6), rng.float(0, 6) + rng.float(0.5, 2));
      x.stroke();
    }
    // tyre tracks from pallet trucks
    for (let k = 0; k < 4; k++) {
      x.strokeStyle = rgb(70, 68, 62, rng.float(0.08, 0.16));
      x.lineWidth = rng.float(8, 14);
      x.beginPath();
      const y0 = rng.float(0, S);
      x.moveTo(-10, y0);
      x.bezierCurveTo(S * 0.3, y0 + rng.float(-80, 80), S * 0.7, y0 + rng.float(-80, 80), S + 10, y0);
      x.stroke();
    }
    for (let k = 0; k < 3; k++) crack(x, rng, S, S, 'rgba(50,48,44,0.45)');
    x.fillStyle = rgb(60, 58, 54, 0.8);
    x.fillRect(0, 0, S, 3);
    x.fillRect(0, 0, 3, S);
    specks(x, S, S, rng, 900, ['rgba(80,78,72,0.4)', 'rgba(170,168,160,0.35)']);
    noise(x, S, S, rng, 0.07);
    return c;
  },
  concrete(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(124, 122, 114);
    x.fillRect(0, 0, S, S);
    blotches(x, S, S, rng, 30, 'rgba(88,86,78,A)', 20, 90, 0.25);
    blotches(x, S, S, rng, 20, 'rgba(168,166,158,A)', 20, 70, 0.2);
    specks(x, S, S, rng, 1600, ['rgba(70,68,62,0.5)', 'rgba(180,178,170,0.4)']);
    noise(x, S, S, rng, 0.12);
    return c;
  },
  asphalt(rng) {
    // the yard: worn asphalt with aggregate showing, oil drips, patched cracks
    const [c, x] = canvas();
    x.fillStyle = rgb(48, 48, 50);
    x.fillRect(0, 0, S, S);
    specks(x, S, S, rng, 9000, ['rgba(90,88,86,0.55)', 'rgba(30,30,32,0.6)', 'rgba(120,116,108,0.35)'], 0.4, 1.4);
    blotches(x, S, S, rng, 8, 'rgba(14,12,12,A)', 18, 70, 0.55);
    blotches(x, S, S, rng, 10, 'rgba(96,94,90,A)', 40, 120, 0.15);
    for (let k = 0; k < 6; k++) crack(x, rng, S, S, 'rgba(18,18,18,0.7)');
    // a tar-sealed crack, wider and glossy-black
    x.strokeStyle = rgb(16, 16, 18, 0.85);
    x.lineWidth = 5;
    x.beginPath();
    let px = rng.float(0, S);
    x.moveTo(px, 0);
    for (let y = 0; y <= S; y += 32) x.lineTo((px += rng.float(-14, 14)), y);
    x.stroke();
    noise(x, S, S, rng, 0.08);
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
    // marbled sheet linoleum in a brown-ochre, scuffed
    const [c, x] = canvas();
    x.fillStyle = rgb(122, 98, 66);
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 120; k++) {
      x.strokeStyle = rng.chance(0.5) ? rgb(150, 124, 86, 0.3) : rgb(90, 70, 44, 0.3);
      x.lineWidth = rng.float(2, 8);
      x.beginPath();
      const y0 = rng.float(0, S);
      x.moveTo(-20, y0);
      x.bezierCurveTo(S * 0.3, y0 + rng.float(-30, 30), S * 0.6, y0 + rng.float(-30, 30), S + 20, y0 + rng.float(-20, 20));
      x.stroke();
    }
    for (let k = 0; k < 50; k++) {
      x.strokeStyle = rgb(30, 24, 18, rng.float(0.1, 0.3));
      x.lineWidth = 1.2;
      const px = rng.float(0, S);
      const py = rng.float(0, S);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + rng.float(-30, 30), py + rng.float(-6, 6));
      x.stroke();
    }
    x.fillStyle = 'rgba(30,24,16,0.5)';
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
    // profiled steel sheet, ribs every 0.2 m (texture spans 1.6 m), weathered with rust runs
    const [c, x] = canvas();
    const base = [86, 104, 100];
    for (let px = 0; px < S; px++) {
      const t = (px % 64) / 64;
      const shade = 0.72 + 0.4 * Math.max(0, Math.sin(t * Math.PI * 2)) + (t > 0.45 && t < 0.55 ? -0.15 : 0);
      x.fillStyle = rgb(base[0] * shade, base[1] * shade, base[2] * shade);
      x.fillRect(px, 0, 1, S);
    }
    streaks(x, rng, S, S, 30, 'rgba(120,64,30,A)', 0.8);
    blotches(x, S, S, rng, 10, 'rgba(40,40,36,A)', 30, 100, 0.25);
    noise(x, S, S, rng, 0.07);
    return c;
  },
  facade(rng) {
    // precast concrete panels with rain streaks below every horizontal joint (spans 3 m)
    const [c, x] = canvas();
    x.fillStyle = rgb(118, 116, 108);
    x.fillRect(0, 0, S, S);
    specks(x, S, S, rng, 3000, ['rgba(80,78,72,0.5)', 'rgba(160,156,148,0.4)']);
    streaks(x, rng, S, S, 60, 'rgba(40,38,34,A)', 0.9);
    x.fillStyle = 'rgba(30,30,28,0.7)';
    x.fillRect(0, 0, S, 4);
    x.fillRect(0, 0, 4, S);
    blotches(x, S, S, rng, 8, 'rgba(60,70,40,A)', 30, 90, 0.2);
    noise(x, S, S, rng, 0.08);
    return c;
  },
  plasterOffice(rng) {
    return paint(rng, [192, 186, 166]);
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
    // armoured-van paint: a faded bottle green, scuffed to primer at the edges, dusty low down
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(92, 112, 98);
    x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, rng, 12, 'rgba(120,116,96,A)', 6, 30, 0.25);
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
    // 2 x 2 suspended ceiling tiles of 0.6 m in a white grid; water stains, one tile missing a corner
    const [c, x] = canvas();
    x.fillStyle = rgb(196, 194, 182);
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 2600; k++) {
      x.fillStyle = rgb(116, 114, 104, rng.float(0.25, 0.7));
      x.beginPath();
      x.arc(rng.float(0, S), rng.float(0, S), rng.float(0.6, 1.8), 0, Math.PI * 2);
      x.fill();
    }
    blotches(x, S, S, rng, 3, 'rgba(150,120,60,A)', 20, 70, 0.35);
    for (let k = 0; k < 2; k++) {
      x.strokeStyle = rgb(140, 104, 50, 0.35);
      x.lineWidth = 2;
      x.beginPath();
      x.arc(rng.float(40, 470), rng.float(40, 470), rng.float(18, 50), 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = rgb(150, 150, 144);
    for (const p of [0, 256]) {
      x.fillRect(p, 0, 7, S);
      x.fillRect(0, p, S, 7);
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

function block(rng, col, scuffs) {
  const [c, x] = canvas();
  x.fillStyle = rgb(...col);
  x.fillRect(0, 0, S, S);
  const bw = S / 4;
  const bh = S / 8;
  for (let r = 0; r < 8; r++)
    for (let k = -1; k < 5; k++) {
      const v = rng.float(0.95, 1.04);
      x.fillStyle = rgb(col[0] * v, col[1] * v, col[2] * v);
      x.fillRect(k * bw + (r % 2 ? bw / 2 : 0) + 2, r * bh + 2, bw - 4, bh - 4);
    }
  x.strokeStyle = rgb(col[0] * 0.72, col[1] * 0.72, col[2] * 0.72, 0.8);
  x.lineWidth = 3;
  for (let r = 0; r < 8; r++)
    for (let k = -1; k < 5; k++) x.strokeRect(k * bw + (r % 2 ? bw / 2 : 0), r * bh, bw, bh);
  // pores in the block face
  specks(x, S, S, rng, 2200, [rgb(col[0] * 0.75, col[1] * 0.75, col[2] * 0.75, 0.5)], 0.5, 1.5);
  if (scuffs) blotches(x, S, S, rng, 10, 'rgba(70,64,50,A)', S / 20, S / 7, 0.16);
  noise(x, S, S, rng, 0.05);
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
