// Port Aurora — tuning constants and the art palette.
// One job: every number and colour the rest of the game shares, so a tweak
// here retunes the whole city without touching game logic.
export const WORLD = 7000; // world is WORLD x WORLD pixels
export const ROAD_SPACING = 560;
export const ROAD_WIDTH = 104;
export const ROAD_CENTERS = [];
for (let i = 0; i < 12; i++) ROAD_CENTERS.push(280 + i * ROAD_SPACING);
export const WATER_X = 6500; // east of this is the harbour water
export const BEACH_X = 6360; // sand band between the last road and the water

// Player on foot.
export const WALK_SPEED = 230;
export const RUN_SPEED = 345;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

// Cars.
export const CAR_LENGTH = 46;
export const CAR_WIDTH = 22;
export const CAR_MAX_SPEED = 640;
export const CAR_ACCEL = 460;
export const CAR_REVERSE_MAX = 240;
export const CAR_BRAKE = 900;
export const CAR_TURN = 2.5; // radians per second at full lock, scaled by speed
export const TRAFFIC_COUNT = 26;
export const PARKED_COUNT = 30;
export const PED_COUNT = 64;

// Wanted level.
export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 12; // one star fades after this long unseen
export const BUST_SECONDS = 1.2; // police contact time that busts the player

// Combat.
export const PISTOL_DAMAGE = 34;
export const PISTOL_RATE = 0.22; // seconds between shots
export const PISTOL_RANGE = 430;
export const BULLET_SPEED = 950;
export const COP_DAMAGE = 8;

// Missions.
export const START_CASH = 120;

// Sun-soaked coastal palette.
export const PALETTE = {
  grass: '#86a860',
  grassDark: '#7a9c55',
  sand: '#e6d199',
  water: '#2e7cb0',
  waterDeep: '#256a99',
  road: '#3b4048',
  roadLine: '#e8c33c',
  sidewalk: '#b7b0a0',
  crosswalk: '#e8e6df',
  park: '#5d9b4e',
  parkDark: '#4f8a42',
  plaza: '#c9c2b0',
  buildingRoof: ['#8fa8bf', '#d9a05b', '#c97b5e', '#e0b56a', '#7fb0a0', '#a08bb5', '#b5a58e', '#6f8f7a'],
  buildingSide: '#00000033',
  windowLit: '#ffe9a8',
  windowDark: '#2c3440',
  tree: '#3f7d33',
  treeDark: '#356b2b',
  carColors: ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#1abc9c', '#d35400', '#7f8c8d'],
  policeWhite: '#f2f4f6',
  policeBlack: '#1c2733',
  playerRing: '#ffd94a',
  missionGold: '#ffc93c',
  hudBg: 'rgba(12, 16, 24, 0.62)',
  hudText: '#f4f1e6',
  hudMuted: '#c9c4b2',
  starOn: '#ffd94a',
  starOff: 'rgba(255,255,255,0.28)',
  healthGood: '#58c96b',
  healthLow: '#e5484d',
};

// District names, used by the HUD and mission text.
export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 2240, y1: 7000 },
  { name: 'Downtown', x0: 2240, y0: 0, x1: 4480, y1: 3920 },
  { name: 'The Marina', x0: 4480, y0: 0, x1: 6360, y1: 2240 },
  { name: 'The Harbor', x0: 4480, y0: 2240, x1: 6360, y1: 7000 },
  { name: 'The Suburbs', x0: 2240, y0: 3920, x1: 4480, y1: 7000 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Port Aurora';
}
