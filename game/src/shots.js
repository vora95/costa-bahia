// Screenshot scenes behind ?shot=cover|drive|mission|walk. Each one resets the world
// from the same seed, stages a real gameplay moment (a short driven sim, not a
// diorama), paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

const IDLE = { f: 0, s: 0, run: false, handbrake: false, shootHeld: false };
const DRIVE = { f: 1, s: 0, run: false, handbrake: false, shootHeld: false };

function runSteps(world, n, ax) {
  for (let i = 0; i < n; i += 1) world.step(STEP, ax, 0);
}

function putPlayerInSolano(world, x, z, heading, speed) {
  const s = world.state;
  const c = s.solano;
  c.x = x; c.z = z; c.heading = heading; c.speed = speed;
  c.parked = false; c.isTraffic = false; c.isPlayer = true; c.hp = 100; c.disabled = false;
  s.player.onFoot = false; s.player.car = c;
  s.player.x = x; s.player.z = z; s.player.heading = heading; s.player.speed = speed;
}

function nearestPolice(world) {
  const s = world.state;
  let best = null; let bd = Infinity;
  for (const c of s.police) {
    if (c.disabled) continue;
    const d = (c.x - s.player.x) ** 2 + (c.z - s.player.z) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function stageShot(name, world) {
  const s = world.state;
  world.reset();
  if (name === 'drive') {
    world.startMission(1);
    s.money = 3240; s.rep = 300; s.repLevel = 2; s.repMax = 800; s.repTitle = 'HUSTLER';
    s.player.health = 94; s.player.armor = 40;
    putPlayerInSolano(world, -240, -120, 0, 33);
    s.wanted = 2; s.crimeTimer = 0;
    s.dialog = null;
    runSteps(world, 120, DRIVE);
    // One unit alongside the bumper (3 m back, 4.5 m to the side): a cop placed
    // straight behind sits behind the chase camera and never appears.
    const cop = nearestPolice(world);
    if (cop) {
      cop.x = s.player.x - Math.sin(s.player.heading) * 3 + Math.cos(s.player.heading) * -4.5;
      cop.z = s.player.z - Math.cos(s.player.heading) * 3 - Math.sin(s.player.heading) * -4.5;
      cop.heading = s.player.heading; cop.speed = 33;
    }
    return { screen: SCREEN_PLAY, best: s.score };
  }
  if (name === 'mission') {
    world.startMission(3);
    s.money = 8250; s.rep = 1960; s.repLevel = 4; s.repMax = 2000; s.repTitle = 'BAY HUSTLER';
    s.player.health = 88; s.player.armor = 50;
    // 32 m back from the warehouse wall: door + sign + crates + guards all fit.
    s.player.x = 150; s.player.z = 182; s.player.heading = Math.PI; s.player.onFoot = true;
    s.player.weapon = 1;
    s.wanted = 1; s.crimeTimer = 0;
    // Three guards posted by the warehouse door + yellow crate in frame.
    const guards = s.peds.slice(0, 3);
    [[146, 166], [154, 166], [150, 164]].forEach(([x, z], i) => {
      const g = guards[i];
      g.x = x; g.z = z; g.heading = Math.PI; g.state = 'walk'; g.timer = 8;
      g.wp = { x, z };
    });
    world.showDialog('luz', [['Mama Luz', 'Crate goes inside, kid. The guards are mine — just don\u2019t dawdle.']]);
    runSteps(world, 60, IDLE);
    return { screen: SCREEN_PLAY, best: s.score };
  }
  if (name === 'walk') {
    world.startMission(0);
    s.money = 540; s.player.health = 100; s.player.armor = 50;
    s.player.x = -30; s.player.z = -14; s.player.heading = Math.PI; s.player.onFoot = true;
    s.wanted = 0;
    world.showDialog('carmen', [['Carmen', 'Plaza\u2019s busy tonight. The Solano is waiting on Paloma — go get it.']]);
    runSteps(world, 90, IDLE);
    return { screen: SCREEN_PLAY, best: s.score };
  }
  // Default: cover — mission 4, wanted 4, heli overhead, 4 units in pursuit,
  // Lucía on the dialog, sun in frame, dense sunset city.
  world.startMission(3);
  s.money = 14250; s.rep = 1960; s.repLevel = 4; s.repMax = 2000; s.repTitle = 'BAY HUSTLER';
  s.player.health = 82; s.player.armor = 64;
  putPlayerInSolano(world, -130, 60, Math.PI / 2, 46);
  s.wanted = 4; s.crimeTimer = 0;
  world.showDialog('lucia', [
    ['Lucía', 'Four units and a heli, and you\u2019re worried about the paint? Drive!'],
    ['You', 'Hold on. This is the fun part.'],
  ]);
  runSteps(world, 150, DRIVE);
  // Two units ALONGSIDE the player car (3/6 m back, 4.5/5 m to the side):
  // a cop placed straight behind the player sits behind the chase camera
  // (12.5 m back) and never appears in frame.
  const cops = [...s.police].filter((c) => !c.disabled).sort((a, b) => {
    const da = (a.x - s.player.x) ** 2 + (a.z - s.player.z) ** 2;
    const db = (b.x - s.player.x) ** 2 + (b.z - s.player.z) ** 2;
    return da - db;
  }).slice(0, 2);
  cops.forEach((cop, i) => {
    const back = 5 + i * 1;
    const side = i === 0 ? -4 : 5;
    cop.x = s.player.x - Math.sin(s.player.heading) * back + Math.cos(s.player.heading) * side;
    cop.z = s.player.z - Math.cos(s.player.heading) * back - Math.sin(s.player.heading) * side;
    cop.heading = s.player.heading; cop.speed = 44;
  });
  // Two traffic cars ahead on the same street, so the road ahead is alive.
  const traffic = s.cars.filter((c) => c.isTraffic && !c.isPlayer && !c.isPolice).slice(0, 2);
  traffic.forEach((c, i) => {
    c.x = s.player.x + Math.sin(s.player.heading) * (30 + i * 25);
    c.z = s.player.z + Math.cos(s.player.heading) * (30 + i * 25) + (i === 0 ? -2.2 : 2.2);
    c.heading = s.player.heading; c.speed = 20; c.disabled = false;
  });
  return { screen: SCREEN_PLAY, best: s.score };
}
