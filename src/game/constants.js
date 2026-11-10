export const TICK_HZ = 60;
export const TICK = 1 / TICK_HZ;

// Optional multiplayer server. Unset = single-player (the only mode in Phase 1).
export const MP_URL = import.meta.env?.VITE_MP_URL || '';
