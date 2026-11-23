// Port Aurora — every car: traffic, parked cars, police cruisers, and the car
// the player drives. One job: how cars move, chase, crash and get stolen.
import {
  CAR_LENGTH, CAR_WIDTH, CAR_MAX_SPEED, CAR_ACCEL, CAR_REVERSE_MAX,
  CAR_BRAKE, CAR_TURN, PALETTE, ROAD_CENTERS, WORLD,
} from './config.js';
import { clamp, angleDiff, dist2 } from './random.js';
import { roadSpawn, sidewalkPoint, resolveCircle, nearestRoadCoord, crossingAhead } from './city.js';

const CAR_RADIUS = 24;

export function makeCar(kind, x, y, angle, color) {
  return {
    kind, x, y, angle, color,
    speed: 0,
    targetSpeed: 0,
    hp: kind === 'police' ? 130 : 100,
    disabled: false,
    sports: false,
    siren: Math.random() * 10,
    lastTurnKey: '',
    brake: false,
    smoke: 0,
  };
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const axis = G.rng.chance(0.5) ? 'h' : 'v';
    const s = roadSpawn(G.rng, axis);
    const car = makeCar('traffic', s.x, s.y, s.angle, G.rng.pick(PALETTE.carColors));
    car.axis = axis;
    car.line = axis === 'h' ? s.y - (s.y % 1) : s.x;
    car.lane = axis === 'h' ? s.y - nearestRoadCoord(s.y).coord : s.x - nearestRoadCoord(s.x).coord;
    car.targetSpeed = G.rng.range(140, 225);
    car.speed = car.targetSpeed;
    G.cars.push(car);
  }
}

export function spawnParked(G, count) {
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(G.rng);
    const angle = G.rng.chance(0.5) ? 0 : Math.PI / 2;
    const car = makeCar('parked', p.x, p.y, angle + (G.rng.chance(0.5) ? 0 : Math.PI), G.rng.pick(PALETTE.carColors));
    G.cars.push(car);
  }
}

// The gold sports car mission 3 asks the player to steal.
export function spawnSportsCar(G, x, y) {
  const car = makeCar('parked', x, y, Math.PI / 2, '#ffd94a');
  car.sports = true;
  car.hp = 160;
  G.cars.push(car);
  return car;
}

// Park one car at an exact spot, facing along the road — used for the cars
// waiting outside the safehouse, so the first job never starts with a hunt.
export function parkCar(G, x, y, angle, color) {
  const car = makeCar('parked', x, y, angle, color);
  G.cars.push(car);
  return car;
}

export function spawnPolice(G, nearX, nearY) {
  // Appear on a road at the edge of the player's view, never on top of them.
  for (let tries = 0; tries < 12; tries++) {
    const axis = G.rng.chance(0.5) ? 'h' : 'v';
    const s = roadSpawn(G.rng, axis);
    const d2 = dist2(s.x, s.y, nearX, nearY);
    if (d2 > 500 * 500 && d2 < 1400 * 1400) {
      const car = makeCar('police', s.x, s.y, s.angle, PALETTE.policeWhite);
      car.targetSpeed = 300;
      G.cars.push(car);
      return car;
    }
  }
  return null;
}

function carAhead(G, car, range) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = null;
  let bestD = range;
  for (const other of G.cars) {
    if (other === car || other.disabled) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 10 || along > bestD) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 34) { best = other; bestD = along; }
  }
  return best;
}

function turnTrafficCar(G, car, cx, cy) {
  // At an intersection: mostly straight, sometimes left or right.
  const roll = G.rng.next();
  let newAngle = car.angle;
  if (roll > 0.62) newAngle = car.angle + Math.PI / 2;
  else if (roll > 0.8) newAngle = car.angle - Math.PI / 2;
  newAngle = ((newAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  if (newAngle === car.angle) return;
  // Snap onto the correct lane of the new road; the coordinate along the new
  // direction stays where the car already is.
  if (newAngle === Math.PI / 2) car.x = cx + 19;
  else if (newAngle === -Math.PI / 2) car.x = cx - 19;
  else if (newAngle === 0) car.y = cy + 19;
  else car.y = cy - 19;
  car.angle = newAngle;
  car.axis = (newAngle === 0 || Math.abs(newAngle) === Math.PI) ? 'h' : 'v';
}

function updateTrafficCar(G, car, dt) {
  if (car.disabled) return;
  const ahead = carAhead(G, car, 90);
  let want = car.targetSpeed;
  if (ahead) want = ahead.speed < 20 ? 0 : Math.min(want, ahead.speed * 0.7);
  // Gentle stop for a pedestrian crossing right in front.
  for (const p of G.peds) {
    if (p.state === 'down') continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 46 && side < 26) { want = 0; break; }
  }
  car.brake = want < car.speed - 30;
  car.speed += clamp(want - car.speed, -CAR_BRAKE * dt, CAR_ACCEL * 0.6 * dt);
  if (car.speed < 0.5) car.speed = 0;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the city edge instead of driving into the water.
  if (car.x < 120 || car.x > WORLD - 120 || car.y < 120 || car.y > WORLD - 120) {
    car.angle += Math.PI;
    car.x = clamp(car.x, 140, WORLD - 140);
    car.y = clamp(car.y, 140, WORLD - 140);
  }
  const cross = crossingAhead(car.x, car.y, car.axis);
  if (cross) {
    const key = `${cross.cx},${cross.cy}`;
    if (key !== car.lastTurnKey) {
      car.lastTurnKey = key;
      turnTrafficCar(G, car, cross.cx, cross.cy);
    }
  }
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const d = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, wantAngle);
  const turnRate = 3.4;
  car.angle += clamp(diff, -turnRate * dt, turnRate * dt);
  const wantSpeed = Math.min(680, (p.car ? Math.abs(p.car.speed) : 0) + 90 + G.wanted * 18);
  car.speed += clamp(wantSpeed - car.speed, -CAR_BRAKE * dt, 520 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren += dt;
  const solved = resolveCircle(G.city, car.x, car.y, CAR_RADIUS);
  if (solved.hit) {
    car.x = solved.x;
    car.y = solved.y;
    car.speed *= 0.5;
    if (car.speed > 200) {
      damageCar(G, car, 12);
      G.audio.crash();
    }
  }
  // Ramming the player's car slows them both and sparks a crash.
  if (p.car && d < CAR_RADIUS + 26) {
    p.car.speed *= 0.86;
    car.speed *= 0.9;
    damageCar(G, p.car, 6);
    if (Math.random() < 0.3) G.audio.crash();
    G.addSparks((car.x + p.car.x) / 2, (car.y + p.car.y) / 2, 4);
  }
}

export function damageCar(G, car, amount) {
  if (car.disabled) return;
  car.hp -= amount;
  car.smoke = Math.min(1, car.smoke + 0.25);
  if (car.hp <= 0) {
    car.disabled = true;
    car.speed = 0;
    car.smoke = 1;
    G.addSmoke(car.x, car.y, 10);
    if (car.kind === 'police') {
      G.addWanted(1, 'Cop car wrecked');
      G.audio.crash();
    }
  }
}

// Arcade driving for the player's car: accelerate, steer, handbrake slide.
export function updatePlayerCar(G, car, input, dt) {
  const fwd = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');
  const handbrake = input.down(' ');
  const dir = car.speed >= 0 ? 1 : -1;
  if (fwd) car.speed += CAR_ACCEL * dt;
  if (back) {
    if (car.speed > 20) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.55 * dt;
  }
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 160 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 500 * dt;
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
  if (Math.abs(car.speed) < 4 && !fwd && !back) car.speed = 0;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = handbrake ? 1.7 : 1;
  const authority = clamp(Math.abs(car.speed) / 220, 0.3, 1);
  car.angle += steer * CAR_TURN * grip * authority * dir * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const solved = resolveCircle(G.city, nx, ny, CAR_RADIUS);
  if (solved.hit) {
    if (Math.abs(car.speed) > 260) {
      G.audio.crash();
      damageCar(G, car, 10);
      G.addSparks(nx, ny, 8);
      G.shake = Math.min(10, Math.abs(car.speed) / 60);
    }
    car.speed *= 0.45;
  }
  car.x = solved.x;
  car.y = solved.y;
  car.brake = back || handbrake;
  if (car.smoke > 0 && Math.random() < car.smoke * 0.5) G.addSmoke(car.x, car.y, 1);
}

// Simple circle push-apart between cars that are not the player's.
export function separateCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.disabled && b.disabled) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = CAR_RADIUS * 2 - 6;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (a.kind !== 'player') { a.x -= ux * push; a.y -= uy * push; }
        if (b.kind !== 'player') { b.x += ux * push; b.y += uy * push; }
      }
    }
  }
}

export function updateCars(G, dt) {
  for (const car of G.cars) {
    if (car.kind === 'traffic') updateTrafficCar(G, car, dt);
    else if (car.kind === 'police') updatePoliceCar(G, car, dt);
  }
  separateCars(G);
  // Disabled wrecks fade out after a while so the streets stay clear.
  for (const car of G.cars) {
    if (car.disabled) car.smoke = Math.max(0, car.smoke - dt * 0.05);
  }
}

export function nearestCar(G, x, y, maxDist, kinds) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    if (car.disabled) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function policeCount(G) {
  let n = 0;
  for (const car of G.cars) if (car.kind === 'police' && !car.disabled) n++;
  return n;
}

export function nearestPoliceDist(G, x, y) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.disabled) continue;
    best = Math.min(best, Math.hypot(car.x - x, car.y - y));
  }
  return best;
}
