// World geometry constants. All distances are metres.

export const CELL = 16; // one place ("cell") is a 16 x 16 m square
export const TILE = 0.5; // layout grid resolution
export const N = CELL / TILE; // 32 tiles per side
export const DOOR_TILES = 3; // boundary doorways are 1.5 m wide
export const DOOR_HEIGHT = 2.2;
export const INNER_DOOR_HEIGHT = 2.1;

export const DIRS = ['N', 'E', 'S', 'W'];
export const DIR_VEC = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};
export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

export const cellKey = (cx, cz) => `${cx},${cz}`;

export function worldToCell(x, z) {
  return [Math.floor(x / CELL), Math.floor(z / CELL)];
}
