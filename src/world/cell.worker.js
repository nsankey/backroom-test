import { generateCell } from './gen.js';

self.onmessage = (e) => {
  const { id, site, cx, cz, kindOverride } = e.data;
  try {
    const { data, transfer } = generateCell(site, cx, cz, { kindOverride });
    self.postMessage({ id, data }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack ? err.stack : err) });
  }
};
