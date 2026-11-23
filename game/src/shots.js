// Port Aurora — staged scenes for the screenshots.
// One job: put the game into a fixed, photogenic state for `?shot=<name>&seed=<n>`
// so every screenshot is a real render of the game's own code, reproducible
// from the same URL. Normal play (no query) never touches this file.
import { makeCar } from './vehicles.js';
import { LANDMARKS } from './city.js';

function putPlayerInCar(G, x, y, angle, speed, color) {
  const car = makeCar('player', x, y, angle, color || '#1abc9c');
  car.speed = speed;
  G.cars.push(car);
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = x;
  G.player.y = y;
  return car;
}

function putPoliceChase(G, x, roadY, count) {
  // Cruisers on the same road, in the lanes, closing in from behind.
  for (let i = 0; i < count; i++) {
    const behind = 130 + i * 95;
    const lane = (i % 2 === 0 ? 19 : -19);
    const car = makeCar('police', x - behind, roadY + lane, 0, '#f2f4f6');
    car.speed = 420 + i * 30;
    G.cars.push(car);
  }
}

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'start') {
    // Title screen over Downtown: the camera sits still for a stable frame.
    G.setState('title');
    G.menuIndex = 0;
    G.menuView = null;
    G.cam.x = 3360;
    G.cam.y = 2240;
    G.titleCamFixed = true;
    return 0; // no simulation ticks: the title is a still frame
  }
  if (name === 'drive') {
    // Mid-city drive with a delivery on the clock: traffic, minimap, timer.
    // Staged on a road centre (y=2520) so the car is on asphalt, not in a block.
    G.setState('playing');
    putPlayerInCar(G, 3640, 2520, 0, 600, '#e67e22');
    G.missions.start(1);
    G.missions.stepIndex = 1;
    G.missions.beginStep();
    G.missions.timer = 74;
    G.cash = 1250;
    G.cam.x = p.x;
    G.cam.y = p.y;
    return 45;
  }
  if (name === 'chase') {
    // Three stars, four cruisers on the tail, losing them is the job.
    // Staged on a road centre (y=3080); the cruisers ride the same road.
    G.setState('playing');
    putPlayerInCar(G, 3640, 3080, 0, 640, '#ffd94a');
    G.player.car.sports = true;
    G.setWanted(3);
    putPoliceChase(G, 3640, 3080, 4);
    G.missions.start(3);
    G.cash = 2400;
    G.cam.x = p.x;
    G.cam.y = p.y;
    return 45;
  }
  if (name === 'mission') {
    // The Exchange: Mara rides along, the plaza beacon ahead, the clock running.
    // Staged on a road centre (y=3080), heading west toward Founders Plaza.
    G.setState('playing');
    putPlayerInCar(G, 5600, 3080, Math.PI, 560, '#2980b9');
    G.missions.start(4);
    G.missions.stepIndex = 1;
    G.missions.beginStep();
    G.missions.timer = 96;
    G.cash = 3900;
    G.cam.x = p.x;
    G.cam.y = p.y;
    return 45;
  }
  return 0;
}
