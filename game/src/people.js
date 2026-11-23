// Port Aurora — people: the player on foot, pedestrians, foot cops, and the
// shooting between them. One job: who walks, who runs, who shoots, who falls.
import {
  WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, PLAYER_HEALTH, PISTOL_DAMAGE,
  PISTOL_RATE, PISTOL_RANGE, BULLET_SPEED, COP_DAMAGE, BUST_SECONDS,
  PED_COUNT, PALETTE,
} from './config.js';
import { clamp, dist2 } from './random.js';
import { resolveCircle, sidewalkPoint, nearestRoadCoord, crossingAhead } from './city.js';
import { nearestCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, health: PLAYER_HEALTH, onFoot: true, car: null,
    ammo: 12, fireCd: 0, reloadT: 0, bustProgress: 0, runT: 0,
  };
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(G.rng);
    G.peds.push(makePed(G, p.x, p.y, 'civilian'));
  }
}

export function makePed(G, x, y, kind) {
  const axis = G.rng.chance(0.5) ? 'h' : 'v';
  return {
    kind, x, y,
    angle: G.rng.next() * Math.PI * 2,
    speed: kind === 'cop' ? 300 : G.rng.range(55, 95),
    state: 'walk',
    axis,
    line: axis === 'h' ? y : x,
    dir: G.rng.chance(0.5) ? 1 : -1,
    color: kind === 'cop' ? '#1c2733' : G.rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#fd79a8']),
    fleeT: 0,
    downT: 0,
    shootCd: G.rng.range(0.5, 1.4),
    lastTurnKey: '',
  };
}

export function spawnFootCop(G, x, y) {
  const cop = makePed(G, x, y, 'cop');
  cop.state = 'chase';
  G.peds.push(cop);
  return cop;
}

function pedFlee(G, ped, tx, ty) {
  ped.state = 'flee';
  ped.fleeT = 1.6;
  ped.fleeX = tx;
  ped.fleeY = ty;
}

// A gunshot or a speeding car nearby scares pedestrians.
export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.kind !== 'civilian' || ped.state === 'down') continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) pedFlee(G, ped, x, y);
  }
}

function updatePedWalk(G, ped, dt) {
  // Stroll along a sidewalk; at an intersection, sometimes turn a corner.
  const step = ped.speed * ped.dir * dt;
  if (ped.axis === 'h') ped.x += step;
  else ped.y += step;
  ped.angle = ped.axis === 'h' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  if (crossingAhead(ped.x, ped.y, ped.axis)) {
    const cross = crossingAhead(ped.x, ped.y, ped.axis);
    const key = `${cross.cx},${cross.cy}`;
    if (key !== ped.lastTurnKey) {
      ped.lastTurnKey = key;
      if (G.rng.chance(0.35)) {
        ped.axis = ped.axis === 'h' ? 'v' : 'h';
        ped.dir = G.rng.chance(0.5) ? 1 : -1;
        if (ped.axis === 'h') ped.y = nearestRoadCoord(ped.y).coord + (G.rng.chance(0.5) ? 43 : -43);
        else ped.x = nearestRoadCoord(ped.x).coord + (G.rng.chance(0.5) ? 43 : -43);
      }
    }
  }
  const solved = resolveCircle(G.city, ped.x, ped.y, 11);
  ped.x = solved.x;
  ped.y = solved.y;
}

function updatePedFlee(G, ped, dt) {
  ped.fleeT -= dt;
  const dx = ped.x - ped.fleeX;
  const dy = ped.y - ped.fleeY;
  const d = Math.hypot(dx, dy) || 1;
  ped.angle = Math.atan2(dy, dx);
  const speed = ped.speed * 2.6;
  const nx = ped.x + (dx / d) * speed * dt;
  const ny = ped.y + (dy / d) * speed * dt;
  const solved = resolveCircle(G.city, nx, ny, 11);
  ped.x = solved.x;
  ped.y = solved.y;
  if (ped.fleeT <= 0) ped.state = 'walk';
}

function updateFootCop(G, cop, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dx = tx - cop.x;
  const dy = ty - cop.y;
  const d = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  if (d > 34) {
    cop.x += (dx / d) * cop.speed * dt;
    cop.y += (dy / d) * cop.speed * dt;
    const solved = resolveCircle(G.city, cop.x, cop.y, 11);
    cop.x = solved.x;
    cop.y = solved.y;
  }
  // Shoot at the player from range; grab them up close.
  cop.shootCd -= dt;
  if (d < 380 && cop.shootCd <= 0 && !p.car) {
    cop.shootCd = 1.15;
    fireBullet(G, cop.x, cop.y, Math.atan2(p.y - cop.y, p.x - cop.x), 'cop');
    G.audio.gunshot();
  }
  if (d < 30 && p.onFoot) {
    p.bustProgress += dt * 2.2;
    G.toastOnce('bust', 'The police are grabbing you — RUN!');
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      continue;
    }
    if (ped.kind === 'cop') { updateFootCop(G, ped, dt); continue; }
    if (ped.state === 'flee') updatePedWalkFlee(G, ped, dt);
    else updatePedWalk(G, ped, dt);
  }
  // The fallen fade away and are replaced, so the streets stay alive.
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.state === 'down' && ped.downT <= 0) {
      G.peds.splice(i, 1);
      if (ped.kind === 'civilian') {
        const p = sidewalkPoint(G.rng);
        G.peds.push(makePed(G, p.x, p.y, 'civilian'));
      }
    }
  }
}

function updatePedWalkFlee(G, ped, dt) {
  updatePedFlee(G, ped, dt);
}

export function fireBullet(G, x, y, angle, from) {
  G.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: PISTOL_RANGE / BULLET_SPEED,
    from,
  });
}

function hitBuilding(G, x, y) {
  for (const b of G.city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || hitBuilding(G, b.x, b.y);
    if (!dead) {
      if (b.from === 'player') {
        for (const ped of G.peds) {
          if (ped.state === 'down') continue;
          if (dist2(b.x, b.y, ped.x, ped.y) < 15 * 15) {
            dead = true;
            if (ped.kind === 'cop') {
              ped.state = 'down';
              ped.downT = 5;
              G.addWanted(1, 'Officer down');
              G.toast('Officer down! Wanted +1');
            } else {
              ped.state = 'down';
              ped.downT = 6;
              G.addWanted(1, 'Pedestrian hit');
              G.toast('Pedestrian hit! Wanted +1');
            }
            G.addBlood(ped.x, ped.y);
            break;
          }
        }
        if (!dead) {
          for (const car of G.cars) {
            if (car.disabled) continue;
            if (dist2(b.x, b.y, car.x, car.y) < 26 * 26) {
              dead = true;
              G.damageCar(car, PISTOL_DAMAGE);
              G.addSparks(b.x, b.y, 5);
              break;
            }
          }
        }
      } else {
        const p = G.player;
        if (p.onFoot && dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
          dead = true;
          damagePlayer(G, COP_DAMAGE);
        }
      }
    }
    if (dead) {
      G.addSparks(b.x, b.y, 2);
      G.bullets.splice(i, 1);
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invulnT > 0) return;
  p.health -= amount;
  p.invulnT = 0.35;
  G.flashRed = 0.5;
  G.shake = Math.max(G.shake, 4);
  if (p.health <= 0) {
    p.health = 0;
    G.setState('wasted');
  }
}

// On-foot movement, stealing cars, aiming and shooting.
export function updatePlayerOnFoot(G, input, dt, cam) {
  const p = G.player;
  p.fireCd -= dt;
  p.reloadT -= dt;
  p.invulnT -= dt;
  const run = input.down('shift');
  const speed = run ? RUN_SPEED : WALK_SPEED;
  let mx = 0;
  let my = 0;
  if (input.down('w', 'arrowup')) my -= 1;
  if (input.down('s', 'arrowdown')) my += 1;
  if (input.down('a', 'arrowleft')) mx -= 1;
  if (input.down('d', 'arrowright')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const solved = resolveCircle(G.city, nx, ny, PLAYER_RADIUS);
    p.x = solved.x;
    p.y = solved.y;
    p.angle = Math.atan2(my, mx);
    p.runT += dt;
  }
  // Aim at the mouse (screen space to world space through the camera).
  const wx = cam.x + (input.mouse.x - cam.viewW / 2);
  const wy = cam.y + (input.mouse.y - cam.viewH / 2);
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);

  // Enter or steal the nearest car.
  if (input.wasPressed('e')) {
    const car = nearestCar(G, p.x, p.y, 80, ['parked', 'traffic', 'police']);
    if (car) stealCar(G, car);
    else G.toastOnce('nocar', 'No car close enough — walk up to one and press E');
  }
  // Reload.
  if (input.wasPressed('r') && p.ammo < 12 && p.reloadT <= 0) {
    p.reloadT = 0.9;
    p.ammo = 12;
    G.audio.click();
  }
  // Shoot: hold the mouse to fire at the aim point.
  if (input.mouse.down && p.fireCd <= 0 && p.reloadT <= 0 && p.ammo > 0) {
    p.fireCd = PISTOL_RATE;
    p.ammo -= 1;
    fireBullet(G, p.x + Math.cos(p.aimAngle) * 18, p.y + Math.sin(p.aimAngle) * 18, p.aimAngle, 'player');
    G.audio.gunshot();
    G.addMuzzle(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22);
    scarePeds(G, p.x, p.y, 320);
    if (G.wanted === 0) G.addWanted(1, 'Shots fired');
    G.shake = Math.max(G.shake, 2);
  }
  if (input.wasPressed('h')) G.audio.horn();
  // Traffic that runs the player over hurts.
  for (const car of G.cars) {
    if (car.disabled || car.kind === 'parked') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 30 && Math.abs(car.speed) > 120) {
      damagePlayer(G, 12);
      const push = Math.atan2(p.y - car.y, p.x - car.x);
      p.x += Math.cos(push) * 26;
      p.y += Math.sin(push) * 26;
      G.audio.crash();
    }
  }
  // A police cruiser parked on top of the player busts them.
  let busting = false;
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.disabled) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 56 && Math.abs(car.speed) < 90) busting = true;
  }
  if (busting) {
    p.bustProgress += dt;
    G.toastOnce('bust', 'The police are grabbing you — RUN!');
  } else {
    p.bustProgress = Math.max(0, p.bustProgress - dt * 1.5);
  }
  if (p.bustProgress >= BUST_SECONDS) G.setState('busted');
}

export function stealCar(G, car) {
  const p = G.player;
  const wasTraffic = car.kind === 'traffic';
  const wasPolice = car.kind === 'police';
  car.kind = 'player';
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  G.stats.carsStolen++;
  G.audio.pickup();
  if (wasTraffic) {
    G.addWanted(1, 'Car stolen');
    G.toast('Car stolen! Wanted +1');
  } else if (wasPolice) {
    G.addWanted(2, 'Police car stolen');
    G.toast('You stole a cop car! Wanted +2');
  } else {
    G.toast('Got a ride. Drive safe... or not.');
  }
  G.missions.onEnterCar();
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.kind = 'parked';
  car.speed = 0;
  const side = Math.cos(car.angle + Math.PI / 2) * 34;
  const sideY = Math.sin(car.angle + Math.PI / 2) * 34;
  const solved = resolveCircle(G.city, car.x + side, car.y + sideY, PLAYER_RADIUS);
  p.x = solved.x;
  p.y = solved.y;
  p.car = null;
  p.onFoot = true;
}
