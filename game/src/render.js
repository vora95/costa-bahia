// Drawing only: the Three.js scene, the chase camera, the DOM HUD and the minimap.
// The 3D world is built once from the seeded city; every frame only syncs positions.
import { CARS, PALETTE, POLICE_CAR, RADIO, WEAPONS, WORLD, districtAt } from './config.js';
import { clamp, lerp } from './random.js';
import { portraitCanvas } from './portraits.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const THREE = window.THREE;

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture(seed) {
  // Facade: dark wall with a grid of windows, some lit warm for sunset.
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#3a3f4a'; c.fillRect(0, 0, w, h);
    const rnd = ((seed * 2654435761) >>> 0) / 4294967296;
    let s = seed * 97 + 13;
    const next = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    void rnd;
    for (let y = 14; y < h - 14; y += 26) {
      for (let x = 14; x < w - 14; x += 26) {
        c.fillStyle = next() < 0.38 ? '#ffd27a' : '#2a3550';
        c.fillRect(x, y, 16, 18);
      }
    }
  });
}

function signTexture(text, bg, fg, big) {
  return canvasTexture(512, big ? 256 : 128, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = fg; c.font = `bold ${big ? 84 : 64}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 4);
  });
}

function radialTexture(inner, outer) {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 720);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.1, 1500);
  camera.position.set(-200, 40, -40);

  // --- Sky: gradient dome that follows the camera + a sun that stays in frame.
  const skyGeo = new THREE.SphereGeometry(700, 20, 12);
  const skyColors = [];
  const pos = skyGeo.attributes.position;
  const top = new THREE.Color(PALETTE.skyTop); const mid = new THREE.Color(PALETTE.skyMid); const hor = new THREE.Color(PALETTE.skyHorizon);
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 700;
    const col = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(hor, 1 - (y + 0.2) / 0.45);
    skyColors.push(col.r, col.g, col.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sunTex = radialTexture('rgba(255,230,160,1)', 'rgba(255,140,60,0)');
  // depthTest off: the sun is a sky backdrop, so it always reads in frame
  // (a dense city would otherwise hide it behind rooftops at any heading).
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, depthTest: false, transparent: true }));
  sunSprite.scale.set(150, 150, 1);
  sunSprite.renderOrder = 999;
  scene.add(sunSprite);
  const glowTex = radialTexture('rgba(255,170,90,0.55)', 'rgba(255,140,60,0)');
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, depthTest: false, transparent: true }));
  glowSprite.scale.set(420, 420, 1);
  glowSprite.renderOrder = 998;
  scene.add(glowSprite);

  // --- Lights.
  scene.add(new THREE.AmbientLight(0xffd9b0, 0.75));
  const hemi = new THREE.HemisphereLight(0x8a5a9a, 0x4a3a2e, 0.55);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.15);
  sunLight.position.set(-180, 160, -80);
  scene.add(sunLight);

  // --- Shared materials / geometries.
  const matAsphalt = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const matSidewalk = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const matGround = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
  const matSand = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const matSea = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
  const matDash = new THREE.MeshBasicMaterial({ color: PALETTE.dash });
  const matTrunk = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const matLeaf = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const matLeaf2 = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf2 });
  const matLampPole = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const matLampHead = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const matGlass = new THREE.MeshLambertMaterial({ color: 0x1c2a44 });
  const matTire = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const winTexs = [windowTexture(1), windowTexture(2), windowTexture(3)];

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);

  function box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d); m.position.set(x, y, z);
    return m;
  }

  // --- Static city (built once per world).
  let cityGroup = null;
  let ferrisWheel = null;
  let marker = null;
  let markerRing = null;
  const carMeshes = new Map();
  const pedMeshes = new Map();
  let heliGroup = null; let heliRotor = null; let heliCone = null; let heliSpot = null; let heliBeacon = null;
  let playerFigure = null;
  const tracerLines = [];
  let builtFor = null;

  function buildCity(state) {
    if (cityGroup) { scene.remove(cityGroup); cityGroup = null; }
    carMeshes.clear(); pedMeshes.clear();
    cityGroup = new THREE.Group();
    const city = state.city;
    // Ground, beach, sea.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(960, 960), matGround);
    ground.rotation.x = -Math.PI / 2; ground.position.set(30, -0.05, 30);
    cityGroup.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(20, 560), matSand);
    sand.rotation.x = -Math.PI / 2; sand.position.set(-250, 0.02, 30);
    cityGroup.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 600), matSea);
    sea.rotation.x = -Math.PI / 2; sea.position.set(-470, -0.2, 30);
    cityGroup.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 560), new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(-259, 0.06, 30);
    cityGroup.add(foam);
    // Roads + sidewalks.
    for (const s of STREETS) {
      const r1 = new THREE.Mesh(new THREE.PlaneGeometry(12, 540), matAsphalt);
      r1.rotation.x = -Math.PI / 2; r1.position.set(s, 0.03, 30); cityGroup.add(r1);
      const r2 = new THREE.Mesh(new THREE.PlaneGeometry(540, 12), matAsphalt);
      r2.rotation.x = -Math.PI / 2; r2.position.set(30, 0.03, s); cityGroup.add(r2);
      for (const off of [-7.5, 7.5]) {
        const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 540), matSidewalk);
        sw1.rotation.x = -Math.PI / 2; sw1.position.set(s + off, 0.05, 30); cityGroup.add(sw1);
        const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(540, 3), matSidewalk);
        sw2.rotation.x = -Math.PI / 2; sw2.position.set(30, 0.05, s + off); cityGroup.add(sw2);
      }
    }
    // Dashes (instanced).
    const dashGeo = new THREE.PlaneGeometry(0.5, 3);
    const dashes = new THREE.InstancedMesh(dashGeo, matDash, city.dashes.length);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
    const eul = new THREE.Euler(-Math.PI / 2, 0, 0);
    city.dashes.forEach((d, i) => {
      eul.set(-Math.PI / 2, 0, d.rotY);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(d.x, 0.07, d.z), q, new THREE.Vector3(1, 1, 1));
      dashes.setMatrixAt(i, m4);
    });
    cityGroup.add(dashes);
    // Crosswalks.
    for (const cw of city.crosswalks) {
      for (let i = -2; i <= 2; i += 1) {
        const stripe = box(1.2, 0.06, 9, new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }), cw.x + i * 2.4, 0.08, cw.z);
        cityGroup.add(stripe);
      }
    }
    // Traffic lights.
    for (const tl of city.lights) {
      const pole = box(0.25, 5, 0.25, matLampPole, tl.x, 2.5, tl.z);
      cityGroup.add(pole);
      const head = box(0.7, 1.6, 0.7, matLampPole, tl.x, 5.4, tl.z);
      cityGroup.add(head);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0x3aff7a }));
      lamp.position.set(tl.x, 5.8, tl.z); cityGroup.add(lamp);
    }
    // Buildings.
    for (const b of city.buildings) {
      const side = new THREE.MeshLambertMaterial({ map: winTexs[b.tex], color: b.color });
      const roof = new THREE.MeshLambertMaterial({ color: b.roof });
      const mesh = new THREE.Mesh(boxGeo, [side, side, roof, roof, side, side]);
      mesh.scale.set(b.w, b.h, b.d);
      mesh.position.set(b.x, b.h / 2, b.z);
      cityGroup.add(mesh);
      if (b.roofKind === 'pyramid') {
        const pyr = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.72, b.h * 0.28, 4), roof);
        pyr.rotation.y = Math.PI / 4;
        pyr.position.set(b.x, b.h + b.h * 0.14, b.z);
        cityGroup.add(pyr);
      } else if (b.roofKind === 'ac') {
        cityGroup.add(box(3, 1.2, 2.4, roof, b.x - b.w / 5, b.h + 0.6, b.z));
        cityGroup.add(box(2.2, 1, 2, roof, b.x + b.w / 5, b.h + 0.5, b.z + b.d / 6));
      } else if (b.roofKind === 'tank') {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10), new THREE.MeshLambertMaterial({ color: 0x9a8a7a }));
        tank.position.set(b.x + b.w / 4, b.h + 1.3, b.z);
        cityGroup.add(tank);
      }
      if (b.warehouse) {
        // Door (south face), sign, lamps, crates. Door is tan against the dark
        // wall; the sign sits ON the wall (y 7.5 < wall top 9), not above it.
        const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.MeshLambertMaterial({ color: 0x9a7a4a }));
        door.position.set(b.x, 4, b.z + b.d / 2 + 0.06); cityGroup.add(door);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: signTexture('WAREHOUSE 4', '#c22e2e', '#ffe9c9', false) }));
        sign.position.set(b.x, 7.5, b.z + b.d / 2 + 0.08); cityGroup.add(sign);
        for (const sx of [-6, 6]) {
          cityGroup.add(box(0.25, 5, 0.25, matLampPole, b.x + sx, 2.5, b.z + b.d / 2 + 2));
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), matLampHead);
          lamp.position.set(b.x + sx, 5.1, b.z + b.d / 2 + 2); cityGroup.add(lamp);
        }
      }
      if (b.hotel) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 5), new THREE.MeshBasicMaterial({ map: signTexture('HOTEL PALOMA', '#2e4a6b', '#ffd27a', false) }));
        sign.position.set(b.x, b.h - 3, b.z + b.d / 2 + 0.08); cityGroup.add(sign);
      }
    }
    // Crates + containers.
    for (const cr of city.crates) {
      const m = box(cr.s, cr.s, cr.s, new THREE.MeshLambertMaterial({ color: cr.yellow ? 0xe8b13c : 0x8a6a4a }), cr.x, cr.s / 2, cr.z);
      m.rotation.y = cr.ry; cityGroup.add(m);
    }
    for (const ct of city.containers) {
      const m = box(6, 2.6, 2.6, new THREE.MeshLambertMaterial({ color: ct.color }), ct.x, 1.3, ct.z);
      m.rotation.y = ct.ry; cityGroup.add(m);
    }
    // Palms.
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5, 6);
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 0);
    city.palms.forEach((p, pi) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, matTrunk);
      trunk.position.y = 2.5; trunk.rotation.z = p.lean; g.add(trunk);
      const crown = new THREE.Mesh(crownGeo, (pi * 2654435761) % 2 === 0 ? matLeaf : matLeaf2);
      crown.scale.set(1, 0.55, 1); crown.position.set(p.lean * 4, 5.2, 0); g.add(crown);
      g.position.set(p.x, 0, p.z); g.scale.setScalar(p.s);
      cityGroup.add(g);
    });
    // Lamps (balanced, small heads — R5 fix #5).
    for (const l of city.lamps) {
      const pole = box(0.22, 5, 0.22, matLampPole, l.x, 2.5, l.z);
      cityGroup.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), matLampHead);
      head.position.set(l.x, 5.15, l.z); cityGroup.add(head);
    }
    // Billboards (freestanding roadside).
    for (const bb of city.billboards) {
      cityGroup.add(box(0.4, 9, 0.4, matLampPole, bb.x, 4.5, bb.z));
      const tex = signTexture(bb.text, bb.bg, bb.fg, false);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(bb.x, 10.5, bb.z);
      cityGroup.add(board);
    }
    // Pier + ferris wheel + fountain.
    // Pier: starts at the sand (x -252) and runs west into the sea — it must
    // NOT cross the beach road (x -240), or it reads as a beam over the road.
    const pier = box(64, 0.6, 12, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), -284, 1.0, 0);
    cityGroup.add(pier);
    for (let x = -254; x >= -314; x -= 12) {
      for (const z of [-5, 5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), matLampPole);
        post.position.set(x, 0, z); cityGroup.add(post);
      }
    }
    const fw = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    fw.add(box(0.8, 26, 0.8, legMat, -6, 13, 0));
    fw.add(box(0.8, 26, 0.8, legMat, 6, 13, 0));
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.55, 8, 24), new THREE.MeshLambertMaterial({ color: 0xe85a7a }));
    wheel.add(rim);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = box(0.4, 25, 0.4, legMat, 0, 0, 0);
      spoke.rotation.z = a; spoke.position.set(0, 0, 0);
      wheel.add(spoke);
      const cab = box(2.2, 2.2, 2.2, new THREE.MeshLambertMaterial({ color: [0xffd27a, 0x2e7f8a, 0xc22e5a, 0x7fb5a8][i % 4] }), Math.sin(a) * 13, Math.cos(a) * 13, 0);
      wheel.add(cab);
    }
    wheel.position.y = 26;
    fw.add(wheel);
    ferrisWheel = wheel;
    fw.position.set(-252, 0, -62);
    cityGroup.add(fw);
    // Plaza fountain at (-30,-30).
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 1.1, 16), new THREE.MeshLambertMaterial({ color: 0x9aa0aa }));
    basin.position.set(-30, 0.55, -30); cityGroup.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0x4a9ab0 }));
    water.position.set(-30, 1.0, -30); cityGroup.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    col.position.set(-30, 2.4, -30); cityGroup.add(col);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 10), new THREE.MeshLambertMaterial({ color: 0xffd27a }));
    top.position.set(-30, 4.4, -30); cityGroup.add(top);
    // Mission marker beacon.
    marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 34, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 17; marker.add(beam);
    markerRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
    markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = 0.3; marker.add(markerRing);
    cityGroup.add(marker);
    scene.add(cityGroup);
    builtFor = state;
  }

  function buildCarMesh(car) {
    const model = car.model;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: car.isPolice ? 0x1a1a22 : model.color });
    const len = model.len; const wid = model.wid; const h = model.h;
    const body = box(len, h * 0.55, wid, bodyMat, 0, 0.55 + h * 0.1, 0);
    g.add(body);
    if (model.van) {
      const cab = box(len * 0.9, h * 0.5, wid * 0.92, bodyMat, -len * 0.02, h * 0.75, 0);
      g.add(cab);
      const shield = box(0.1, h * 0.34, wid * 0.8, matGlass, len * 0.42, h * 0.72, 0);
      g.add(shield);
    } else if (model.pickup) {
      const cab = box(len * 0.32, h * 0.5, wid * 0.88, bodyMat, len * 0.22, h * 0.72, 0);
      g.add(cab);
      const shield = box(0.1, h * 0.32, wid * 0.76, matGlass, len * 0.36, h * 0.7, 0);
      g.add(shield);
      g.add(box(len * 0.42, 0.5, wid * 0.9, bodyMat, -len * 0.24, h * 0.62, 0));
    } else {
      const cab = box(len * 0.48, h * 0.42, wid * 0.86, matGlass, -len * 0.04, h * 0.68, 0);
      g.add(cab);
      const roof = box(len * 0.42, 0.08, wid * 0.8, bodyMat, -len * 0.04, h * 0.92, 0);
      g.add(roof);
    }
    if (model.sport) {
      g.add(box(0.3, 0.12, wid * 0.9, bodyMat, -len / 2 + 0.1, h * 0.95, 0));
    }
    if (model.taxi) {
      const sign = box(1.0, 0.3, 0.5, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 0, h + 0.35, 0);
      g.add(sign);
      g.add(box(len * 0.5, 0.18, wid + 0.02, new THREE.MeshLambertMaterial({ color: 0x111111 }), 0, h * 0.45, 0));
    }
    if (car.isPolice) {
      g.add(box(len * 0.5, 0.16, wid + 0.04, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, h * 0.45, 0));
      const bar = box(1.1, 0.22, 0.7, matLampPole, 0, h + 0.18, 0);
      g.add(bar);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.72), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.28, h + 0.18, 0); g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.72), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      blue.position.set(0.28, h + 0.18, 0); g.add(blue);
      g.userData.red = red; g.userData.blue = blue;
    }
    // Wheels.
    for (const [wx, wz] of [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]]) {
      const w = new THREE.Mesh(wheelGeo, matTire);
      w.position.set(wx, 0.42, wz); g.add(w);
    }
    // Headlights + taillights.
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    for (const wz of [wid / 2 - 0.3, -wid / 2 + 0.3]) {
      const a = box(0.12, 0.22, 0.4, hl, len / 2 + 0.02, 0.75, wz); g.add(a);
      const b = box(0.12, 0.22, 0.4, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -len / 2 - 0.02, 0.75, wz); g.add(b);
    }
    return g;
  }

  function buildPedMesh(ped) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: new THREE.Color(ped.shirt) });
    const skin = new THREE.MeshLambertMaterial({ color: new THREE.Color(ped.skin) });
    g.add(box(0.62, 0.85, 0.34, shirt, 0, 1.05, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), skin);
    head.position.set(0, 1.72, 0); g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 10), new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
    hair.scale.set(1, 0.6, 1); hair.position.set(0, 1.86, 0); g.add(hair);
    g.add(box(0.22, 0.7, 0.24, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), -0.16, 0.35, 0));
    g.add(box(0.22, 0.7, 0.24, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), 0.16, 0.35, 0));
    return g;
  }

  function buildPlayerFigure() {
    const g = new THREE.Group();
    g.add(box(0.24, 0.75, 0.26, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), -0.17, 0.38, 0));
    g.add(box(0.24, 0.75, 0.26, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), 0.17, 0.38, 0));
    g.add(box(0.66, 0.9, 0.36, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, 1.15, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), new THREE.MeshLambertMaterial({ color: 0xd9a06a }));
    head.position.set(0, 1.85, 0); g.add(head);
    g.add(box(0.6, 0.16, 0.6, new THREE.MeshLambertMaterial({ color: 0xc22e2e }), 0, 2.06, 0));
    g.add(box(0.6, 0.08, 0.3, new THREE.MeshLambertMaterial({ color: 0xc22e2e }), 0, 2.0, 0.32));
    return g;
  }

  function buildHeli() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
    g.add(box(4.6, 1.7, 1.9, bodyMat, 0, 0, 0));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 10), matGlass);
    nose.scale.set(1.1, 0.8, 0.9); nose.position.set(2.2, -0.1, 0); g.add(nose);
    g.add(box(4.2, 0.5, 0.5, bodyMat, -4.0, 0.4, 0));
    g.add(box(0.3, 1.6, 0.12, bodyMat, -5.9, 0.9, 0));
    const rotor = new THREE.Group();
    rotor.add(box(9.5, 0.14, 0.5, matLampPole, 0, 0, 0));
    rotor.add(box(0.5, 0.14, 9.5, matLampPole, 0, 0, 0));
    rotor.position.y = 1.25; g.add(rotor);
    heliRotor = rotor;
    const tail = new THREE.Group();
    tail.add(box(0.12, 1.6, 1.8, matLampPole, 0, 0, 0));
    tail.position.set(-6.1, 0.5, 0); g.add(tail);
    g.add(box(0.5, 0.16, 2.2, matLampPole, -1.1, -1.05, 0.8));
    g.add(box(0.5, 0.16, 2.2, matLampPole, -1.1, -1.05, -0.8));
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(0, 1.1, 0); g.add(beacon);
    heliBeacon = beacon;
    // Searchlight cone (apex at heli, opens downward toward the player).
    // Kept at scene level: oriented each frame from heli to player.
    const coneGeo = new THREE.ConeGeometry(5, 42, 16, 1, true);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(cone);
    heliCone = cone;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(5, 20), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = 0.1;
    scene.add(spot);
    heliSpot = spot;
    return g;
  }

  // --- HUD DOM.
  const $ = (id) => document.getElementById(id);
  const minimap = $('minimap');
  const mmCtx = minimap ? minimap.getContext('2d') : null;
  let mmBase = null;
  let hudTimer = 0;

  function buildMinimapBase(state) {
    const cv = document.createElement('canvas');
    cv.width = 220; cv.height = 220;
    const c = cv.getContext('2d');
    const sx = (x) => ((x + 260) / 560) * 220;
    const sz = (z) => ((z + 260) / 560) * 220;
    c.fillStyle = '#1c2733'; c.fillRect(0, 0, 220, 220);
    c.fillStyle = '#14606e'; c.fillRect(0, 0, sx(-240), 220); // sea
    c.fillStyle = '#d9b380'; c.fillRect(sx(-260), 0, sx(-240) - sx(-260), 220); // beach
    c.strokeStyle = '#4a4f5a'; c.lineWidth = 4;
    for (const s of STREETS) {
      c.beginPath(); c.moveTo(sx(s), 0); c.lineTo(sx(s), 220); c.stroke();
      c.beginPath(); c.moveTo(0, sz(s)); c.lineTo(220, sz(s)); c.stroke();
    }
    c.fillStyle = '#5a5f6e';
    for (const b of state.city.buildings) c.fillRect(sx(b.x - b.w / 2), sz(b.z - b.d / 2), (b.w / 560) * 220, (b.d / 560) * 220);
    c.fillStyle = '#4a9ab0';
    c.beginPath(); c.arc(sx(-30), sz(-30), 5, 0, Math.PI * 2); c.fill();
    mmBase = cv;
  }

  function drawMinimap(state) {
    if (!mmCtx || !mmBase) return;
    mmCtx.clearRect(0, 0, 220, 220);
    mmCtx.drawImage(mmBase, 0, 0);
    const sx = (x) => ((x + 260) / 560) * 220;
    const sz = (z) => ((z + 260) / 560) * 220;
    // Route to mission target.
    if (!state.complete) {
      const missions = [[-228, 0], [-33, 30], [60, -150], [150, 150], [30, -150], [-210, 210]];
      const tgt = missions[state.missionIndex];
      mmCtx.strokeStyle = '#ffd24a'; mmCtx.lineWidth = 2; mmCtx.setLineDash([5, 4]);
      mmCtx.beginPath(); mmCtx.moveTo(sx(state.player.x), sz(state.player.z)); mmCtx.lineTo(sx(tgt[0]), sz(tgt[1])); mmCtx.stroke();
      mmCtx.setLineDash([]);
      const pulse = 5 + Math.sin(state.elapsed * 5) * 2;
      mmCtx.fillStyle = '#ffd24a';
      mmCtx.beginPath(); mmCtx.arc(sx(tgt[0]), sz(tgt[1]), pulse, 0, Math.PI * 2); mmCtx.fill();
      mmCtx.fillStyle = '#1c2733';
      mmCtx.beginPath(); mmCtx.arc(sx(tgt[0]), sz(tgt[1]), 2, 0, Math.PI * 2); mmCtx.fill();
    }
    // Police + heli.
    mmCtx.fillStyle = '#ff4444';
    for (const c of state.police) { if (c.disabled) continue; mmCtx.beginPath(); mmCtx.arc(sx(c.x), sz(c.z), 3, 0, Math.PI * 2); mmCtx.fill(); }
    if (state.heli.active) {
      mmCtx.fillStyle = '#ff9a2a';
      mmCtx.beginPath(); mmCtx.arc(sx(state.heli.x), sz(state.heli.z), 4, 0, Math.PI * 2); mmCtx.fill();
    }
    // Player arrow.
    mmCtx.save();
    mmCtx.translate(sx(state.player.x), sz(state.player.z));
    mmCtx.rotate(Math.PI - state.player.heading);
    mmCtx.fillStyle = '#ffffff';
    mmCtx.beginPath(); mmCtx.moveTo(0, -7); mmCtx.lineTo(5, 6); mmCtx.lineTo(-5, 6); mmCtx.closePath(); mmCtx.fill();
    mmCtx.restore();
  }

  function setText(id, value) {
    const el = $(id);
    if (el && el.textContent !== value) el.textContent = value;
  }
  function setWidth(id, pct) {
    const el = $(id);
    if (el) el.style.width = clamp(pct, 0, 100) + '%';
  }

  function updateHud(state, screen) {
    const p = state.player;
    const missionTitles = ['PIER MEETING', 'STEAL THE SOLANO', 'LOSE THE HEAT', 'WAREHOUSE RUN', 'PICK UP LUCÍA', 'LAST BRIDGE'];
    const mi = Math.min(state.missionIndex, 5);
    setText('wanted', '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted));
    const wEl = $('wanted');
    if (wEl) wEl.style.color = state.wanted >= 3 ? '#ff5555' : '#ffd24a';
    setText('money', '$' + state.money.toLocaleString('en-US'));
    setText('health-num', String(Math.round(p.health)));
    setText('armor-num', String(Math.round(p.armor)));
    setWidth('health-bar', p.health);
    setWidth('armor-bar', p.armor);
    setText('rep-label', `REP ${state.repLevel} ${state.repTitle}`);
    setWidth('rep-bar', (state.rep / state.repMax) * 100);
    setText('rep-num', `${state.rep}/${state.repMax}`);
    // Mission.
    setText('mission-title', state.complete ? 'COSTA BAHIA — COMPLETE' : `MISSION ${mi + 1}/6 — ${missionTitles[mi]}`);
    const mDef = [{ stages: 3 }, { stages: 3 }, { stages: 4 }, { stages: 4 }, { stages: 4 }, { stages: 4 }][mi];
    setText('mission-stage', `STAGE ${state.missionStage}/${mDef.stages}`);
    setWidth('mission-stage-bar', (state.missionStage / mDef.stages) * 100);
    const tgt = [[-228, 0], [-33, 30], [60, -150], [150, 150], [30, -150], [-210, 210]][mi];
    const d = Math.hypot(p.x - tgt[0], p.z - tgt[1]);
    setText('mission-dist', state.complete ? '—' : `${Math.round(d)} m`);
    setText('mission-timer', mi === 5 && !state.complete ? `⏱ ${Math.max(0, Math.ceil(90 - state.missionTimer))}s` : '');
    // Police panel.
    const panel = $('police-list');
    if (panel) {
      const rows = [];
      const sorted = [...state.police].filter((c) => !c.disabled).sort((a, b) => {
        const da = Math.hypot(a.x - p.x, a.z - p.z); const db = Math.hypot(b.x - p.x, b.z - p.z);
        return da - db;
      }).slice(0, 4);
      for (const c of sorted) {
        const dist = Math.hypot(c.x - p.x, c.z - p.z);
        const status = c.speed < 1 && state.wanted >= 4 ? 'ROADBLOCK' : dist < 12 ? 'RAMMING' : dist < 45 ? 'PURSUIT' : 'EN ROUTE';
        rows.push(`<div class="pr-row"><span>UNIT ${String(10 + c.id)}</span><span>${status}</span><span>${Math.round(dist)}m</span></div>`);
      }
      if (state.heli.active) rows.push(`<div class="pr-row air"><span>AIR-2</span><span>SEARCHLIGHT</span><span>${Math.round(state.heli.dist)}m</span></div>`);
      if (rows.length === 0) rows.push('<div class="pr-row"><span>NO UNITS</span><span>—</span><span></span></div>');
      const html = rows.join('');
      if (panel.innerHTML !== html) panel.innerHTML = html;
    }
    setText('police-count', state.wanted >= 1 ? `${state.police.filter((c) => !c.disabled).length} UNITS — CODE ${Math.min(4, state.wanted + 1)}` : 'CBPD RESPONSE');
    // Speed / car / weapons.
    const kmh = Math.round(Math.abs(p.speed || 0) * 3.6);
    setText('speed', String(kmh));
    setText('carname', p.car ? p.car.model.name : 'ON FOOT');
    setText('condition', p.car ? `CONDITION ${Math.round(p.car.hp)}%` : '—');
    const wEl2 = $('weapons');
    if (wEl2) {
      const html = state.weapons.map((w, i) => {
        const ammo = w.mag === Infinity ? '∞' : `${w.magAmmo}/${w.reserveAmmo}`;
        return `<div class="wslot${i === p.weapon ? ' active' : ''}"><b>${i + 1}</b> ${w.name} <span>${ammo}</span></div>`;
      }).join('');
      if (wEl2.innerHTML !== html) wEl2.innerHTML = html;
    }
    // Clock / location / radio.
    const hh = Math.floor(state.clockMin / 60) % 24; const mm = state.clockMin % 60;
    setText('clock', `${state.day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    const dist2 = districtAt(p.x, p.z);
    setText('location', `${dist2.name} / ${dist2.sub}`);
    setText('radio', `${RADIO[state.radioIndex].name} — ${RADIO[state.radioIndex].genre}`);
    // Dialog (bottom-left, compact — never covers the player car at screen centre).
    const dlg = $('dialog');
    if (dlg) {
      if (state.dialog) {
        dlg.style.display = 'flex';
        const [name, line] = state.dialog.lines[state.dialog.idx];
        const cv = $('portrait');
        if (cv) {
          const pc = portraitCanvas(state.dialog.char, state.elapsed);
          cv.getContext('2d').drawImage(pc, 0, 0);
        }
        setText('dialog-name', name);
        setText('dialog-text', line);
      } else dlg.style.display = 'none';
    }
    // Toast + objective.
    const toast = $('toast');
    if (toast) {
      if (state.toast) { toast.style.display = 'block'; setText('toast', state.toast); }
      else toast.style.display = 'none';
    }
    const objTitles = ['Meet Carmen at Pier 9', 'Steal the red Solano GT', 'Drop your wanted level to zero', 'Deliver the package to Warehouse 4', 'Pick up Lucía at Hotel Paloma', 'Escape to the Old Harbor docks'];
    setText('objective', state.complete ? 'Costa Bahia is yours.' : `▶ ${objTitles[mi]}`);
    const ch = $('crosshair');
    if (ch) ch.style.display = (!p.onFoot || state.weapons[p.weapon].id === 'fists' || screen !== SCREEN_PLAY) ? 'none' : 'block';
    drawMinimap(state);
  }

  function setScreenOverlay(screen, state, best) {
    const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? 'flex' : 'none'; };
    show('screen-title', screen === SCREEN_TITLE);
    show('screen-pause', screen === SCREEN_PAUSED);
    show('screen-over', screen === SCREEN_OVER);
    show('screen-complete', screen === SCREEN_COMPLETE);
    if (screen === SCREEN_TITLE) setText('best-line', `Best score ${best} · Autosave on · M to mute`);
    if (screen === SCREEN_OVER) {
      setText('over-title', state.busted ? 'BUSTED' : 'TIME UP');
      setText('over-stats', `Money $${state.money.toLocaleString('en-US')} · Missions ${state.missionIndex}/6 · Score ${state.score}`);
    }
    if (screen === SCREEN_COMPLETE) {
      setText('complete-stats', `Money $${state.money.toLocaleString('en-US')} · Shots ${state.stats.hits}/${state.stats.shots} · Cars stolen ${state.stats.stolen} · Score ${state.score}`);
    }
    const hud = $('hud');
    if (hud) hud.style.display = (screen === SCREEN_PLAY) ? 'block' : 'none';
  }

  function resize() {
    const w = window.innerWidth; const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const camPos = new THREE.Vector3(-200, 40, -40);
  const camLook = new THREE.Vector3(0, 0, 0);
  let snapCam = false;
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  function draw(state, screen, best, dt) {
    if (builtFor !== state) { buildCity(state); buildMinimapBase(state); }
    const p = state.player;
    // --- Camera.
    if (screen === SCREEN_TITLE) {
      const a = state.elapsed * 0.05;
      camPos.set(-100 + Math.sin(a) * 130, 55, -40 + Math.cos(a) * 130);
      camLook.set(-60, 0, 20);
      camera.position.lerp(camPos, 0.05);
      camera.lookAt(camLook);
      camera.fov = 62;
      camera.updateProjectionMatrix();
    } else {
      const fwdX = Math.sin(p.heading); const fwdZ = Math.cos(p.heading);
      const dist = p.onFoot ? 7.5 : 12.5;
      const height = p.onFoot ? 3.4 : 5.0;
      tmpV.set(p.x - fwdX * dist, height + Math.abs(p.speed || 0) * 0.04, p.z - fwdZ * dist);
      tmpV2.set(p.x + fwdX * 9, 2.4, p.z + fwdZ * 9);
      if (snapCam) {
        // Screenshot staging: jump straight to the chase position so the
        // player is centred on the very first paint (no lerp tail).
        camPos.copy(tmpV); camLook.copy(tmpV2); snapCam = false;
      } else {
        camPos.lerp(tmpV, 1 - Math.exp(-dt * 5));
        camLook.lerp(tmpV2, 1 - Math.exp(-dt * 7));
      }
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.fov = 62 + clamp(Math.abs(p.speed || 0) * 0.25, 0, 8);
      camera.updateProjectionMatrix();
    }
    // --- Sun + sky follow the camera (sun stays in frame, any heading).
    // Sun sits ~12 deg above the camera axis, ~18 deg to the left: inside the
    // 62 deg vertical / ~92 deg horizontal frustum at any heading.
    sky.position.copy(camera.position);
    camera.getWorldDirection(tmpV);
    const up = new THREE.Vector3(0, 1, 0);
    const left = new THREE.Vector3().crossVectors(up, tmpV).normalize();
    const sunDir = tmpV.clone();
    sunDir.addScaledVector(left, 0.35);
    sunDir.y += 0.22;
    sunDir.normalize();
    sunSprite.position.copy(camera.position).addScaledVector(sunDir, 430);
    glowSprite.position.copy(sunSprite.position);
    sunLight.position.copy(camera.position).addScaledVector(sunDir, 200);
    sunLight.target.position.copy(camera.position);
    sunLight.target.updateMatrixWorld();
    // --- Ferris wheel turns with sim time.
    if (ferrisWheel) ferrisWheel.rotation.z = state.elapsed * 0.12;
    // --- Cars.
    for (const c of state.cars) {
      let mesh = carMeshes.get(c.id);
      if (!mesh) {
        if (!cityGroup) continue;
        mesh = buildCarMesh(c);
        cityGroup.add(mesh);
        carMeshes.set(c.id, mesh);
      }
      mesh.position.set(c.x, 0, c.z);
      mesh.rotation.y = c.heading;
      mesh.visible = true;
      if (c.isPolice && mesh.userData.red) {
        const phase = Math.sin(c.lightPhase) > 0;
        mesh.userData.red.material.color.setHex(phase ? 0xff2222 : 0x441111);
        mesh.userData.blue.material.color.setHex(phase ? 0x111144 : 0x2244ff);
      }
      if (c.smoke > 0) {
        mesh.position.y = Math.sin(state.elapsed * 20) * 0.05;
      }
    }
    // --- Peds.
    state.peds.forEach((ped, i) => {
      let mesh = pedMeshes.get(i);
      if (!mesh) {
        if (!cityGroup) return;
        mesh = buildPedMesh(ped);
        cityGroup.add(mesh);
        pedMeshes.set(i, mesh);
      }
      mesh.position.set(ped.x, ped.down > 0 ? 0.35 : Math.abs(Math.sin(ped.bob)) * 0.08, ped.z);
      mesh.rotation.y = ped.heading;
      mesh.rotation.x = ped.down > 0 ? Math.PI / 2 : 0;
    });
    // --- Player figure (on foot only).
    if (p.onFoot) {
      if (!playerFigure) { playerFigure = buildPlayerFigure(); scene.add(playerFigure); }
      playerFigure.visible = true;
      playerFigure.position.set(p.x, 0, p.z);
      playerFigure.rotation.y = p.heading;
    } else if (playerFigure) playerFigure.visible = false;
    // --- Heli.
    if (state.heli.active) {
      if (!heliGroup) { heliGroup = buildHeli(); scene.add(heliGroup); }
      heliGroup.visible = true;
      const h = state.heli;
      heliGroup.position.set(h.x, h.y, h.z);
      heliGroup.rotation.y = h.heading;
      if (heliRotor) heliRotor.rotation.y = h.rotor;
      if (heliBeacon) heliBeacon.material.color.setHex(Math.sin(state.elapsed * 6) > 0 ? 0xff2222 : 0x441111);
      // Cone: apex (+Y) at the heli, base at the player.
      if (heliCone) {
        const dx = h.x - p.x; const dy = h.y; const dz = h.z - p.z;
        const len = Math.hypot(dx, dy, dz);
        heliCone.position.set((h.x + p.x) / 2, h.y / 2, (h.z + p.z) / 2);
        heliCone.scale.set(1, len / 42, 1);
        tmpV.set(dx, dy, dz).normalize();
        heliCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpV);
        heliCone.visible = true;
      }
      if (heliSpot) { heliSpot.position.set(p.x, 0.12, p.z); heliSpot.visible = true; }
    } else {
      if (heliGroup) heliGroup.visible = false;
      if (heliSpot) heliSpot.visible = false;
      if (heliCone) heliCone.visible = false;
    }
    // --- Mission beacon.
    if (marker) {
      const targets = [[-228, 0], [-33, 30], [60, -150], [150, 150], [30, -150], [-210, 210]];
      if (state.complete) marker.visible = false;
      else {
        marker.visible = true;
        const t = targets[Math.min(state.missionIndex, 5)];
        marker.position.set(t[0], 0, t[1]);
        if (markerRing) markerRing.scale.setScalar(1 + Math.sin(state.elapsed * 4) * 0.18);
      }
    }
    // --- Tracers.
    for (const line of tracerLines) scene.remove(line);
    tracerLines.length = 0;
    for (const fx of state.fx) {
      if (fx.kind !== 'tracer') continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(fx.x1, fx.y, fx.z1),
        new THREE.Vector3(fx.x2, fx.y, fx.z2),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
      scene.add(line);
      tracerLines.push(line);
    }
    renderer.render(scene, camera);
    hudTimer += dt;
    if (hudTimer > 0.09) { hudTimer = 0; updateHud(state, screen); }
    setScreenOverlay(screen, state, best);
  }

  return { draw, resize, snapCamera() { snapCam = true; } };
}
