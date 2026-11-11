// Procedural textures for the mall, drawn in the texture worker with its helpers. Nothing here is
// traced from a photo or a real directory: the directory is drawn from the game's own plan
// (world/fiesta/mall.js) with the invented shop names.

import { mallMap, C, W as MW, H as MH } from '../world/fiesta/mall.js';
import { MARGIN } from '../world/fiesta/place.js';
import { STORE_NAMES, SHOP_SIGNS, SHOP_SIGN_COLS, SHOP_SIGN_ROWS } from '../world/fiesta/names.js';

export function mallGenerators({ canvas, rgb, noise, blotches, S }) {
  const FONTS = ['"Futura", "Century Gothic", sans-serif', '"Georgia", serif', '"Trebuchet MS", sans-serif', '"Brush Script MT", "Segoe Script", cursive', '"Impact", "Arial Black", sans-serif', '"Courier New", monospace', '"Palatino Linotype", "Book Antiqua", serif', '"Century Gothic", "Verdana", sans-serif'];
  const GLOW_COLS = [[255, 120, 90], [120, 220, 255], [255, 220, 130], [255, 255, 245], [170, 255, 170], [255, 150, 220], [255, 190, 90]];

  function shopAtlas(rng, glow) {
    const cw = 1024;
    const rh = 64;
    const [c, x] = canvas(cw * SHOP_SIGN_COLS, rh * SHOP_SIGN_ROWS);
    x.fillStyle = glow ? rgb(10, 10, 12) : rgb(196, 190, 176);
    x.fillRect(0, 0, cw * SHOP_SIGN_COLS, rh * SHOP_SIGN_ROWS);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    SHOP_SIGNS.forEach((name, k) => {
      const col = k % SHOP_SIGN_COLS;
      const row = Math.floor(k / SHOP_SIGN_COLS);
      const x0 = col * cw;
      const y0 = row * rh;
      const font = FONTS[(k * 5 + 3) % FONTS.length];
      const script = font.includes('Script');
      const size = script ? 50 : name.length > 20 ? 36 : 44;
      x.font = `${script ? '' : 'bold '}${size}px ${font}`;
      if (glow) {
        const g = GLOW_COLS[(k * 3 + 1) % GLOW_COLS.length];
        // channel letters: a soft halo, then the face
        x.shadowColor = rgb(g[0], g[1], g[2], 0.9);
        x.shadowBlur = 10;
        x.fillStyle = rgb(g[0], g[1], g[2]);
        x.fillText(name, x0 + cw / 2, y0 + rh / 2 + 2, cw - 60);
        x.shadowBlur = 0;
        x.fillStyle = rgb(255, 255, 250, 0.55);
        x.fillText(name, x0 + cw / 2, y0 + rh / 2 + 2, cw - 60);
      } else {
        x.fillStyle = rgb(60, 52, 46);
        x.fillText(name, x0 + cw / 2, y0 + rh / 2 + 2, cw - 60);
      }
    });
    noise(x, cw * SHOP_SIGN_COLS, rh * SHOP_SIGN_ROWS, rng, 0.04);
    return c;
  }

  return {
    asphalt(rng) {
      // 5.5 m square: worn asphalt, cracks, oil, two faded stall lines. Sun-bleached desert
      // asphalt is a pale grey, not black (and black asphalt under sodium baked to nothing)
      const [c, x] = canvas();
      x.fillStyle = rgb(104, 100, 94);
      x.fillRect(0, 0, S, S);
      for (let k = 0; k < 9000; k++) {
        const v = rng.float(70, 140);
        x.fillStyle = rgb(v, v * 0.98, v * 0.95, 0.5);
        x.fillRect(rng.float(0, S), rng.float(0, S), 1.5, 1.5);
      }
      blotches(x, S, S, rng, 8, 'rgba(40,36,32,A)', 20, 70, 0.35);
      x.strokeStyle = 'rgba(40,36,32,0.7)';
      x.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) {
        let px = rng.float(0, S);
        let py = rng.float(0, S);
        x.beginPath();
        x.moveTo(px, py);
        for (let s = 0; s < 12; s++) {
          px += rng.float(-14, 14);
          py += rng.float(-14, 14);
          x.lineTo(px, py);
        }
        x.stroke();
      }
      for (const lx of [0, S / 2]) {
        for (let y = 0; y < S; y += 4) {
          if (rng.chance(0.25)) continue;
          x.fillStyle = rgb(196, 188, 150, rng.float(0.35, 0.7));
          x.fillRect(lx - 4 + rng.float(-1, 1), y, 9, 4);
        }
      }
      noise(x, S, S, rng, 0.06);
      return c;
    },

    stucco(rng) {
      const [c, x] = canvas();
      x.fillStyle = rgb(184, 166, 140);
      x.fillRect(0, 0, S, S);
      for (let k = 0; k < 16000; k++) {
        const v = rng.float(0.8, 1.15);
        x.fillStyle = rgb(184 * v, 166 * v, 140 * v, 0.45);
        x.fillRect(rng.float(0, S), rng.float(0, S), rng.float(1, 3), rng.float(1, 3));
      }
      // rain streaks down from the top
      for (let k = 0; k < 18; k++) {
        const g = x.createLinearGradient(0, 0, 0, S);
        g.addColorStop(0, 'rgba(70,60,50,0.22)');
        g.addColorStop(1, 'rgba(70,60,50,0)');
        x.fillStyle = g;
        x.fillRect(rng.float(0, S), 0, rng.float(4, 18), rng.float(S * 0.3, S));
      }
      noise(x, S, S, rng, 0.05);
      return c;
    },

    nightSky(rng) {
      const [c, x] = canvas(256, 256);
      x.fillStyle = rgb(13, 11, 11);
      x.fillRect(0, 0, 256, 256);
      blotches(x, 256, 256, rng, 6, 'rgba(40,26,16,A)', 40, 120, 0.4);
      noise(x, 256, 256, rng, 0.05);
      return c;
    },

    mallTile(rng) {
      // 2.4 m square: 0.6 m cream tiles, grout, the dust of five years and a few cracked tiles
      const [c, x] = canvas();
      const t = S / 4;
      x.fillStyle = rgb(120, 112, 100);
      x.fillRect(0, 0, S, S);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const v = rng.float(0.94, 1.04);
          x.fillStyle = rgb(206 * v, 196 * v, 178 * v);
          x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
          // faint veining
          for (let k = 0; k < 5; k++) {
            x.strokeStyle = rgb(170, 160, 146, rng.float(0.1, 0.3));
            x.lineWidth = rng.float(0.5, 1.5);
            x.beginPath();
            x.moveTo(i * t + rng.float(0, t), j * t + rng.float(0, t));
            x.bezierCurveTo(i * t + rng.float(0, t), j * t + rng.float(0, t), i * t + rng.float(0, t), j * t + rng.float(0, t), i * t + rng.float(0, t), j * t + rng.float(0, t));
            x.stroke();
          }
        }
      for (let k = 0; k < 2; k++) {
        const i = rng.int(0, 3);
        const j = rng.int(0, 3);
        x.strokeStyle = 'rgba(60,50,40,0.6)';
        x.lineWidth = 1.2;
        x.beginPath();
        x.moveTo(i * t + 4, j * t + rng.float(10, t - 10));
        x.lineTo(i * t + t / 2, j * t + rng.float(10, t - 10));
        x.lineTo(i * t + t - 4, j * t + rng.float(10, t - 10));
        x.stroke();
      }
      blotches(x, S, S, rng, 12, 'rgba(110,96,76,A)', 30, 120, 0.2);
      for (let k = 0; k < 30; k++) {
        x.strokeStyle = rgb(70, 60, 50, rng.float(0.05, 0.16));
        x.lineWidth = rng.float(1, 3);
        const sx = rng.float(0, S);
        const sy = rng.float(0, S);
        x.beginPath();
        x.moveTo(sx, sy);
        x.lineTo(sx + rng.float(-50, 50), sy + rng.float(-12, 12));
        x.stroke();
      }
      noise(x, S, S, rng, 0.04);
      return c;
    },

    mallWall(rng) {
      const [c, x] = canvas(256, 256);
      x.fillStyle = rgb(196, 178, 168);
      x.fillRect(0, 0, 256, 256);
      blotches(x, 256, 256, rng, 8, 'rgba(150,130,110,A)', 20, 70, 0.14);
      noise(x, 256, 256, rng, 0.04);
      return c;
    },

    mallCeil(rng) {
      const [c, x] = canvas(256, 256);
      x.fillStyle = rgb(206, 204, 194);
      x.fillRect(0, 0, 256, 256);
      blotches(x, 256, 256, rng, 3, 'rgba(150,120,70,A)', 20, 60, 0.25);
      noise(x, 256, 256, rng, 0.03);
      return c;
    },

    skylight(rng) {
      // 3 m square: four panes in bronze frames, night above them, dust and leaves on top
      const [c, x] = canvas();
      x.fillStyle = rgb(62, 50, 36);
      x.fillRect(0, 0, S, S);
      const p = S / 2;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const g = x.createLinearGradient(i * p, j * p, i * p + p, j * p + p);
          g.addColorStop(0, rgb(28, 32, 40));
          g.addColorStop(1, rgb(18, 20, 26));
          x.fillStyle = g;
          x.fillRect(i * p + 10, j * p + 10, p - 20, p - 20);
        }
      // dust banked against the frames, and a skin of it everywhere
      blotches(x, S, S, rng, 30, 'rgba(140,128,110,A)', 20, 90, 0.35);
      for (let i = 0; i <= 2; i++) {
        const g = x.createLinearGradient(0, i * p - 30, 0, i * p + 30);
        g.addColorStop(0, 'rgba(150,136,116,0)');
        g.addColorStop(0.5, 'rgba(150,136,116,0.45)');
        g.addColorStop(1, 'rgba(150,136,116,0)');
        x.fillStyle = g;
        x.fillRect(0, i * p - 30, S, 60);
      }
      for (let k = 0; k < 40; k++) {
        x.fillStyle = rgb(60, 44, 26, rng.float(0.4, 0.8));
        x.beginPath();
        x.ellipse(rng.float(0, S), rng.float(0, S), rng.float(3, 9), rng.float(2, 4), rng.float(0, 3), 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = rgb(70, 56, 40);
      for (let i = 0; i <= 2; i++) {
        x.fillRect(i * p - 8, 0, 16, S);
        x.fillRect(0, i * p - 8, S, 16);
      }
      noise(x, S, S, rng, 0.05);
      return c;
    },

    foodTile(rng) {
      const [c, x] = canvas(256, 256);
      const t = 64;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const v = rng.float(0.93, 1.04);
          const col = (i + j) % 2 ? [214, 210, 198] : [62, 120, 116];
          x.fillStyle = rgb(col[0] * v, col[1] * v, col[2] * v);
          x.fillRect(i * t, j * t, t, t);
        }
      x.fillStyle = 'rgba(40,40,36,0.5)';
      for (let k = 0; k <= 4; k++) {
        x.fillRect(k * t - 1, 0, 2, 256);
        x.fillRect(0, k * t - 1, 256, 2);
      }
      blotches(x, 256, 256, rng, 8, 'rgba(90,80,60,A)', 15, 60, 0.22);
      noise(x, 256, 256, rng, 0.04);
      return c;
    },

    grille(rng) {
      // a rolling grille: horizontal links with rows of slots you can almost see through
      const [c, x] = canvas(256, 256);
      // (bright on purpose: it sits under the bulkhead out of the downlights, and at the old
      // 110 grey every closed shop baked to a black slab)
      x.fillStyle = rgb(168, 170, 164);
      x.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) {
        x.fillStyle = rgb(214, 216, 208);
        x.fillRect(0, y, 256, 3);
        x.fillStyle = rgb(112, 114, 110);
        x.fillRect(0, y + 13, 256, 3);
        for (let s = 0; s < 256; s += 16) {
          x.fillStyle = rgb(40, 38, 34);
          x.fillRect(s + 3, y + 5, 10, 6);
        }
      }
      blotches(x, 256, 256, rng, 6, 'rgba(90,70,40,A)', 20, 60, 0.18);
      noise(x, 256, 256, rng, 0.05);
      return c;
    },

    escalatorStep(rng) {
      const [c, x] = canvas(128, 128);
      x.fillStyle = rgb(70, 72, 70);
      x.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 128; k += 6) {
        x.fillStyle = rgb(120, 122, 118);
        x.fillRect(k, 0, 3, 128);
      }
      x.fillStyle = rgb(190, 160, 40, 0.8);
      x.fillRect(0, 0, 128, 6);
      noise(x, 128, 128, rng, 0.06);
      return c;
    },

    basinDry(rng) {
      const [c, x] = canvas(256, 256);
      const t = 16;
      for (let i = 0; i < 16; i++)
        for (let j = 0; j < 16; j++) {
          const v = rng.float(0.8, 1.1);
          x.fillStyle = rgb(54 * v, 112 * v, 118 * v);
          x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
        }
      // the tide line of water that dried years ago, and dust
      blotches(x, 256, 256, rng, 20, 'rgba(190,180,150,A)', 10, 60, 0.4);
      noise(x, 256, 256, rng, 0.06);
      return c;
    },

    shopSigns(rng) {
      return shopAtlas(rng, false);
    },
    shopSignsGlow(rng) {
      return shopAtlas(rng, true);
    },

    ghostSign(rng) {
      // where a sign came down: a cleaner rectangle, screw holes, outlines too faint to read
      const [c, x] = canvas(512, 128);
      x.fillStyle = rgb(150, 140, 128);
      x.fillRect(0, 0, 512, 128);
      x.fillStyle = rgb(178, 168, 154);
      x.fillRect(20, 22, 472, 84);
      for (let k = 0; k < 9; k++) {
        const gx = 40 + k * 50 + rng.float(-6, 6);
        x.strokeStyle = rgb(120, 112, 100, 0.35);
        x.lineWidth = 2;
        x.strokeRect(gx, 34 + rng.float(-3, 3), rng.float(24, 40), rng.float(52, 62));
        x.fillStyle = rgb(50, 46, 40, 0.8);
        x.fillRect(gx + 4, 40, 3, 3);
        x.fillRect(gx + 14, 86, 3, 3);
      }
      blotches(x, 512, 128, rng, 6, 'rgba(90,80,60,A)', 10, 40, 0.2);
      noise(x, 512, 128, rng, 0.05);
      return c;
    },

    menuBoard(rng) {
      const [c, x] = canvas(512, 128);
      x.fillStyle = rgb(26, 22, 20);
      x.fillRect(0, 0, 512, 128);
      x.font = 'bold 13px "Trebuchet MS", sans-serif';
      x.textBaseline = 'middle';
      for (let col = 0; col < 3; col++) {
        const x0 = 12 + col * 168;
        x.fillStyle = rgb(200, 70, 40);
        x.fillRect(x0, 8, 150, 18);
        x.fillStyle = rgb(255, 240, 210);
        x.fillText(['COMBO MEALS', 'SIDES', 'DRINKS'][col], x0 + 6, 17);
        for (let r = 0; r < 5; r++) {
          const y = 40 + r * 17;
          x.fillStyle = rgb(240, 232, 210);
          x.fillText(`${col === 0 ? 'No. ' + (r + 1) : ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA', 'FAMILY'][r]}`, x0 + 6, y);
          x.fillText('-.--', x0 + 116, y);
        }
      }
      noise(x, 512, 128, rng, 0.05);
      return c;
    },

    mallDirectory(rng) {
      // the kiosk directory: both levels side by side, numbered shops, a legend, and a red dot
      const CW = 768;
      const CH = 1024;
      const [c, x] = canvas(CW, CH);
      x.fillStyle = rgb(16, 30, 46);
      x.fillRect(0, 0, CW, CH);
      x.fillStyle = rgb(232, 226, 210);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = 'bold 34px "Futura", "Century Gothic", sans-serif';
      x.fillText('D I R E C T O R Y', CW / 2, 34);
      x.font = '15px "Futura", "Century Gothic", sans-serif';
      x.fillText('SHOPPING CENTER  -  TWO LEVELS  -  FOUR DEPARTMENT STORES', CW / 2, 64);
      const m = mallMap();
      // mall outline bounds (block tiles)
      const I0 = Math.round(MARGIN / 0.5);
      const J0 = I0;
      const w = 301 * 2;
      const h = 429 * 2;
      const pw = 360;
      const ph = (pw * h) / w;
      const sc = pw / w;
      const plans = [
        { lv: 0, ox: 18, label: 'LOWER LEVEL' },
        { lv: 1, ox: CW - 18 - pw, label: 'UPPER LEVEL' },
      ];
      const oy = 96;
      const store = (s) => {
        const [x0, z0, x1, z1] = s.rect;
        return [(x0 / 0.5 - I0) * sc, (z0 / 0.5 - J0) * sc, ((x1 - x0) / 0.5) * sc, ((z1 - z0) / 0.5) * sc];
      };
      let num = 0;
      const legend = [[], []];
      for (const pl of plans) {
        x.save();
        x.translate(pl.ox, oy);
        const arr = pl.lv ? m.hi : m.lo;
        // the building, then public space, then shops
        for (let j = 0; j < h; j += 2)
          for (let i = 0; i < w; i += 2) {
            const k = (J0 + j) * MW + (I0 + i);
            if (J0 + j >= MH || I0 + i >= MW) continue;
            const inM = m.inMall[k];
            if (!inM) continue;
            const code = arr[k];
            const lo = m.lo[k];
            let col = rgb(70, 82, 96); // department stores and back of house
            if (code === C.CONC || code === C.ENTRY || code === C.VEST || code === C.FRONT) col = rgb(214, 204, 180);
            else if (code === C.FOOD || code === C.FOODSKY) col = rgb(220, 170, 120);
            else if (code === C.STALL) col = rgb(200, 120, 80);
            else if (code === C.RAMP) col = rgb(240, 240, 240);
            else if (code === C.STORE) col = rgb(120, 150, 170);
            else if (pl.lv && (lo === C.CONC || lo === C.RAMP)) col = rgb(36, 52, 70); // the wells
            x.fillStyle = col;
            x.fillRect(i * sc, j * sc, 2 * sc + 0.6, 2 * sc + 0.6);
          }
        // shop outlines and numbers
        x.strokeStyle = rgb(16, 30, 46);
        x.lineWidth = 1;
        x.font = 'bold 9px "Trebuchet MS", sans-serif';
        for (const s of m.stores) {
          if (s.level !== pl.lv) continue;
          const [sx, sy, sw, sh] = store(s);
          x.strokeRect(sx, sy, sw, sh);
          const n = (pl.lv ? 200 : 100) + ++num % 100;
          legend[pl.lv].push([n, s.name]);
          x.fillStyle = rgb(16, 30, 46);
          x.fillText(String(n), sx + sw / 2, sy + sh / 2);
        }
        num = 0;
        x.fillStyle = rgb(232, 226, 210);
        x.font = 'bold 16px "Futura", "Century Gothic", sans-serif';
        x.fillText(pl.label, pw / 2, -10 + 2);
        // department stores: just a word, the names came down with the signs
        x.fillStyle = rgb(200, 210, 220);
        x.font = '11px "Futura", "Century Gothic", sans-serif';
        for (const [ax, az] of [[176, 80], [140, 380], [32, 233], [258, 226]]) x.fillText('DEPT. STORE', ax * 2 * sc, az * 2 * sc);
        x.restore();
      }
      // you are here: placed in the west department store, where nobody can stand
      const yx = plans[0].ox + 30 * 2 * sc;
      const yy = oy + 236 * 2 * sc;
      x.fillStyle = rgb(230, 30, 24);
      x.beginPath();
      x.arc(yx, yy, 7, 0, Math.PI * 2);
      x.fill();
      x.font = 'bold 12px "Trebuchet MS", sans-serif';
      x.textAlign = 'left';
      x.fillText('YOU ARE HERE', yx + 10, yy);
      // legend
      const top = oy + ph + 18;
      x.font = '11px "Trebuchet MS", sans-serif';
      x.textAlign = 'left';
      const cols = 4;
      const all = [...legend[0], ...legend[1]].filter(([, name]) => name);
      const per = Math.ceil(all.length / cols);
      all.forEach(([n, name], k) => {
        const cx = 16 + Math.floor(k / per) * (CW / cols);
        const cy = top + (k % per) * 13.5;
        x.fillStyle = rgb(160, 190, 220);
        x.fillText(String(n), cx, cy);
        x.fillStyle = rgb(232, 226, 210);
        x.fillText(name.length > 22 ? name.slice(0, 21) + '.' : name, cx + 30, cy);
      });
      x.fillStyle = rgb(160, 170, 180);
      x.font = '12px "Trebuchet MS", sans-serif';
      x.textAlign = 'center';
      x.fillText('FOOD COURT UPPER LEVEL   -   CUSTOMER SERVICE LOWER LEVEL   -   HOURS  --:--  TO  --:--', CW / 2, CH - 18);
      void STORE_NAMES;
      noise(x, CW, CH, rng, 0.04);
      return c;
    },
  };
}
