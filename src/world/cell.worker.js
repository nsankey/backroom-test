import { generateCell } from './gen.js';

self.onmessage = (e) => {
  const { id, worldSeed, cx, cz, kindOverride } = e.data;
  try {
    const { data, transfer } = generateCell(worldSeed, cx, cz, { kindOverride });
    self.postMessage({ id, data }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack ? err.stack : err) });
  }
};
