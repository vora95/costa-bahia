// Costa Bahia world: seeded city layout + the whole simulation (no drawing, no
// browser in here). step() advances one fixed step and returns event flags.
import { CARS, CHARACTERS, DISTRICTS, MISSIONS, PALETTE, PLAYER, POLICE_CAR, RADIO, WEAPONS, WORLD, districtAt } from './config.js';
import { angleLerp, clamp, createRandom, dist2, lerp } from './random.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_COMPLETE = 4;
export const EVENT_SHOT = 8;
export const EVENT_PUNCH = 16;
export const EVENT_CRASH = 32;
export const EVENT_CRIME = 64;

const STREETS_X = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const STREETS_Z = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const SHIRT_COLORS = ['#c22e5a', '#2e7f8a', '#e8b13c', '#4a6b2e', '#8a2e5a', '#e8e4da', '#2e4a6b', '#d86a1e'];
const SKIN_COLORS = ['#c98d64', '#8a5a3b', '#e0aa7e', '#b57a4e', '#e8b48a', '#6b4a2e'];

function nearestStreetCoord(v) {
  let best = STREETS_X[0]; let bd = Infinity;
  for (const s of STREETS_X) { const d = Math.abs(v - s); if (d < bd) { bd = d; best = s; } }
  return best;
}

function buildingAt(state, x, z) {
  // Circle (radius r) vs building AABB push-out; returns corrected {x, z} or null.
  for (const b of state.city.buildings) {
    const hw = b.w / 2; const hd = b.d / 2;
    if (Math.abs(x - b.x) < hw + 1.2 && Math.abs(z - b.z) < hd + 1.2) return b;
  }
  return null;
}

export function createWorld(random) {
  const city = { buildings: [], palms: [], lamps: [], billboards: [], dashes: [], crosswalks: [], lights: [], crates: [], containers: [], windowsTex: 0 };
  // --- Buildings: one or two per block, skipped on special blocks.
  const special = (bx, bz) => (bx === 3 && bz === 3) || // plaza (-30,-30)
    (bx === 6 && bz === 6) || // warehouse (150,150)
    (bx === 4 && bz === 1) || // hotel paloma (30,-150)
    (bx === 0 && bz === 7);   // harbor (-210,210)
  const texCount = 3;
  for (let bx = 0; bx < 8; bx += 1) {
    for (let bz = 0; bz < 8; bz += 1) {
      if (special(bx, bz)) continue;
      const cx = -240 + bx * 60 + 30; const cz = -240 + bz * 60 + 30;
      const n = random.chance(0.45) ? 2 : 1;
      for (let k = 0; k < n; k += 1) {
        const w = random.range(14, 22); const d = random.range(14, 22);
        const h = random.range(8, 16) + (bx >= 3 && bx <= 5 ? random.range(0, 22) : 0);
        const ox = k === 0 ? random.range(-9, -5) : random.range(5, 9);
        const oz = k === 0 ? random.range(-9, -5) : random.range(5, 9);
        city.buildings.push({
          x: cx + ox, z: cz + oz, w, d, h,
          color: random.pick(PALETTE.buildings),
          roof: random.pick(PALETTE.roofs),
          roofKind: random.pick(['flat', 'flat', 'pyramid', 'ac', 'tank']),
          tex: random.int(0, texCount - 1),
        });
      }
    }
  }
  // Warehouse (detailed, R5 fix #3): big shed + door + sign + crates + lamps.
  const warehouse = { x: 150, z: 150, w: 34, d: 24, h: 13 };
  city.buildings.push({ x: warehouse.x, z: warehouse.z, w: warehouse.w, d: warehouse.d, h: warehouse.h, color: 0x8a7a5a, roof: 0x5a4a42, roofKind: 'flat', tex: 1, warehouse: true });
  for (let i = 0; i < 6; i += 1) {
    city.crates.push({ x: 150 + random.range(-14, 14), z: 150 + 16 + random.range(-2, 4), ry: random.range(0, Math.PI), s: random.range(1.4, 2.2), yellow: i % 2 === 0 });
  }
  // Hotel Paloma: tall tower with sign.
  city.buildings.push({ x: 30, z: -150, w: 26, d: 22, h: 46, color: 0xe8a87c, roof: 0x4a5a6a, roofKind: 'ac', tex: 2, hotel: true });
  // Harbor containers.
  for (let i = 0; i < 8; i += 1) {
    city.containers.push({ x: -215 + (i % 4) * 9, z: 225 + Math.floor(i / 4) * 8, ry: (i % 2) * 0.08, color: random.pick([0xc22e2e, 0x2e7f8a, 0xe8b13c, 0x4a6b2e]) });
  }
  // --- Palms: sidewalk rows + beach row (R6: more than R5's density).
  for (let i = 0; i < 110; i += 1) {
    const along = random.chance(0.5);
    const s = random.pick(STREETS_X);
    const t = random.range(-235, 235);
    const off = random.pick([-8.5, 8.5]);
    city.palms.push({ x: along ? s + off : t, z: along ? t : s + off, s: random.range(0.8, 1.3), lean: random.range(-0.12, 0.12) });
  }
  for (let i = 0; i < 16; i += 1) city.palms.push({ x: random.range(-238, -228), z: random.range(-230, 230), s: random.range(1.0, 1.5), lean: random.range(-0.15, 0.15) });
  // --- Lamps: balanced both sides of every second intersection (R5 fix #5).
  for (const sx of STREETS_X) {
    for (const sz of STREETS_Z) {
      if ((sx + sz) % 120 !== 0) continue;
      city.lamps.push({ x: sx + 8, z: sz + 8 });
      city.lamps.push({ x: sx - 8, z: sz - 8 });
    }
  }
  // --- Billboards on building faces.
  const bb = [
    ['COSTA BAHIA', '#c22e2e', '#ffe9c9', 120, -180], ['HOTEL PALOMA', '#2e4a6b', '#ffd27a', 60, -60],
    ['TACOS EL FARO', '#d86a1e', '#fff3d6', -60, 60], ['SURF SHOP', '#2e7f8a', '#ffffff', -180, 120],
    ['NEON DRIVE 104', '#8a2e5a', '#7df9ff', 0, 180], ['PIER 9', '#4a6b2e', '#ffe9c9', -120, -120],
    ['CASINO SOL', '#b8860b', '#fff8e0', 180, -60], ['FERRY • HARBOR', '#2e7f8a', '#ffffff', -120, 240],
  ];
  for (const [text, bg, fg, x, z] of bb) city.billboards.push({ text, bg, fg, x, z });
  // --- Road dashes + crosswalks.
  for (const s of STREETS_X) {
    for (let t = -234; t <= 234; t += 12) city.dashes.push({ x: s, z: t, rotY: 0 });
  }
  for (const s of STREETS_Z) {
    for (let t = -234; t <= 234; t += 12) city.dashes.push({ x: t, z: s, rotY: Math.PI / 2 });
  }
  for (const [x, z] of [[0, 0], [60, 0], [0, 60], [-60, 0], [120, 120], [-120, -120]]) city.crosswalks.push({ x, z });
  for (const [x, z] of [[0, 0], [60, 0], [0, 60], [-60, 0], [120, 0], [0, 120]]) city.lights.push({ x: x + 9, z: z + 9 });

  // --- Entities.
  const player = {
    x: -228, z: -6, heading: Math.PI / 2, speed: 0, onFoot: true, car: null,
    health: PLAYER.health, armor: PLAYER.armor, invuln: 0, punchCd: 0, shootCd: 0,
    reload: 0, weapon: 1, // pistol
  };
  const cars = [];
  function addCar(model, x, z, heading, opts = {}) {
    const c = {
      id: cars.length, model, x, z, heading, speed: 0, hp: 100,
      isPlayer: false, isPolice: !!opts.police, isTraffic: !!opts.traffic,
      parked: !!opts.parked, disabled: false, smoke: 0,
      axis: opts.axis || 'z', lane: opts.lane ?? z, dir: opts.dir || 1,
      cruise: random.range(10, 18), brake: 0, lightPhase: random.range(0, 1),
    };
    cars.push(c); return c;
  }
  // The red Solano GT to steal (mission 2), parked on Paloma Boulevard (road edge).
  const solano = addCar(CARS[0], -33, 30, 0, { parked: true });
  solano.stealTarget = true;
  // Parked cars around town (on road edges, never inside blocks).
  addCar(CARS[1], 57, -60, Math.PI / 2, { parked: true });
  addCar(CARS[3], -123, 122, 0, { parked: true });
  addCar(CARS[4], 117, -180, Math.PI / 2, { parked: true });
  addCar(CARS[2], 180, 63, Math.PI, { parked: true });
  // Traffic: 16 cars circulating the grid (R6: busier than R5).
  for (let i = 0; i < 16; i += 1) {
    const axis = random.chance(0.5) ? 'x' : 'z';
    const street = random.pick(axis === 'x' ? STREETS_Z : STREETS_X);
    const along = random.range(-230, 230);
    const dir = random.chance(0.5) ? 1 : -1;
    const model = random.pick(CARS);
    const off = dir > 0 ? 3 : -3;
    const c = addCar(model, axis === 'x' ? along : street + off, axis === 'x' ? street + off : along, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), { traffic: true, axis, dir, lane: street + off });
    c.speed = c.cruise;
  }
  // Pedestrians: 46 walking the sidewalks (R6: more than R5's 26).
  const peds = [];
  for (let i = 0; i < 46; i += 1) {
    const street = random.pick(STREETS_X);
    const along = random.range(-230, 230);
    const side = random.pick([-8.5, 8.5]);
    peds.push({
      x: random.chance(0.5) ? street + side : along, z: random.chance(0.5) ? along : street + side,
      heading: random.range(0, Math.PI * 2), speed: random.range(1.0, 2.0),
      shirt: random.pick(SHIRT_COLORS), skin: random.pick(SKIN_COLORS),
      state: 'walk', timer: random.range(2, 8), wp: null, down: 0, bob: random.range(0, 6),
    });
  }
  // Plaza fountain peds (walk shot staging area, plaza block centred (-30,-30)).
  for (let i = 0; i < 5; i += 1) {
    peds.push({ x: -30 + random.range(-16, 16), z: -30 + random.range(-16, 16), heading: random.range(0, Math.PI * 2), speed: random.range(0.8, 1.4), shirt: random.pick(SHIRT_COLORS), skin: random.pick(SKIN_COLORS), state: 'walk', timer: random.range(2, 6), wp: null, down: 0, bob: random.range(0, 6) });
  }

  const state = {
    seed: 0, city, warehouse, player, cars, peds, solano,
    police: [], heli: { active: false, x: 0, z: 0, y: 42, heading: 0, rotor: 0, dist: 0 },
    wanted: 0, wantedTimer: 0, crimeTimer: 0, bustedTimer: 0,
    money: 540, rep: 0, repMax: 200, repLevel: 1, repTitle: 'STREET KID',
    score: 0, missionIndex: 0, missionStage: 1, missionTimer: 0, missionStartDist: 0, missionDone: false,
    dialog: null, dialogIdx: 0, dialogTimer: 0,
    toast: null, toastTimer: 0,
    radioIndex: 0, clockMin: 17 * 60 + 24, day: 'FRI',
    elapsed: 0, busted: false, complete: false, gameOver: false,
    fx: [], // tracers / flashes {kind, ... , ttl}
    stats: { stolen: 0, punched: 0, shots: 0, hits: 0, crashes: 0 },
    roadblockTimer: 0, policeSpawnTimer: 0,
    weapons: WEAPONS.map((w) => ({ ...w, magAmmo: w.mag === Infinity ? Infinity : w.mag, reserveAmmo: w.reserve })),
    passenger: null,
  };

  function showDialog(charId, lines) {
    state.dialog = { char: charId, lines, idx: 0 };
    state.dialogTimer = 4.5;
  }
  function showToast(text, secs = 3) { state.toast = text; state.toastTimer = secs; }
  function addWanted(n, reason) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
    if (state.wanted > before) {
      showToast(`WANTED ★${state.wanted} — ${reason}`, 3.5);
      return EVENT_CRIME;
    }
    return 0;
  }
  function mission() { return MISSIONS[state.missionIndex]; }
  function missionTargetDist() {
    const m = mission();
    if (!m) return 0;
    return Math.hypot(state.player.x - m.target.x, state.player.z - m.target.z);
  }
  function advanceMission() {
    const m = mission();
    if (!m) return 0;
    if (m.dialogEnd) showDialog(m.dialogEnd.char, m.dialogEnd.lines);
    state.money += 1500 + 500 * state.missionIndex;
    state.rep += 400;
    if (state.rep >= state.repMax) { state.repLevel += 1; state.rep -= state.repMax; state.repMax += 600; }
    state.repTitle = ['STREET KID', 'HUSTLER', 'RUNNER', 'BAY HUSTLER', 'BAY KING'][Math.min(state.repLevel, 5) - 1];
    state.score = state.money + state.rep * 5 + state.missionIndex * 2000;
    state.missionIndex += 1;
    state.missionStage = 1;
    state.missionTimer = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.complete = true; state.gameOver = true;
      return EVENT_MISSION | EVENT_COMPLETE;
    }
    const next = mission();
    state.missionStartDist = Math.hypot(state.player.x - next.target.x, state.player.z - next.target.z);
    if (next.dialogStart) showDialog(next.dialogStart.char, next.dialogStart.lines);
    return EVENT_MISSION;
  }
  function startMission(i) {
    state.missionIndex = i;
    const m = mission();
    state.missionStartDist = Math.hypot(state.player.x - m.target.x, state.player.z - m.target.z);
    if (m.dialogStart) showDialog(m.dialogStart.char, m.dialogStart.lines);
  }

  function reset() {
    state.player.x = -228; state.player.z = -6; state.player.heading = Math.PI / 2;
    state.player.speed = 0; state.player.onFoot = true; state.player.car = null;
    state.player.health = PLAYER.health; state.player.armor = PLAYER.armor;
    state.player.weapon = 1; state.player.reload = 0; state.player.shootCd = 0; state.player.punchCd = 0;
    for (const c of cars) { c.isPlayer = false; c.disabled = false; c.hp = 100; c.smoke = 0; if (c.parked) c.speed = 0; }
    for (const p of peds) p.down = 0;
    state.police = []; state.heli.active = false;
    state.wanted = 0; state.wantedTimer = 0; state.crimeTimer = 0; state.bustedTimer = 0;
    state.money = 540; state.rep = 0; state.repLevel = 1; state.repMax = 200;
    state.missionIndex = 0; state.missionStage = 1; state.elapsed = 0; state.clockMin = 17 * 60 + 24;
    state.busted = false; state.complete = false; state.gameOver = false;
    state.dialog = null; state.toast = null; state.passenger = null; state.fx = [];
    state.weapons = WEAPONS.map((w) => ({ ...w, magAmmo: w.mag === Infinity ? Infinity : w.mag, reserveAmmo: w.reserve }));
    startMission(0);
  }

  function collideBuildings(e, r) {
    const b = buildingAt(state, e.x, e.z);
    if (!b) return;
    const hw = b.w / 2 + r; const hd = b.d / 2 + r;
    const dx = e.x - b.x; const dz = e.z - b.z;
    const px = hw - Math.abs(dx); const pz = hd - Math.abs(dz);
    if (px < pz) e.x = b.x + Math.sign(dx || 1) * hw;
    else e.z = b.z + Math.sign(dz || 1) * hd;
  }

  function stepTraffic(dt) {
    for (const c of cars) {
      if (!c.isTraffic || c.disabled) continue;
      // Car ahead in the same lane?
      let blocked = false;
      for (const o of cars) {
        if (o === c || o.disabled) continue;
        if (o.axis !== c.axis || Math.abs(o.lane - c.lane) > 2) continue;
        const along = c.axis === 'x' ? c.x : c.z;
        const oAlong = c.axis === 'x' ? o.x : o.z;
        const gap = (oAlong - along) * c.dir;
        if (gap > 0 && gap < 11) { blocked = true; break; }
      }
      const target = blocked ? 0 : c.cruise;
      c.speed = lerp(c.speed, target, Math.min(1, dt * 2));
      const move = c.speed * c.dir * dt;
      if (c.axis === 'x') c.x += move; else c.z += move;
      // Turn at intersections sometimes; wrap at edges.
      const along = c.axis === 'x' ? c.x : c.z;
      const nearStreet = Math.abs(along - nearestStreetCoord(along)) < 1.2;
      if (nearStreet && random.chance(dt * 0.5)) {
        const ns = nearestStreetCoord(along);
        c.dir = random.chance(0.5) ? 1 : -1;
        const off = c.dir > 0 ? 3 : -3;
        if (c.axis === 'x') { c.axis = 'z'; c.x = ns + off; c.lane = c.x; c.heading = c.dir > 0 ? 0 : Math.PI; }
        else { c.axis = 'x'; c.z = ns + off; c.lane = c.z; c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      }
      if (c.x > 296 || c.x < -236 || c.z > 296 || c.z < -236) {
        // Wrap to the opposite edge on a random street.
        const s = random.pick(STREETS_X);
        if (c.axis === 'x') { c.x = c.dir > 0 ? -235 : 235; c.z = s + 3; }
        else { c.z = c.dir > 0 ? -235 : 235; c.x = s + 3; }
        c.lane = c.axis === 'x' ? c.z : c.x;
      }
      collideBuildings(c, 2.2);
    }
  }

  function stepPeds(dt) {
    for (const p of peds) {
      if (p.down > 0) { p.down -= dt; continue; }
      p.timer -= dt;
      const nearChase = state.wanted >= 2 && dist2(p.x, p.z, state.player.x, state.player.z) < 400;
      if (p.state === 'run' || nearChase) {
        p.state = 'run';
        const dx = p.x - state.player.x; const dz = p.z - state.player.z;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
        p.x += Math.sin(p.heading) * 4.5 * dt;
        p.z += Math.cos(p.heading) * 4.5 * dt;
        if (p.timer <= 0) { p.state = 'walk'; p.timer = random.range(3, 8); }
      } else {
        if (p.timer <= 0 || !p.wp) {
          const street = random.pick(STREETS_X);
          const side = random.pick([-8.5, 8.5]);
          p.wp = random.chance(0.5) ? { x: street + side, z: random.range(-230, 230) } : { x: random.range(-230, 230), z: street + side };
          p.timer = random.range(4, 10);
        }
        const dx = p.wp.x - p.x; const dz = p.wp.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) { p.timer = 0; continue; }
        p.heading = Math.atan2(dx / d, dz / d);
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
      }
      p.x = clamp(p.x, -238, 298); p.z = clamp(p.z, -238, 298);
      p.bob += dt * (p.state === 'run' ? 14 : 8);
      collideBuildings(p, 0.8);
    }
  }

  function spawnPolice() {
    const want = state.wanted >= 1 ? Math.min(2 + Math.floor(state.wanted / 2), 6) : 0;
    while (state.police.length < want) {
      const ang = random.range(0, Math.PI * 2);
      const d = random.range(70, 95);
      const x = clamp(state.player.x + Math.sin(ang) * d, -230, 290);
      const z = clamp(state.player.z + Math.cos(ang) * d, -230, 290);
      const c = addCar(POLICE_CAR, nearestStreetCoord(x), nearestStreetCoord(z), random.range(0, Math.PI * 2), { police: true });
      c.speed = 20;
      state.police.push(c);
    }
    state.police = state.police.filter((c) => !c.disabled);
  }

  function stepPolice(dt) {
    spawnPolice();
    const px = state.player.x; const pz = state.player.z;
    let nearest = Infinity;
    for (const c of state.police) {
      if (c.disabled) continue;
      const dx = px - c.x; const dz = pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < nearest) nearest = d;
      const wantHeading = Math.atan2(dx, dz);
      c.heading = angleLerp(c.heading, wantHeading, Math.min(1, dt * 2.2));
      const targetSpeed = d > 60 ? POLICE_CAR.top : Math.min(POLICE_CAR.top, 30 + d * 0.35);
      c.speed = lerp(c.speed, targetSpeed, Math.min(1, dt * 1.5));
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.lightPhase += dt * 6;
      // Ram the player.
      if (d < 4.6) {
        const p = state.player;
        if (p.onFoot) {
          state.bustedTimer += dt;
          if (state.bustedTimer > 1.6 && !state.busted) {
            state.busted = true; state.gameOver = true;
            return EVENT_BUSTED;
          }
        } else if (p.car) {
          p.car.hp = Math.max(0, p.car.hp - 26 * dt);
          if (p.car.hp <= 0) { p.car.disabled = true; p.car.smoke = 1; }
          // Shove the player car sideways.
          p.car.x += Math.sin(c.heading) * 6 * dt;
          p.car.z += Math.cos(c.heading) * 6 * dt;
        }
      }
      collideBuildings(c, 2.2);
    }
    if (nearest > 6) state.bustedTimer = 0;
    return 0;
  }

  function stepHeli(dt) {
    const h = state.heli;
    if (state.wanted >= 3) {
      const p = state.player;
      // Hover ahead-right of the player and LEAD it (a lerp-only follow lags
      // ~50 m behind a 46 m/s car, which put the heli behind the camera).
      const fx = Math.sin(p.heading); const fz = Math.cos(p.heading);
      const rx = -fz; const rz = fx;
      const lead = (p.speed || 0) * 0.5;
      const tx = p.x + fx * (26 + lead) + rx * 14;
      const tz = p.z + fz * (26 + lead) + rz * 14;
      if (!h.active) { h.active = true; h.x = tx; h.z = tz; showToast('★ AIR UNIT AIR-2 OVERHEAD', 3); }
      h.x = lerp(h.x, tx, Math.min(1, dt * 3));
      h.z = lerp(h.z, tz, Math.min(1, dt * 3));
      h.y = 18 + Math.sin(state.elapsed * 1.3) * 1.5;
      h.heading = Math.atan2(p.x - h.x, p.z - h.z);
      h.rotor += dt * 22;
      h.dist = Math.hypot(h.x - p.x, h.z - p.z);
    } else if (h.active) {
      h.active = false;
    }
  }

  function stepPlayer(dt, ax, actions) {
    const p = state.player;
    let events = 0;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) {
        const w = state.weapons[p.weapon];
        const need = w.mag - w.magAmmo;
        const take = Math.min(need, w.reserveAmmo);
        w.magAmmo += take; w.reserveAmmo -= take;
      }
    }
    // Enter / exit car.
    if (actions & 4) { // ACTION_ENTER
      if (p.onFoot) {
        let best = null; let bd = 16;
        for (const c of cars) {
          if (c.isPolice || c.disabled || c.isPlayer) continue;
          const d = dist2(p.x, p.z, c.x, c.z);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) {
          p.onFoot = false; p.car = best; best.isPlayer = true; best.parked = false; best.isTraffic = false;
          best.speed = 0;
          if (best.stealTarget) {
            state.stats.stolen += 1;
            events |= addWanted(1, 'VEHICLE STOLEN: SOLANO GT');
            showToast('VEHICLE STOLEN: SOLANO GT', 3.5);
          }
        }
      } else if (p.car) {
        const c = p.car;
        p.onFoot = true;
        p.x = c.x + Math.sin(c.heading + Math.PI / 2) * 3;
        p.z = c.z + Math.cos(c.heading + Math.PI / 2) * 3;
        p.heading = c.heading;
        c.isPlayer = false; c.speed = 0; p.car = null; p.speed = 0;
      }
    }
    if (p.onFoot) {
      const sp = ax.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const fx = Math.sin(p.heading); const fz = Math.cos(p.heading);
      const rx = Math.sin(p.heading + Math.PI / 2); const rz = Math.cos(p.heading + Math.PI / 2);
      p.x += (fx * ax.f + rx * ax.s) * sp * dt;
      p.z += (fz * ax.f + rz * ax.s) * sp * dt;
      // The HUD speedometer reads p.speed: set it while walking (it was
      // never assigned on foot, so the HUD stuck at 0).
      p.speed = sp * Math.max(Math.abs(ax.f), Math.abs(ax.s));
      if (ax.s !== 0) p.heading += ax.s * 1.9 * dt;
      p.x = clamp(p.x, -258, 298); p.z = clamp(p.z, -258, 298);
      collideBuildings(p, 0.8);
      // Punch.
      if ((actions & 8) && p.punchCd <= 0) {
        p.punchCd = 0.45;
        events |= EVENT_PUNCH;
        for (const ped of peds) {
          if (ped.down > 0) continue;
          const d = dist2(p.x, p.z, ped.x, ped.z);
          if (d < 6.5) {
            ped.down = 3; state.stats.punched += 1;
            events |= addWanted(1, 'ASSAULT');
            break;
          }
        }
      }
      // Shoot on foot (edge press, or held for automatic weapons).
      const wantShootFoot = (actions & 16) || (ax.shootHeld && state.weapons[p.weapon].auto);
      if (wantShootFoot) events |= tryShoot(dt);
    } else if (p.car) {
      const c = p.car;
      const model = c.model;
      if (c.disabled) {
        // Wrecked: stumble out on foot.
        p.onFoot = true;
        p.x = c.x + Math.sin(c.heading + Math.PI / 2) * 3;
        p.z = c.z + Math.cos(c.heading + Math.PI / 2) * 3;
        p.heading = c.heading;
        c.isPlayer = false; c.speed = 0; p.car = null; p.speed = 0;
        showToast('CAR WRECKED', 3);
        return events;
      }
      if (ax.f > 0) c.speed += model.accel * dt;
      else if (ax.f < 0) c.speed -= (c.speed > 0.5 ? 30 : 12) * dt;
      else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 8 * dt);
      if (ax.handbrake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 34 * dt);
      c.speed = clamp(c.speed, -12, model.top);
      const steer = ax.s * (c.speed >= 0 ? 1 : -1);
      c.heading += steer * clamp(Math.abs(c.speed) / 14, 0, 1) * 1.9 * dt * (ax.handbrake ? 1.5 : 1);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.x = clamp(c.x, -258, 298); c.z = clamp(c.z, -258, 298);
      const hit = buildingAt(state, c.x, c.z);
      if (hit) {
        if (Math.abs(c.speed) > 12) {
          events |= EVENT_CRASH;
          c.hp = Math.max(0, c.hp - 12);
          state.stats.crashes += 1;
          if (c.hp <= 0) { c.disabled = true; c.smoke = 1; }
        }
        collideBuildings(c, 2.2);
        c.speed *= 0.35;
      }
      p.x = c.x; p.z = c.z; p.heading = c.heading; p.speed = c.speed;
      // Run over pedestrians.
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (dist2(c.x, c.z, ped.x, ped.z) < 5.5 && Math.abs(c.speed) > 6) {
          ped.down = 4; events |= addWanted(2, 'PEDESTRIAN DOWN');
        }
      }
      if ((actions & 16) || (ax.shootHeld && state.weapons[p.weapon].auto)) events |= tryShoot(dt);
    }
    return events;
  }

  function tryShoot(dt) {
    const p = state.player;
    const w = state.weapons[p.weapon];
    if (w.id === 'fists') return 0;
    if (p.shootCd > 0 || p.reload > 0) return 0;
    if (w.magAmmo <= 0) { p.reload = 1.0; return 0; }
    p.shootCd = w.rate;
    w.magAmmo -= 1;
    state.stats.shots += 1;
    const ox = p.x; const oz = p.z;
    const dirX = Math.sin(p.heading); const dirZ = Math.cos(p.heading);
    let best = null; let bd = 40 * 40; let bestKind = null;
    for (const c of state.police) {
      if (c.disabled) continue;
      const d = dist2(ox, oz, c.x, c.z);
      if (d > bd) continue;
      const tx = (c.x - ox) / Math.sqrt(d); const tz = (c.z - oz) / Math.sqrt(d);
      if (tx * dirX + tz * dirZ > 0.93) { bd = d; best = c; bestKind = 'car'; }
    }
    if (!best) {
      for (const ped of peds) {
        if (ped.down > 0) continue;
        const d = dist2(ox, oz, ped.x, ped.z);
        if (d > bd) continue;
        const tx = (ped.x - ox) / Math.sqrt(d); const tz = (ped.z - oz) / Math.sqrt(d);
        if (tx * dirX + tz * dirZ > 0.93) { bd = d; best = ped; bestKind = 'ped'; }
      }
    }
    const range = best ? Math.sqrt(bd) : 40;
    state.fx.push({ kind: 'tracer', x1: ox, z1: oz, x2: ox + dirX * range, z2: oz + dirZ * range, ttl: 0.09, y: p.onFoot ? 1.4 : 1.2 });
    if (best) {
      state.stats.hits += 1;
      if (bestKind === 'car') { best.hp -= w.damage; if (best.hp <= 0) { best.disabled = true; best.smoke = 1; } }
      else { best.down = 4; return EVENT_SHOT | addWanted(1, 'SHOTS FIRED'); }
      return EVENT_SHOT;
    }
    return EVENT_SHOT;
  }

  function stepMissions(dt) {
    let events = 0;
    const m = mission();
    if (!m || state.complete) return 0;
    const d = missionTargetDist();
    if (m.id === 'pier') {
      if (d < 8) events |= advanceMission();
      state.missionStage = clamp(1 + Math.floor((1 - d / Math.max(1, state.missionStartDist)) * m.stages), 1, m.stages);
    } else if (m.id === 'steal') {
      if (state.player.car === state.solano) events |= advanceMission();
      state.missionStage = state.player.car === state.solano ? m.stages : 1;
    } else if (m.id === 'lose') {
      state.missionStage = clamp(m.stages - state.wanted, 1, m.stages);
      if (state.wanted === 0) events |= advanceMission();
    } else if (m.id === 'warehouse') {
      if (d < 10) events |= advanceMission();
      state.missionStage = clamp(1 + Math.floor((1 - d / Math.max(1, state.missionStartDist)) * m.stages), 1, m.stages);
    } else if (m.id === 'pickup') {
      if (d < 8) { state.passenger = 'lucia'; events |= advanceMission(); }
      state.missionStage = clamp(1 + Math.floor((1 - d / Math.max(1, state.missionStartDist)) * m.stages), 1, m.stages);
    } else if (m.id === 'escape') {
      state.missionTimer += dt;
      if (d < 12) events |= advanceMission();
      else if (state.missionTimer > m.timer) { state.busted = true; state.gameOver = true; events |= EVENT_BUSTED; }
      state.missionStage = clamp(1 + Math.floor((1 - d / Math.max(1, state.missionStartDist)) * m.stages), 1, m.stages);
    }
    return events;
  }

  function step(dt, ax, actions) {
    let events = 0;
    state.elapsed += dt;
    state.clockMin = 17 * 60 + 24 + Math.floor(state.elapsed / 10);
    state.crimeTimer += dt;
    if (state.crimeTimer > 25 && state.wanted > 0) {
      let near = false;
      for (const c of state.police) if (dist2(c.x, c.z, state.player.x, state.player.z) < 2500) { near = true; break; }
      if (!near) { state.wanted -= 1; state.crimeTimer = 0; showToast(state.wanted === 0 ? 'CLEAN — HEAT OFF' : `WANTED ★${state.wanted}`, 2.5); }
    }
    if (state.dialog) {
      state.dialogTimer -= dt;
      if (state.dialogTimer <= 0) {
        state.dialog.idx += 1;
        if (state.dialog.idx >= state.dialog.lines.length) state.dialog = null;
        else state.dialogTimer = 4.5;
      }
    }
    if (state.toast) { state.toastTimer -= dt; if (state.toastTimer <= 0) state.toast = null; }
    state.fx = state.fx.filter((f) => (f.ttl -= dt) > 0);
    state.roadblockTimer -= dt;
    if (state.wanted >= 4 && state.roadblockTimer <= 0) {
      state.roadblockTimer = 22;
      const hx = Math.sin(state.player.heading); const hz = Math.cos(state.player.heading);
      for (let i = -1; i <= 1; i += 2) {
        const c = addCar(POLICE_CAR, state.player.x + hx * 42 + Math.cos(state.player.heading) * i * 5, state.player.z + hz * 42 - Math.sin(state.player.heading) * i * 5, state.player.heading + Math.PI / 2, { police: true });
        c.speed = 0; state.police.push(c);
      }
      showToast('★ ROADBLOCK AHEAD', 3);
    }
    events |= stepPlayer(dt, ax, actions);
    if (events & EVENT_BUSTED) return events;
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    stepHeli(dt);
    events |= stepMissions(dt);
    return events;
  }

  reset();
  return {
    state, reset, step, startMission, showDialog, showToast, addWanted,
    mission, missionTargetDist, districtAt: (x, z) => districtAt(x, z),
  };
}
