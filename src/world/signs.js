// Rows of the sign atlas texture. Shared by the texture worker (draws them) and the builder
// (maps UVs to a row). Append only, so existing rows keep their index.
export const SIGN_ROWS = [
  'HALVARD',
  'GOODS IN',
  'EXIT',
  'NO ENTRY',
  'STAFF ONLY',
  'COLD STORE  -  KEEP DOOR SHUT',
  'RECORDS',
  'QUIET PLEASE',
  'CLOCK IN  -  CLOCK OUT',
  'BOTTLING HALL',
  'MIND THE STEP',
  'NIGHT SAFE',
  'GRISHOLM & DAUGHTERS',
  'NO WORKING ALONE',
  'ALL STOCK IS COUNTED',
  'LOADING BAY 2',
  'TYPING POOL',
  'PLANT ROOM',
  'SHUT OFF AT 04:00',
  'HALVARD MUTUAL',
];
export const SIGN_ROW_COUNT = 24;
export const signRow = (text) => SIGN_ROWS.indexOf(text);
