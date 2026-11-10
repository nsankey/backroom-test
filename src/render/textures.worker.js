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

/** Per-pixel noise multiply: amount 0..1, grain size in px. */
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

/** Smooth value noise blotches (stains, wear), drawn as soft radial blobs, wrapped. */
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

function fibers(ctx, w, h, rng, count, light, dark) {
  for (let k = 0; k < count; k++) {
    ctx.fillStyle = rng.chance(0.5) ? light : dark;
    ctx.fillRect(rng.float(0, w), rng.float(0, h), rng.float(1, 2.2), rng.float(1, 2.2));
  }
}

// ---- generators ---------------------------------------------------------------------------

const GEN = {
  carpetGold(rng) {
    return carpet(rng, [150, 112, 44], [96, 66, 26], 'hex');
  },
  carpetRust(rng) {
    return carpet(rng, [140, 64, 34], [86, 36, 20], 'circles');
  },
  carpetAvocado(rng) {
    return carpet(rng, [104, 108, 50], [62, 66, 30], 'stripes');
  },
  carpetBlue(rng) {
    return carpet(rng, [52, 66, 92], [32, 40, 58], 'hex');
  },

  wallpaperStripe(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(206, 190, 150);
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 8; k++) {
      const sx = k * 64;
      x.fillStyle = rgb(186, 164, 118);
      x.fillRect(sx + 6, 0, 22, S);
      x.fillStyle = rgb(140, 104, 64);
      x.fillRect(sx + 34, 0, 3, S);
      x.fillRect(sx + 41, 0, 2, S);
    }
    stainAndAge(x, rng);
    noise(x, S, S, rng, 0.06);
    return c;
  },

  wallpaperOval(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(214, 196, 150);
    x.fillRect(0, 0, S, S);
    x.strokeStyle = rgb(170, 126, 52);
    x.lineWidth = 7;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 5; b++) {
        const cx = a * 128 + (b % 2 ? 64 : 0);
        const cy = b * 128 - 32;
        for (const ox of [-S, 0, S])
          for (const oy of [-S, 0, S]) {
            x.beginPath();
            x.ellipse(cx + ox, cy + oy, 46, 70, 0, 0, Math.PI * 2);
            x.stroke();
          }
      }
    x.strokeStyle = rgb(120, 90, 40, 0.7);
    x.lineWidth = 2;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 5; b++) {
        const cx = a * 128 + (b % 2 ? 64 : 0);
        const cy = b * 128 - 32;
        x.beginPath();
        x.ellipse(cx, cy, 30, 52, 0, 0, Math.PI * 2);
        x.stroke();
      }
    stainAndAge(x, rng);
    noise(x, S, S, rng, 0.06);
    return c;
  },

  wainscot(rng) {
    // 2 m wide x 4 m tall: walnut panels to 1.0 m, chair rail, damask wallpaper above
    const [c, x] = canvas(512, 1024);
    const H = 1024;
    const pxm = H / 4;
    x.fillStyle = rgb(196, 176, 128);
    x.fillRect(0, 0, 512, H);
    // faint vertical damask stripes
    for (let k = 0; k < 8; k++) {
      x.fillStyle = rgb(176, 152, 104, 0.6);
      x.fillRect(k * 64 + 20, 0, 24, H);
      for (let y = 10; y < H; y += 48) {
        x.beginPath();
        x.fillStyle = rgb(160, 132, 86, 0.6);
        x.ellipse(k * 64 + 32, y, 9, 15, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    const railY = H - pxm * 1.0;
    walnutInto(x, rng, 0, railY, 512, H - railY);
    // panel mouldings
    x.strokeStyle = rgb(30, 16, 8, 0.65);
    x.lineWidth = 4;
    for (let k = 0; k < 2; k++) x.strokeRect(k * 256 + 22, railY + 28, 212, H - railY - 70);
    x.fillStyle = rgb(70, 40, 20);
    x.fillRect(0, railY - 10, 512, 16);
    x.fillStyle = rgb(110, 70, 38);
    x.fillRect(0, railY - 10, 512, 4);
    stainAndAge(x, rng, 512, railY);
    noise(x, 512, H, rng, 0.05);
    return c;
  },

  walnut(rng) {
    const [c, x] = canvas();
    walnutInto(x, rng, 0, 0, S, S);
    noise(x, S, S, rng, 0.05);
    return c;
  },

  woodVeneer(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(120, 78, 40);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 120; k++) {
      x.strokeStyle = rgb(80, 48, 22, rng.float(0.1, 0.4));
      x.lineWidth = rng.float(0.5, 2);
      const y = rng.float(0, 256);
      x.beginPath();
      x.moveTo(0, y);
      x.bezierCurveTo(80, y + rng.float(-6, 6), 170, y + rng.float(-6, 6), 256, y);
      x.stroke();
    }
    noise(x, 256, 256, rng, 0.05);
    return c;
  },

  woodDoor(rng) {
    const [c, x] = canvas(256, 512);
    walnutInto(x, rng, 0, 0, 256, 512, true);
    x.strokeStyle = rgb(25, 12, 6, 0.6);
    x.lineWidth = 3;
    x.strokeRect(30, 40, 196, 180);
    x.strokeRect(30, 270, 196, 200);
    noise(x, 256, 512, rng, 0.05);
    return c;
  },

  acoustic(rng) {
    // 2 x 2 ceiling tiles of 0.6 m; texture spans 1.2 m
    const [c, x] = canvas();
    x.fillStyle = rgb(206, 204, 192);
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 2600; k++) {
      x.fillStyle = rgb(120, 118, 106, rng.float(0.25, 0.7));
      const r = rng.float(0.6, 1.8);
      x.beginPath();
      x.arc(rng.float(0, S), rng.float(0, S), r, 0, Math.PI * 2);
      x.fill();
    }
    blotches(x, S, S, rng, 3, 'rgba(150,120,60,A)', 20, 70, 0.35);
    // water-stain rings
    for (let k = 0; k < 2; k++) {
      x.strokeStyle = rgb(140, 104, 50, 0.35);
      x.lineWidth = 2;
      x.beginPath();
      x.arc(rng.float(40, 470), rng.float(40, 470), rng.float(18, 50), 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = rgb(150, 148, 140);
    for (const p of [0, 256]) {
      x.fillRect(p, 0, 7, S);
      x.fillRect(0, p, S, 7);
    }
    x.fillStyle = rgb(230, 230, 222);
    for (const p of [0, 256]) {
      x.fillRect(p + 7, 0, 2, S);
      x.fillRect(0, p + 7, S, 2);
    }
    noise(x, S, S, rng, 0.05);
    return c;
  },

  terrazzo(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(150, 142, 126);
    x.fillRect(0, 0, S, S);
    const chips = [[176, 170, 156], [118, 108, 96], [140, 108, 82], [104, 98, 90], [168, 140, 110], [196, 192, 182]];
    for (let k = 0; k < 3200; k++) {
      const col = rng.pick(chips);
      x.fillStyle = rgb(col[0], col[1], col[2], rng.float(0.35, 0.8));
      const px = rng.float(0, S);
      const py = rng.float(0, S);
      const r = rng.float(0.8, 3.6);
      x.beginPath();
      const n = rng.int(4, 7);
      for (let v = 0; v < n; v++) {
        const a = (v / n) * Math.PI * 2;
        const rr = r * rng.float(0.6, 1.3);
        x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
      }
      x.fill();
    }
    // brass divider strip grid (texture spans 2 m, one strip per 2 m)
    x.fillStyle = rgb(150, 120, 60);
    x.fillRect(0, 0, S, 3);
    x.fillRect(0, 0, 3, S);
    blotches(x, S, S, rng, 6, 'rgba(90,80,60,A)', 40, 120, 0.12);
    noise(x, S, S, rng, 0.04);
    return c;
  },

  vinylCheck(rng) {
    const [c, x] = canvas();
    const a = [210, 200, 170];
    const b = [120, 82, 52];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const col = (i + j) % 2 ? a : b;
        const v = rng.float(0.92, 1.05);
        x.fillStyle = rgb(col[0] * v, col[1] * v, col[2] * v);
        x.fillRect(i * 128, j * 128, 128, 128);
      }
    x.fillStyle = rgb(60, 50, 40, 0.5);
    for (let k = 0; k <= 4; k++) {
      x.fillRect(k * 128 - 1, 0, 2, S);
      x.fillRect(0, k * 128 - 1, S, 2);
    }
    blotches(x, S, S, rng, 8, 'rgba(70,60,40,A)', 30, 110, 0.15);
    noise(x, S, S, rng, 0.05);
    return c;
  },

  paintMint(rng) {
    return paint(rng, [168, 192, 166], true);
  },
  paintCream(rng) {
    return paint(rng, [212, 204, 178], false);
  },
  concrete(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(130, 128, 120);
    x.fillRect(0, 0, S, S);
    blotches(x, S, S, rng, 30, 'rgba(90,88,80,A)', 20, 90, 0.25);
    blotches(x, S, S, rng, 20, 'rgba(170,168,160,A)', 20, 70, 0.2);
    noise(x, S, S, rng, 0.12);
    return c;
  },
  whiteTile(rng) {
    const [c, x] = canvas();
    x.fillStyle = rgb(120, 122, 116);
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        const v = rng.float(0.94, 1.02);
        x.fillStyle = rgb(222 * v, 224 * v, 214 * v);
        x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    blotches(x, S, S, rng, 5, 'rgba(120,110,80,A)', 30, 90, 0.15);
    noise(x, S, S, rng, 0.03);
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
    noise(x, 256, 256, rng, 0.04);
    return c;
  },
  fabricFloral(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(150, 92, 46);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 14; k++) {
      const px = rng.float(0, 256);
      const py = rng.float(0, 256);
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        x.fillStyle = rgb(216, 170, 70, 0.85);
        x.beginPath();
        x.ellipse(px + Math.cos(a) * 12, py + Math.sin(a) * 12, 9, 5, a, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = rgb(90, 50, 20);
      x.beginPath();
      x.arc(px, py, 5, 0, Math.PI * 2);
      x.fill();
    }
    noise(x, 256, 256, rng, 0.08);
    return c;
  },
  vinylOrange(rng) {
    return flat(rng, [176, 82, 30], 0.05, 256);
  },
  vinylBrown(rng) {
    return flat(rng, [92, 58, 34], 0.05, 256);
  },
  laminate(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(178, 150, 108);
    x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 60; k++) {
      x.strokeStyle = rgb(140, 110, 70, rng.float(0.1, 0.3));
      x.beginPath();
      const y = rng.float(0, 256);
      x.moveTo(0, y);
      x.lineTo(256, y + rng.float(-3, 3));
      x.stroke();
    }
    noise(x, 256, 256, rng, 0.04);
    return c;
  },
  paper(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(226, 220, 196);
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = rgb(60, 60, 70, 0.5);
    for (let y = 16; y < 120; y += 7) x.fillRect(12, y, rng.float(60, 104), 2);
    noise(x, 128, 128, rng, 0.04);
    return c;
  },
  manila(rng) {
    return flat(rng, [204, 172, 106], 0.05, 128);
  },
  paperTag(rng) {
    return flat(rng, [226, 214, 170], 0.05, 64);
  },
  cardboard(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(160, 120, 74);
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = rgb(120, 86, 50, 0.6);
    x.fillRect(0, 60, 128, 8);
    noise(x, 128, 128, rng, 0.06);
    return c;
  },
  mattress(rng) {
    return flat(rng, [214, 208, 186], 0.04, 128);
  },
  linen(rng) {
    return flat(rng, [222, 220, 206], 0.03, 128);
  },
  doorFrame(rng) {
    return paint(rng, [150, 140, 116], false, 256);
  },
  baseboard(rng) {
    return flat(rng, [44, 36, 30], 0.06, 64);
  },
  threshold(rng) {
    const [c, x] = canvas(128, 128);
    x.fillStyle = rgb(120, 104, 70);
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 128; k += 6) {
      x.fillStyle = rgb(90, 76, 50);
      x.fillRect(0, k, 128, 2);
    }
    noise(x, 128, 128, rng, 0.08);
    return c;
  },
  blinds(rng) {
    const [c, x] = canvas(128, 128);
    for (let y = 0; y < 128; y += 8) {
      x.fillStyle = rgb(240, 238, 226);
      x.fillRect(0, y, 128, 6);
      x.fillStyle = rgb(170, 168, 150);
      x.fillRect(0, y + 6, 128, 2);
    }
    noise(x, 128, 128, rng, 0.03);
    return c;
  },
  clockFace(rng) {
    const [c, x] = canvas(256, 256);
    x.fillStyle = rgb(30, 22, 16);
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = rgb(226, 218, 196);
    x.beginPath();
    x.arc(128, 128, 120, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = rgb(30, 30, 30);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      x.save();
      x.translate(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100);
      x.rotate(a);
      x.fillRect(-3, -10, 6, k % 3 === 0 ? 22 : 14);
      x.restore();
    }
    // the centre pin, and no hands
    x.beginPath();
    x.arc(128, 128, 5, 0, Math.PI * 2);
    x.fill();
    noise(x, 256, 256, rng, 0.04);
    return c;
  },
  digits() {
    const [c, x] = canvas(640, 64);
    x.fillStyle = rgb(150, 120, 60);
    x.fillRect(0, 0, 640, 64);
    x.fillStyle = rgb(40, 30, 14);
    x.font = 'bold 54px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) x.fillText(String(d), d * 64 + 32, 35);
    return c;
  },
  signs(rng) {
    return signAtlas(rng, false);
  },
  signsGlow(rng) {
    return signAtlas(rng, true);
  },
  vendingGlow(rng) {
    const [c, x] = canvas(256, 512);
    x.fillStyle = rgb(30, 34, 40);
    x.fillRect(0, 0, 256, 512);
    const cols = [[200, 60, 40], [230, 190, 60], [60, 120, 200], [220, 220, 210], [120, 60, 30], [40, 150, 80]];
    for (let r = 0; r < 6; r++) {
      const y = 20 + r * 80;
      x.fillStyle = rgb(150, 150, 150);
      x.fillRect(10, y + 64, 236, 4);
      for (let k = 0; k < 5; k++) {
        if (rng.chance(0.25)) continue;
        const col = rng.pick(cols);
        x.fillStyle = rgb(col[0], col[1], col[2]);
        x.fillRect(18 + k * 46, y + 14, 34, 50);
        x.fillStyle = rgb(255, 255, 255, 0.5);
        x.fillRect(22 + k * 46, y + 20, 6, 36);
      }
    }
    noise(x, 256, 512, rng, 0.05);
    return c;
  },
  scope(rng) {
    const [c, x] = canvas(128, 96);
    x.fillStyle = rgb(4, 20, 8);
    x.fillRect(0, 0, 128, 96);
    for (let line = 0; line < 4; line++) {
      x.strokeStyle = rgb(120, 255, 150, 0.9);
      x.lineWidth = 1.5;
      x.beginPath();
      for (let px = 0; px < 128; px += 2) {
        const y = 14 + line * 22 + Math.sin(px * 0.2 + line) * 3 + rng.float(-3, 3) + (rng.chance(0.03) ? rng.float(-8, 8) : 0);
        x.lineTo(px, y);
      }
      x.stroke();
    }
    return c;
  },
  tvStatic(rng) {
    const [c, x] = canvas(256, 256);
    const img = x.createImageData(256, 256);
    for (let k = 0; k < img.data.length; k += 4) {
      const v = rng.float(20, 235);
      img.data[k] = v;
      img.data[k + 1] = v;
      img.data[k + 2] = v * 1.05;
      img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // horizontal roll bands
    for (let y = 0; y < 256; y += 32) {
      x.fillStyle = rgb(0, 0, 0, 0.15);
      x.fillRect(0, y, 256, 10);
    }
    return c;
  },
  mirror(rng) {
    const [c, x] = canvas(256, 256);
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, rgb(40, 46, 44));
    g.addColorStop(0.5, rgb(70, 78, 74));
    g.addColorStop(1, rgb(34, 38, 36));
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, rng, 6, 'rgba(200,200,190,A)', 20, 60, 0.05);
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

function carpet(rng, base, dark, pattern) {
  const [c, x] = canvas();
  x.fillStyle = rgb(...base);
  x.fillRect(0, 0, S, S);
  x.strokeStyle = rgb(...dark);
  x.fillStyle = rgb(...dark);
  x.lineWidth = 6;
  if (pattern === 'hex') {
    const r = 32;
    for (let row = -1; row < 10; row++)
      for (let col = -1; col < 10; col++) {
        const cx = col * 64 + (row % 2 ? 32 : 0);
        const cy = row * 56;
        x.beginPath();
        for (let v = 0; v <= 6; v++) {
          const a = (v / 6) * Math.PI * 2 + Math.PI / 6;
          x.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
        }
        x.stroke();
      }
    x.fillStyle = rgb(base[0] * 1.15, base[1] * 1.12, base[2] * 1.05);
    for (let row = -1; row < 10; row++)
      for (let col = -1; col < 10; col++) {
        const cx = col * 64 + (row % 2 ? 32 : 0);
        x.fillRect(cx - 4, row * 56 - 4, 8, 8);
      }
  } else if (pattern === 'circles') {
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        x.beginPath();
        x.arc(a * 128 + 64, b * 128 + 64, 46, 0, Math.PI * 2);
        x.stroke();
        x.beginPath();
        x.arc(a * 128 + 64, b * 128 + 64, 22, 0, Math.PI * 2);
        x.fill();
      }
  } else {
    for (let k = 0; k < 8; k++) x.fillRect(k * 64 + 8, 0, 14, S);
  }
  fibers(x, S, S, rng, 26000, rgb(base[0] * 1.25, base[1] * 1.2, base[2] * 1.15, 0.5), rgb(dark[0] * 0.7, dark[1] * 0.7, dark[2] * 0.7, 0.5));
  blotches(x, S, S, rng, 7, 'rgba(40,28,16,A)', 30, 110, 0.22);
  noise(x, S, S, rng, 0.1);
  return c;
}

function paint(rng, col, blocks, size = S) {
  const [c, x] = canvas(size, size);
  x.fillStyle = rgb(...col);
  x.fillRect(0, 0, size, size);
  if (blocks) {
    // painted cinder block, 0.4 x 0.2 m courses (texture spans 1.6 m)
    const bw = size / 4;
    const bh = size / 8;
    x.strokeStyle = rgb(col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 0.8);
    x.lineWidth = 3;
    for (let r = 0; r < 8; r++)
      for (let k = -1; k < 5; k++) x.strokeRect(k * bw + (r % 2 ? bw / 2 : 0), r * bh, bw, bh);
  }
  blotches(x, size, size, rng, 10, 'rgba(110,100,70,A)', size / 16, size / 5, 0.12);
  noise(x, size, size, rng, 0.05);
  return c;
}

function flat(rng, col, n, size) {
  const [c, x] = canvas(size, size);
  x.fillStyle = rgb(...col);
  x.fillRect(0, 0, size, size);
  noise(x, size, size, rng, n);
  return c;
}

function walnutInto(x, rng, x0, y0, w, h, vertical = true) {
  x.fillStyle = rgb(92, 56, 30);
  x.fillRect(x0, y0, w, h);
  const boards = vertical ? Math.max(1, Math.round(w / 64)) : 1;
  for (let bi = 0; bi < boards; bi++) {
    const bx = x0 + (bi * w) / boards;
    const v = rng.float(0.85, 1.12);
    x.fillStyle = rgb(92 * v, 56 * v, 30 * v);
    x.fillRect(bx, y0, w / boards, h);
    for (let k = 0; k < 26; k++) {
      x.strokeStyle = rgb(50, 28, 14, rng.float(0.15, 0.5));
      x.lineWidth = rng.float(0.6, 2.4);
      const gx = bx + rng.float(0, w / boards);
      x.beginPath();
      x.moveTo(gx, y0);
      x.bezierCurveTo(gx + rng.float(-8, 8), y0 + h * 0.3, gx + rng.float(-8, 8), y0 + h * 0.7, gx + rng.float(-3, 3), y0 + h);
      x.stroke();
    }
    x.fillStyle = rgb(30, 16, 8, 0.8);
    x.fillRect(bx, y0, 2, h);
  }
}

function stainAndAge(x, rng, w = S, h = S) {
  // yellowing toward the top of the image (= floor after flip? no: image top is wall top)
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(120,90,30,0.16)');
  g.addColorStop(1, 'rgba(120,90,30,0.0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  blotches(x, w, h, rng, 4, 'rgba(120,90,40,A)', 20, 80, 0.18);
  // a peeling seam
  x.fillStyle = 'rgba(80,60,30,0.3)';
  x.fillRect(rng.int(0, w - 3), 0, 2, h);
}

function signAtlas(rng, glow) {
  const W = 1024;
  const R = SIGN_ROW_COUNT;
  const rowH = 64;
  const [c, x] = canvas(W, rowH * R);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  SIGN_ROWS.forEach((text, r) => {
    const y = r * rowH;
    if (glow) {
      x.fillStyle = rgb(60, 6, 4);
      x.fillRect(0, y, W, rowH);
      x.fillStyle = rgb(255, 220, 210);
    } else {
      x.fillStyle = rgb(36, 26, 18);
      x.fillRect(0, y, W, rowH);
      x.fillStyle = rgb(214, 184, 120);
    }
    const size = text.length > 18 ? 34 : 46;
    x.font = `bold ${size}px "Futura", "Century Gothic", "Trebuchet MS", sans-serif`;
    const spaced = text.split('').join(String.fromCharCode(8202));
    x.fillText(spaced, W / 2, y + rowH / 2 + 2, W - 40);
  });
  noise(x, W, rowH * R, rng, 0.05);
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
