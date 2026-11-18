// Costa Bahia — every tuning number, colour and piece of content in one place.
// The city is a 60-unit street grid on land x in [-240, 300], z in [-240, 300];
// the beach and sea lie west of x = -240. All gameplay runs on this grid.
export const STEP = 1 / 60;

export const WORLD = {
  minX: -240, maxX: 300, minZ: -240, maxZ: 300,
  streetEvery: 60, roadWidth: 12, sidewalk: 3,
  seaX: -260, beachX: -240, // sand strip beachX..seaX is beach; west of seaX is water
  pierZ: 0, pierX0: -240, pierX1: -320,
};

export const PALETTE = {
  asphalt: 0x23262e, asphaltCss: '#23262e',
  sidewalk: 0x6b6f7a, sidewalkCss: '#6b6f7a',
  ground: 0x3a3f4a,
  sand: 0xd9b380, sandCss: '#d9b380',
  sea: 0x14606e, seaCss: '#14606e',
  seaDeep: 0x0e4550,
  dash: 0xd8c25a,
  // Coastal building palette: warm pastels that read "sunset beach town".
  buildings: [0xe8a87c, 0x7fb5a8, 0xf2d492, 0xc96f5a, 0x8fa8c8, 0xe6c9a8, 0x9db98a, 0xd98c7a, 0x6fa8a0, 0xe8b4b8],
  roofs: [0x5a4a42, 0x7a6a5a, 0x4a5a6a, 0x8a5a4a, 0x3a3a3a],
  windowLit: 0xffd27a, windowDark: 0x2a3550,
  palmTrunk: 0x8a6a4a, palmLeaf: 0x3f7a3a, palmLeaf2: 0x57a047,
  sun: 0xffd27a, sunGlow: 0xff9a4a,
  skyTop: 0x2c2a55, skyMid: 0xb5658f, skyHorizon: 0xff8c42,
  fog: 0xe8835a,
  policeWhite: 0xf2f2f2, policeBlack: 0x1a1a22,
  taxiYellow: 0xf2c531,
};

export const DISTRICTS = [
  { name: 'CORAL SHORE', sub: 'Paloma Boulevard', x0: -240, x1: -120, z0: -240, z1: 300 },
  { name: 'OLD HARBOR', sub: 'Pier 9', x0: -240, x1: -60, z0: 180, z1: 300 },
  { name: 'PALOMA BOULEVARD', sub: 'Downtown', x0: -120, x1: 120, z0: -240, z1: 300 },
  { name: 'MARINA HEIGHTS', sub: 'Coral Strip', x0: 120, x1: 300, z0: -240, z1: 60 },
  { name: 'WAREHOUSE ROW', sub: 'Dockside', x0: 120, x1: 300, z0: 60, z1: 300 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[2];
}

// Five original car models. top = top speed (m/s), accel, len/wid/h in metres.
export const CARS = [
  { id: 'solano', name: 'SOLANO GT', color: 0xc22e2e, top: 52, accel: 26, len: 4.6, wid: 2.0, h: 1.05, sport: true },
  { id: 'coral', name: 'CORAL SEDAN', color: 0x2e7f8a, top: 38, accel: 18, len: 4.4, wid: 1.9, h: 1.35 },
  { id: 'taxi', name: 'MARLIN TAXI', color: 0xf2c531, top: 40, accel: 19, len: 4.4, wid: 1.9, h: 1.4, taxi: true },
  { id: 'pickup', name: 'BODEGA PICKUP', color: 0xd86a1e, top: 42, accel: 20, len: 5.0, wid: 2.0, h: 1.5, pickup: true },
  { id: 'van', name: 'PIER VAN', color: 0xe8e4da, top: 34, accel: 15, len: 5.2, wid: 2.1, h: 2.1, van: true },
];

export const POLICE_CAR = { name: 'CBPD INTERCEPTOR', color: 0x1a1a22, top: 55, accel: 30, len: 4.6, wid: 2.0, h: 1.3 };

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', mag: Infinity, reserve: Infinity, damage: 34, rate: 0.45, auto: false },
  { id: 'pistol', name: 'PISTOL 9MM', mag: 12, reserve: 72, damage: 26, rate: 0.28, auto: false },
  { id: 'smg', name: 'SQUALL SMG', mag: 24, reserve: 120, damage: 15, rate: 0.09, auto: true },
  { id: 'shotgun', name: 'BREAKER 12', mag: 6, reserve: 24, damage: 62, rate: 0.8, auto: false },
];

export const CHARACTERS = [
  { id: 'carmen', name: 'Carmen', role: 'Pier contact', skin: '#c98d64', hair: '#1c1410', hairStyle: 'long', shirt: '#c22e5a', accent: 'gold hoops' },
  { id: 'rico', name: 'Rico', role: 'Boss on the radio', skin: '#8a5a3b', hair: '#0e0c0a', hairStyle: 'buzz', shirt: '#2e4a6b', accent: 'scar' },
  { id: 'lucia', name: 'Lucía', role: 'Getaway driver', skin: '#e0aa7e', hair: '#3a1e10', hairStyle: 'bun', shirt: '#2e7f8a', accent: 'sunglasses' },
  { id: 'luz', name: 'Mama Luz', role: 'Warehouse keeper', skin: '#b57a4e', hair: '#e8e8e8', hairStyle: 'bunGrey', shirt: '#6b4a8a', accent: 'apron' },
  { id: 'teo', name: 'Teo', role: 'Mechanic', skin: '#d9a06a', hair: '#241a12', hairStyle: 'cap', shirt: '#4a6b2e', accent: 'cap' },
  { id: 'dana', name: 'Dana', role: 'Harbor runner', skin: '#e8b48a', hair: '#d8a020', hairStyle: 'bob', shirt: '#8a2e5a', accent: 'headset' },
];

export const RADIO = [
  { name: 'WAVE 104', genre: 'Sunset Synth' },
  { name: 'CORAL FM 96.4', genre: 'Beach Pop' },
  { name: 'NEON DRIVE', genre: 'Night Drive' },
  { name: 'BRISA 88', genre: 'Bossa' },
];

// Six chained story missions. target = world coords; stages = progress bar steps.
export const MISSIONS = [
  {
    id: 'pier', title: 'PIER MEETING', objective: 'Meet Carmen at Pier 9', target: { x: -228, z: 0 },
    stages: 3, dialogStart: { char: 'rico', lines: [
      ['Rico', 'Costa Bahia is yours tonight, kid. First stop: Carmen at the pier. She has the keys.'],
      ['You', 'On my way. Keep the radio on.'],
    ] },
    dialogEnd: { char: 'carmen', lines: [
      ['Carmen', 'There you are. The Solano GT is parked on Paloma — red, loud, and very much not yours.'],
      ['Carmen', 'Take it. Just don\u2019t make me regret it.'],
    ] },
  },
  {
    id: 'steal', title: 'STEAL THE SOLANO', objective: 'Steal the red Solano GT', target: { x: -33, z: 30 },
    stages: 3, dialogStart: { char: 'carmen', lines: [
      ['Carmen', 'Walk up to the Solano and press E. The alarm will scream. That\u2019s normal.'],
    ] },
    dialogEnd: { char: 'rico', lines: [
      ['Rico', 'Alarm\u2019s up, cops are coming. Drive like you mean it.'],
    ] },
  },
  {
    id: 'lose', title: 'LOSE THE HEAT', objective: 'Drop your wanted level to zero', target: { x: 60, z: -150 },
    stages: 4, dialogStart: { char: 'lucia', lines: [
      ['Lucía', 'Lose them first. Break line of sight, swap streets, don\u2019t stop under a spotlight.'],
    ] },
    dialogEnd: { char: 'lucia', lines: [
      ['Lucía', 'Clean. You drive better than you look.'],
    ] },
  },
  {
    id: 'warehouse', title: 'WAREHOUSE RUN', objective: 'Deliver the package to Warehouse 4', target: { x: 150, z: 150 },
    stages: 4, dialogStart: { char: 'luz', lines: [
      ['Mama Luz', 'Bring the crate to Warehouse 4, Dockside. The gate is open, the guards are mine.'],
      ['Mama Luz', 'And drive careful — that package is worth more than your car.'],
    ] },
    dialogEnd: { char: 'luz', lines: [
      ['Mama Luz', 'Delivered. You\u2019re alright, kid. Rico owes me a favor now.'],
    ] },
  },
  {
    id: 'pickup', title: 'PICK UP LUCÍA', objective: 'Pick up Lucía at Hotel Paloma', target: { x: 30, z: -150 },
    stages: 4, dialogStart: { char: 'lucia', lines: [
      ['Lucía', 'Hotel Paloma, north side. I\u2019m done waiting — the harbor job starts at dusk.'],
    ] },
    dialogEnd: { char: 'lucia', lines: [
      ['Lucía', 'Finally. Drive, and don\u2019t scratch the paint. I like this one.'],
    ] },
  },
  {
    id: 'escape', title: 'LAST BRIDGE', objective: 'Escape to the Old Harbor docks', target: { x: -210, z: 210 },
    stages: 4, timer: 90, dialogStart: { char: 'dana', lines: [
      ['Dana', 'Harbor gate closes in ninety seconds. The whole CBPD is on you — make it count.'],
    ] },
    dialogEnd: { char: 'rico', lines: [
      ['Rico', 'You made it. Costa Bahia is yours, kid. Same time tomorrow?'],
    ] },
  },
];

export const PLAYER = { walkSpeed: 6, runSpeed: 10, health: 100, armor: 50 };
export const SAVE_KEY = 'costa-bahia.save.v1';
export const BEST_KEY = 'costa-bahia.best.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
