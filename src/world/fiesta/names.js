// Invented shop names for the mall. None of these is (knowingly) a real chain or brand; they are
// period-plausible for a southwestern mall that opened in 1979 and limped on until 2018.
// Shared by the texture worker (draws the sign atlas and the directory) and the layout.
// Append only: a name's index is its row in the sign atlas.

export const STORE_NAMES = [
  'SUNDIAL SHOES',
  'HALCYON CARDS & GIFTS',
  'PALO VERDE OPTICAL',
  'THE GOLDEN TEAPOT',
  'ARROYO JEWELERS',
  'BIGHORN BOOTS',
  'CACTUS CAMERA',
  'STARDUST RECORDS & TAPES',
  'TWIN PINES TOYS',
  'LA PALOMA BRIDAL',
  'PETITE MADELEINE',
  'SOUTHWEST LINENS',
  'QUARTZ TIME WATCH REPAIR',
  'EVERLIT CANDLES',
  'DUNE SPORTS',
  'PRISM GLASS ART',
  'SUNSET TANNING',
  'VALLEY VISION CENTER',
  'HOURGLASS PORTRAITS',
  'PAPER MOON STATIONERY',
  'QUARTER MOON ARCADE',
  'TERRA COTTA HOME',
  'LUCKY STAR NAILS',
  'BLUE AGAVE IMPORTS',
  'WESTWIND KITES',
  'NORTHSTAR NUTRITION',
  'JEANS JUNCTION',
  'THE READING ROOM',
  'PICTURE PERFECT FRAMES',
  'TINY TOES CHILDRENSWEAR',
  'SILVER SPUR WESTERN WEAR',
  'MERIDIAN TRAVEL',
  'AURORA FRAGRANCE',
  'FLASH FOTO 1-HOUR',
  'SUNBELT MUSIC',
  'CANYON CUTLERY',
  'GEMINI HAIR DESIGN',
  'TIMELESS TREASURES',
  'PAINTED DESERT POTTERY',
  'MESA MODE',
  'COPPER KETTLE KITCHEN',
  'RIDGELINE OUTFITTERS',
  'SAND & SAGE',
  'THE KNIT WIT',
  'NOVA ELECTRONICS',
  'LITTLE ADOBE PETS',
  'SIERRA SUNGLASS',
  'CUSTOMER SERVICE',
];

export const FOOD_NAMES = [
  'GREEN CHILE GRILL',
  'PIZZA PALOMA',
  'CORRAL DOGS',
  'SUNRISE YOGURT',
  'GOLDEN DRAGON WOK',
  'BAKED POTATO BARN',
  'CINNAMON WAGON',
  'SALAD MESA',
  'TACO LUNA',
  'SODA FOUNTAIN',
  'COOKIE CACTUS',
  'GYRO GALAXY',
];

/** Every row of the shop sign atlas: stores, then food stalls. */
export const SHOP_SIGNS = [...STORE_NAMES, ...FOOD_NAMES];
export const SHOP_SIGN_COLS = 2;
export const SHOP_SIGN_ROWS = 32;
export const shopSignIndex = (name) => SHOP_SIGNS.indexOf(name);
