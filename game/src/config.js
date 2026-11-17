// Velamar Heat: every tunable number and colour in one place. The other modules read their
// feel (walk and drive speeds, camera, wanted decay, district shading) from here, so the game
// can be retuned without touching the systems themselves.

export const STEP = 1 / 60;

/** Street grid: GRID cells each way, a BLOCK-square block ringed by a ROAD-wide street. */
export const CELL = 224;
export const ROAD = 56;
export const BLOCK = CELL - ROAD;
export const SIDEWALK = 14;
export const GRID = 13;
/** The grid's far edge: the last street, with the beachfront row of clubs between it and the sand. */
export const WORLD = GRID * CELL;
/** The coast road, north to south: the last street traffic uses before the sand. */
export const COAST_X = (GRID - 1) * CELL;
/** Sand from SHORE_EDGE, the water from SEA_EDGE, and open water out to SEA_END and beyond. */
export const SHORE_EDGE = WORLD - 30;
export const SEA_EDGE = WORLD + CELL - 96;
export const SEA_END = WORLD + CELL + 220;

/** How many cars and walkers the city keeps near the player, and how far off one is recycled. */
export const POPULATION = { traffic: 86, crowd: 210, recycle: 1400, crowd_recycle: 1000 };

/** One full day of tint (dawn, noon, golden hour, night) lasts this long. */
export const DAY_SECONDS = 540;
/** The clock a fresh game and the staged screenshots start at: late golden hour. */
export const START_CLOCK = 0.7;

export const CAMERA = { zoom: 1, lead: 0.38, shake_decay: 7.5, shake_max: 26 };

export const PLAYER = {
  radius: 9,
  walk: 100,
  run: 165,
  health: 100,
  regen: 2.2,
  regen_delay: 6,
  smash_radius: 30,
};

export const CAR = {
  length: 46,
  width: 22,
  max_speed: 258,
  reverse_speed: 96,
  accel: 238,
  brake: 440,
  drag: 0.6,
  steer: 2.8,
  slide: 0.32,
  toughness: 100,
  explode_at: 14,
};

export const WANTED = {
  max: 5,
  /** Seconds of no crime before a star cools off; higher levels hold a little longer. */
  decay: 11,
  /** Police cars hunting at each level, and the foot officers beside them. */
  cars: [0, 1, 1, 2, 3, 4],
  foot: [0, 0, 1, 1, 2, 3],
  /** Shots a second the chase fires, and the damage one round does to the player. */
  fire_rate: [0, 0, 0.3, 0.7, 1.1, 1.5],
  cop_damage: 7,
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 26, rate: 0.4, range: 34, spread: 0, count: 0, ammo: Infinity, unlock: 0 },
  { id: 'pistol', name: 'Pistol', damage: 21, rate: 0.28, range: 470, spread: 0.04, count: 1, speed: 640, ammo: 48, unlock: 1 },
  { id: 'smg', name: 'SMG', damage: 12, rate: 0.082, range: 430, spread: 0.1, count: 1, speed: 660, ammo: 180, unlock: 2 },
  { id: 'shotgun', name: 'Shotgun', damage: 14, rate: 0.85, range: 300, spread: 0.22, count: 7, speed: 560, ammo: 32, unlock: 3 },
];

/** Heat each crime adds, and the share of your cash the police take when they bust you. */
export const CRIME = { ped_hit: 1, ped_kill: 2, car_hit: 0.4, shot_fired: 0.6, cop_hit: 1.6, cop_kill: 3.5, bust_fee: 0.12 };

export const COLORS = {
  asphalt: '#3a3d46',
  asphalt_dark: '#33363e',
  line: '#e8e2c9',
  sidewalk: '#b9b2a4',
  sidewalk_edge: '#9d9689',
  grass: '#6f9a52',
  grass_dark: '#5c8546',
  sand: '#e6cf9a',
  sand_dark: '#d6bb82',
  sea: '#2f7fa8',
  sea_deep: '#22617f',
  foam: '#dff0f5',
  shadow: 'rgba(32,26,48,0.30)',
  skin: ['#c98d63', '#8d5a3b', '#e3b58c', '#6b4430'],
  shirt: ['#e2683f', '#3f6fe2', '#e2c13f', '#48b06a', '#c14c8a', '#efefe6', '#7d4fd1', '#37a8b5'],
  pants: ['#39445c', '#4c4338', '#2f3540', '#6b5a49'],
  car: ['#c8382f', '#2f6ec8', '#e0b93c', '#3f9d5a', '#e6e6e0', '#333a44', '#a44fc0', '#e07a2c', '#37b0a8'],
  police: '#22406e',
  police_light: '#f2f4f7',
  headlight: '#ffe9a8',
  tail: '#e2564a',
  blood: '#8e1f28',
  spark: '#ffd25e',
  fire: '#ff8a2b',
  smoke: '#6a6a72',
  marker: '#ffd23c',
  marker_alt: '#3fd0d8',
  blip_player: '#ffffff',
  blip_cop: '#4f8cff',
  blip_mission: '#ffd23c',
};

/** Districts give each part of Velamar its own height, roof palette and street furniture. */
export const DISTRICTS = {
  downtown: { height: [86, 148], roof: ['#8e97a8', '#7d8698', '#9aa3b2', '#6f7889'], trim: '#5d6575', prop: 'ac' },
  midtown: { height: [52, 78], roof: ['#cbab86', '#d8bb95', '#b99b78', '#e2c8a2'], trim: '#8f7355', prop: 'awning' },
  homes: { height: [26, 34], roof: ['#bf6b4c', '#c97a55', '#a95a44', '#cf8a63'], trim: '#8a4b39', prop: 'yard' },
  docks: { height: [40, 62], roof: ['#77808a', '#6b7a72', '#87909a', '#5f6a72'], trim: '#4e565e', prop: 'crate' },
  beach: { height: [46, 66], roof: ['#f2ece0', '#e8dcc8', '#f7f2e8', '#dfd2ba'], trim: '#a89a84', prop: 'palm' },
  strip: { height: [38, 54], roof: ['#4a4460', '#5a4b6e', '#3f3a54', '#6a5182'], trim: '#2e2a40', prop: 'neon' },
  park: { height: [0, 0], roof: ['#6f9a52'], trim: '#4f7038', prop: 'tree' },
};

/** Where the districts sit on the grid: west docks, two parks, a neon strip, the east shore. */
export const DISTRICT_CELLS = {
  park: [[3, 9], [9, 4]],
  strip: [[8, 6], [8, 7]],
  docks: [[0, 3], [0, 4], [1, 5]],
  beach: [[12, 5], [12, 6], [12, 7], [11, 9]],
};

/** Names of the streets and districts the HUD and the missions speak of. */
export const STREETS = ['Avenida del Sol', 'Calle Coral', 'Boulevard Marisol', 'Rua Palma', 'Camino Verde', 'Paseo Nuevo', 'Calle Hierro', 'Avenida Sal', 'Ronda Brisa', 'Calle Faro', 'Avenida Tinta', 'Camino Ola', 'Calle Cobre'];
