// Boot + the one loop: input every frame, the world in fixed 1/60 s steps, the
// renderer paints what is there. Screens: title, play, paused, game over, complete.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|walk stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_COMPLETE, EVENT_CRASH, EVENT_MISSION, EVENT_PUNCH, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, ACTION_WEAPON_NEXT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
}
function saveGame() {
  try {
    const s = world.state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIndex: s.missionIndex, money: s.money, rep: s.rep, repLevel: s.repLevel,
      health: s.player.health, armor: s.player.armor,
      weapons: s.weapons.map((w) => ({ magAmmo: w.magAmmo, reserveAmmo: w.reserveAmmo })),
    }));
  } catch { /* private mode */ }
}
function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    const s = world.state;
    if (typeof d.money === 'number') s.money = d.money;
    if (typeof d.rep === 'number') s.rep = d.rep;
    if (typeof d.repLevel === 'number') s.repLevel = d.repLevel;
    if (typeof d.health === 'number') s.player.health = d.health;
    if (typeof d.armor === 'number') s.player.armor = d.armor;
    if (Array.isArray(d.weapons)) {
      d.weapons.forEach((w, i) => { if (s.weapons[i]) { s.weapons[i].magAmmo = w.magAmmo; s.weapons[i].reserveAmmo = w.reserveAmmo; } });
    }
    if (typeof d.missionIndex === 'number' && d.missionIndex > 0 && d.missionIndex < 6) world.startMission(d.missionIndex);
  } catch { /* corrupt save: start fresh */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.snapCamera();
  // Paint ~45 frames: the HUD (throttled to 0.09 s) updates at least once, so
  // the frame is what a player actually sees.
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, STEP);
    painted += 1;
    if (painted < 45) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(message) { status.textContent = message; }

  function startGame() {
    world.reset();
    loadGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.setRadio(true);
    announce('Playing Costa Bahia. Mission 1: meet Carmen at Pier 9.');
  }

  function endGame(complete) {
    screen = complete ? SCREEN_COMPLETE : SCREEN_OVER;
    if (world.state.score > best) { best = world.state.score; saveBest(best); }
    saveGame();
    audio.setRadio(false);
    audio.setSiren(false, 0);
    announce(complete ? 'Costa Bahia complete.' : 'Busted. Game over.');
  }

  function step(actions) {
    const ax = input.axis();
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, ax, actions);
    if (events & EVENT_MISSION) { audio.mission(); saveGame(); }
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_BUSTED) endGame(false);
    else if (events & EVENT_COMPLETE) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Screen transitions are read every frame, on EVERY screen (the old code
    // only polled actions inside step(), which never ran on the title screen,
    // so Enter did nothing there).
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_WEAPON_NEXT)) {
      world.state.player.weapon = (world.state.player.weapon + 1) % 4;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let guard = 0;
      let first = true;
      while (accumulator >= STEP && guard < 8) {
        if (screen === SCREEN_TITLE) world.state.elapsed += STEP;
        // Edge-triggered actions go to the first step only: handing the same
        // E-press to 8 steps would enter AND exit the car in one frame.
        else { step(first ? actions : 0); first = false; }
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 8) accumulator = 0;
    } else {
      accumulator = 0;
    }
    // Audio follows the sim.
    const s = world.state;
    const kmh = Math.abs(s.player.speed || 0) * 3.6;
    audio.setEngine(screen === SCREEN_PLAY ? kmh : 0, screen === SCREEN_PLAY && !s.player.onFoot);
    let near = 0;
    for (const c of s.police) {
      if (!c.disabled && (c.x - s.player.x) ** 2 + (c.z - s.player.z) ** 2 < 900) { near = 1; break; }
    }
    audio.setSiren(screen === SCREEN_PLAY && s.wanted > 0, near);
    saveTimer += 1 / 60;
    if (saveTimer > 15 && screen === SCREEN_PLAY) { saveTimer = 0; saveGame(); }
    renderer.draw(s, screen, best, 1 / 60);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') audio.toggleMute();
    if (e.code === 'KeyR' && screen === SCREEN_PLAY) {
      world.state.radioIndex = (world.state.radioIndex + 1) % 4;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Costa Bahia. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
