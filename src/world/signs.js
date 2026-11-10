// Rows of the sign atlas texture. Shared by the texture worker (draws them) and the builder
// (maps UVs to a row). Append only, so existing rows keep their index.
export const SIGN_ROWS = [
  'MERIDIAN LODGE',
  'FRONT DESK',
  'EXIT',
  'ICE',
  'STAFF ONLY',
  'SLEEP STUDY  -  QUIET PLEASE',
  'OBSERVATION',
  'GUEST ROOMS 100-140',
  'VENDING',
  'BALLROOM',
  'LAUNDRY',
  'DRAFTING',
  'PLEASE RING FOR SERVICE',
  'NO ONE IS TO TURN OFF THE LIGHTS',
  'CHECK-OUT IS AT NOON',
  'WATCH YOUR STEP',
];
export const SIGN_ROW_COUNT = 16;
export const signRow = (text) => SIGN_ROWS.indexOf(text);
