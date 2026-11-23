// Port Aurora — the game itself: state, the loop, the wanted system, saving,
// and every helper the other modules call on the shared game object G.
// One job: wire the systems together and run them, sixty frames a second.
import { WORLD, START_CASH, WANTED_DECAY_SECONDS, MAX_WANTED } from './config.js';
import { makeRng, clamp } from './random.js';
import { buildCity, LANDMARKS } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import {
  spawnTraffic, spawnParked, spawnPolice, updateCars, damageCar,
  policeCount, nearestPoliceDist, parkCar,
} from './vehicles.js';
import {
  makePlayer, spawnPeds, spawnFootCop, updatePeds, updateBullets,
  updatePlayerOnFoot, exitCar,
} from './people.js';
import { updatePlayerCar } from './vehicles.js';
import { createMissions, MISSIONS } from './missions.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitle, drawPause, drawBusted, drawWasted, drawComplete } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const G = {
  time: 0,
  state: 'title',
  city: null,
  rng: makeRng(20261123),
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  particles: [],
  toasts: [],
  toastKeys: {},
  wanted: 0,
  unseenT: 0,
  lastCrimeT: -100,
  cash: START_CASH,
  missionIndex: 0,
  completedMissions: [],
  missions: null,
  audio: createAudio(),
  muted: false,
  loadedSave: loadSave(),
  menuIndex: 0,
  menuView: null,
  startedAt: 0,
  flashRed: 0,
  shake: 0,
  bustedFine: 0,
  cam: { x: 3360, y: 2240, viewW: 1280, viewH: 720 },
  titleCamFixed: false,
  frozen: false,
  freezeTicks: 0,
  stats: { carsStolen: 0 },
  hidePlayer: false,
};

function setState(next) {
  if (G.state === next) return;
  G.state = next;
  if (statusEl) {
    statusEl.textContent =
      next === 'playing' ? 'Playing Port Aurora' :
      next === 'title' ? 'Port Aurora title screen' :
      next === 'paused' ? 'Game paused' :
      next === 'busted' ? 'Busted by the police' :
      next === 'wasted' ? 'Wasted' :
      next === 'complete' ? 'Story complete' : next;
  }
  if (next === 'busted' || next === 'wasted') {
    const fine = next === 'busted'
      ? Math.min(Math.round(G.cash * 0.2), 500)
      : Math.min(Math.round(G.cash * 0.15), 300);
    G.bustedFine = Math.min(fine, Math.round(G.cash));
    G.cash -= G.bustedFine;
    G.wanted = 0;
    G.unseenT = 0;
    G.cars = G.cars.filter((c) => c.kind !== 'police');
    G.peds = G.peds.filter((p) => p.kind !== 'cop');
    if (next === 'busted') G.audio.busted();
    else G.audio.wasted();
    writeSave(G);
  }
}
G.setState = setState;

G.toast = function toast(text, life) {
  G.toasts = G.toasts.filter((t) => t.text !== text);
  G.toasts.push({ text, life: life || 4 });
  if (G.toasts.length > 3) G.toasts.shift();
};

G.toastOnce = function toastOnce(key, text, cooldown) {
  const last = G.toastKeys[key] || -100;
  if (G.time - last < (cooldown || 8)) return;
  G.toastKeys[key] = G.time;
  G.toast(text, 4);
};

G.setWanted = function setWanted(n) {
  const next = clamp(Math.round(n), 0, MAX_WANTED);
  if (next > G.wanted) {
    G.audio.sirenBlip();
    G.lastCrimeT = G.time;
    G.unseenT = 0;
  }
  G.wanted = next;
};

G.addWanted = function addWanted(n) {
  G.setWanted(G.wanted + n);
};

G.save = function save() {
  writeSave(G);
};

G.addSparks = function addSparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 220;
    G.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.2, maxLife: 0.45,
      color: Math.random() < 0.5 ? '#ffd94a' : '#ff7b2d', size: 2.5,
    });
  }
};

G.addSmoke = function addSmoke(x, y, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
      life: 0.8 + Math.random() * 0.7, maxLife: 1.5,
      color: '#555', size: 5 + Math.random() * 5,
    });
  }
};

G.addBlood = function addBlood(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    G.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4, maxLife: 0.4, color: '#a01818', size: 3,
    });
  }
};

G.addMuzzle = function addMuzzle(x, y) {
  G.particles.push({
    x, y, vx: 0, vy: 0, life: 0.07, maxLife: 0.07, color: '#ffe9a8', size: 9,
  });
};

G.damageCar = function damageCarBound(car, amount) {
  damageCar(G, car, amount);
};

function respawn(spot) {
  const p = G.player;
  if (p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.x = spot.x;
  p.y = spot.y;
  p.health = 100;
  p.onFoot = true;
  p.bustProgress = 0;
  p.ammo = 12;
  G.flashRed = 0;
  G.setState('playing');
  G.toast('Back on the streets.', 3);
}

function newGame() {
  clearSave();
  G.loadedSave = null;
  G.cash = START_CASH;
  G.missionIndex = 0;
  G.completedMissions = [];
  G.wanted = 0;
  G.unseenT = 0;
  G.bullets = [];
  G.particles = [];
  G.toasts = [];
  const p = G.player;
  p.x = LANDMARKS.safehouse.x;
  p.y = LANDMARKS.safehouse.y;
  p.health = 100;
  p.onFoot = true;
  p.car = null;
  p.ammo = 12;
  G.startedAt = G.time;
  G.missions.start(0);
  G.setState('playing');
  G.audio.unlock();
}

function continueGame() {
  const s = G.loadedSave;
  if (!s) return;
  G.cash = s.cash;
  G.missionIndex = Math.min(s.missionIndex, MISSIONS.length - 1);
  G.completedMissions = s.completed.slice();
  G.wanted = 0;
  const p = G.player;
  p.x = LANDMARKS.safehouse.x;
  p.y = LANDMARKS.safehouse.y;
  p.health = 100;
  p.onFoot = true;
  p.car = null;
  G.startedAt = G.time;
  G.missions.start(G.missionIndex);
  G.setState('playing');
  G.audio.unlock();
}

function updateWanted(dt) {
  if (G.wanted <= 0) return;
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const nearest = nearestPoliceDist(G, px, py);
  let footNear = Infinity;
  for (const ped of G.peds) {
    if (ped.kind !== 'cop' || ped.state === 'down') continue;
    footNear = Math.min(footNear, Math.hypot(ped.x - px, ped.y - py));
  }
  if (nearest > 520 && footNear > 520) G.unseenT += dt;
  else G.unseenT = 0;
  if (G.unseenT >= WANTED_DECAY_SECONDS) {
    G.unseenT = 0;
    G.wanted -= 1;
    G.toast('The heat is cooling off…', 3);
  }
}

let policeSpawnT = 0;
let copSpawnT = 0;
function maintainPolice(dt) {
  policeSpawnT -= dt;
  copSpawnT -= dt;
  if (G.wanted <= 0) return;
  const wantCars = Math.min(1 + G.wanted, 6);
  if (policeSpawnT <= 0) {
    policeSpawnT = 1.2;
    if (policeCount(G) < wantCars) {
      const p = G.player;
      spawnPolice(G, p.car ? p.car.x : p.x, p.car ? p.car.y : p.y);
    }
  }
  if (G.wanted >= 3 && G.player.onFoot && copSpawnT <= 0) {
    copSpawnT = 2.5;
    let footCops = 0;
    for (const ped of G.peds) if (ped.kind === 'cop' && ped.state !== 'down') footCops++;
    if (footCops < 2) {
      const p = G.player;
      const a = Math.random() * Math.PI * 2;
      spawnFootCop(G, p.x + Math.cos(a) * 340, p.y + Math.sin(a) * 340);
    }
  }
}

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
}

function updateToasts(dt) {
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].life -= dt;
    if (G.toasts[i].life <= 0) G.toasts.splice(i, 1);
  }
}

function updatePlaying(dt, input) {
  const p = G.player;
  if (p.onFoot) updatePlayerOnFoot(G, input, dt, G.cam);
  else {
    updatePlayerCar(G, p.car, input, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    if (input.wasPressed('e')) exitCar(G);
    if (input.wasPressed('h')) G.audio.horn();
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    G.menuIndex = 0;
    G.setState('paused');
    return;
  }
  if (input.wasPressed('m')) {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    G.toast(G.muted ? 'Muted' : 'Sound on', 2);
  }
  updateCars(G, dt);
  updatePeds(G, dt);
  updateBullets(G, dt);
  G.missions.update(dt);
  updateWanted(dt);
  maintainPolice(dt);
  updateParticles(dt);
  updateToasts(dt);
  G.flashRed = Math.max(0, G.flashRed - dt * 1.6);
  G.shake = Math.max(0, G.shake - dt * 22);
  const speedRatio = p.car ? Math.abs(p.car.speed) / 640 : 0;
  G.audio.update(dt, { wanted: G.wanted, speedRatio, driving: !!p.car, playing: true });
  // Camera follows the player, eased so it never snaps.
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
}

function menuItems() {
  return G.loadedSave ? ['Continue', 'New Game', 'How to Play'] : ['New Game', 'How to Play'];
}

function updateTitle(dt, input, viewW, viewH) {
  if (!G.titleCamFixed) {
    G.cam.x = 3360 + Math.sin(G.time * 0.045) * 700;
    G.cam.y = 2240 + Math.cos(G.time * 0.06) * 500;
  }
  const items = menuItems();
  if (input.wasPressed('arrowup') || input.wasPressed('w')) {
    G.menuIndex = (G.menuIndex + items.length - 1) % items.length;
    G.audio.click();
  }
  if (input.wasPressed('arrowdown') || input.wasPressed('s')) {
    G.menuIndex = (G.menuIndex + 1) % items.length;
    G.audio.click();
  }
  // Clicking a menu button picks it.
  if (input.wasClicked()) {
    const bx = viewW / 2 - 140;
    let by = viewH * 0.42;
    for (let i = 0; i < items.length; i++) {
      if (input.mouse.x >= bx && input.mouse.x <= bx + 280 && input.mouse.y >= by && input.mouse.y <= by + 44) {
        G.menuIndex = i;
        pickTitleItem(items[i]);
        return;
      }
      by += 56;
    }
  }
  if (input.wasPressed('enter') || input.wasPressed(' ')) {
    pickTitleItem(items[G.menuIndex]);
  }
}

function pickTitleItem(item) {
  G.audio.click();
  if (item === 'Continue') continueGame();
  else if (item === 'New Game') newGame();
  else if (item === 'How to Play') G.menuView = G.menuView === 'help' ? null : 'help';
}

function updatePause(dt, input, viewW, viewH) {
  const items = ['Resume', 'Restart Job', 'Quit to Title'];
  if (input.wasPressed('arrowup') || input.wasPressed('w')) {
    G.menuIndex = (G.menuIndex + items.length - 1) % items.length;
    G.audio.click();
  }
  if (input.wasPressed('arrowdown') || input.wasPressed('s')) {
    G.menuIndex = (G.menuIndex + 1) % items.length;
    G.audio.click();
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    G.setState('playing');
    return;
  }
  if (input.wasClicked()) {
    const bx = viewW / 2 - 140;
    let by = viewH * 0.45;
    for (let i = 0; i < items.length; i++) {
      if (input.mouse.x >= bx && input.mouse.x <= bx + 280 && input.mouse.y >= by && input.mouse.y <= by + 44) {
        G.menuIndex = i;
        pickPauseItem(items[i]);
        return;
      }
      by += 56;
    }
  }
  if (input.wasPressed('enter') || input.wasPressed(' ')) pickPauseItem(items[G.menuIndex]);
}

function pickPauseItem(item) {
  G.audio.click();
  if (item === 'Resume') G.setState('playing');
  else if (item === 'Restart Job') {
    G.wanted = 0;
    G.missions.start(G.missionIndex);
    G.setState('playing');
  } else if (item === 'Quit to Title') {
    G.menuIndex = 0;
    G.menuView = null;
    G.setState('title');
  }
}

function updateEndScreen(input) {
  if (input.wasPressed('enter') || input.wasPressed(' ')) {
    if (G.state === 'busted') respawn(LANDMARKS.plaza);
    else if (G.state === 'wasted') respawn(LANDMARKS.hospital);
    else if (G.state === 'complete') G.setState('playing');
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.cam.viewW = w;
  G.cam.viewH = h;
}

function render() {
  const viewW = G.cam.viewW;
  const viewH = G.cam.viewH;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(0, 0, viewW, viewH);
  const shX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(viewW / 2 - G.cam.x + shX, viewH / 2 - G.cam.y + shY);
  drawWorld(ctx, G, G.cam);
  ctx.restore();
  if (G.state === 'title') drawTitle(ctx, G, viewW, viewH);
  else if (G.state === 'paused') { drawHud(ctx, G, viewW, viewH); drawPause(ctx, G, viewW, viewH); }
  else if (G.state === 'busted') drawBusted(ctx, G, viewW, viewH);
  else if (G.state === 'wasted') drawWasted(ctx, G, viewW, viewH);
  else if (G.state === 'complete') drawComplete(ctx, G, viewW, viewH);
  else drawHud(ctx, G, viewW, viewH); // playing and frozen
}

function init() {
  G.city = buildCity(20261123);
  G.player = makePlayer(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
  G.missions = createMissions(G);
  spawnTraffic(G, 26);
  spawnParked(G, 30);
  spawnPeds(G, 64);
  // Two cars parked right outside the safehouse, so the first job never
  // starts with a long hunt for wheels.
  parkCar(G, LANDMARKS.safehouse.x - 43, LANDMARKS.safehouse.y - 130, -Math.PI / 2, '#c0392b');
  parkCar(G, LANDMARKS.safehouse.x + 43, LANDMARKS.safehouse.y + 150, Math.PI / 2, '#2980b9');
  if (G.loadedSave && G.loadedSave.muted) {
    G.muted = true;
    G.audio.setMuted(true);
  }
  // Staged screenshot scenes render a frozen frame of the live game.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    const ticks = stageShot(G, shot);
    const fixedDt = 1 / 60;
    for (let i = 0; i < ticks; i++) {
      G.time += fixedDt;
      updatePlaying(fixedDt, {
        down: () => false, wasPressed: () => false, mouse: { down: false, x: 0, y: 0 },
      });
      if (G.state !== 'playing') break;
    }
    G.frozen = true;
    G.time = 1.2;
    return;
  }
  if (G.loadedSave) G.menuIndex = 0;
}

const input = createInput(canvas);
window.addEventListener('resize', resize);
resize();
init();

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (!G.frozen) {
    G.time += dt;
    const viewW = G.cam.viewW;
    const viewH = G.cam.viewH;
    if (G.state === 'playing') updatePlaying(dt, input);
    else if (G.state === 'title') updateTitle(dt, input, viewW, viewH);
    else if (G.state === 'paused') updatePause(dt, input, viewW, viewH);
    else if (G.state === 'busted' || G.state === 'wasted' || G.state === 'complete') updateEndScreen(input);
    input.endFrame();
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
