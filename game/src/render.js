// Port Aurora — drawing the world: streets, buildings, cars, people, effects.
// One job: turn the game state into a picture. Nothing here changes state.
import {
  WORLD, ROAD_CENTERS, ROAD_WIDTH, WATER_X, BEACH_X, PALETTE,
  CAR_LENGTH, CAR_WIDTH,
} from './config.js';
import { isWater } from './city.js';
import { LANDMARKS } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, G, view) {
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Subtle mowing stripes for texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 240;
  const startStripe = Math.floor(view.y0 / stripe) * stripe;
  for (let y = startStripe; y < view.y1; y += stripe * 2) {
    ctx.fillRect(view.x0, y, view.x1 - view.x0, stripe);
  }
  // Beach, then the harbour water with slow waves.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(view.x0, BEACH_X), view.y0, view.x1 - Math.max(view.x0, BEACH_X), view.y1 - view.y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(view.x0, WATER_X), view.y0, view.x1 - Math.max(view.x0, WATER_X), view.y1 - view.y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const t = G.time;
  for (let y = Math.floor(view.y0 / 90) * 90; y < view.y1; y += 90) {
    ctx.beginPath();
    for (let x = Math.max(view.x0, WATER_X + 6); x < view.x1; x += 40) {
      const wob = Math.sin((x + t * 40) / 130 + y) * 5;
      if (x === Math.max(view.x0, WATER_X + 6)) ctx.moveTo(x, y + wob);
      else ctx.lineTo(x, y + wob);
    }
    ctx.stroke();
  }
  // The pier.
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(6080, 3330, 430, 26);
  ctx.fillStyle = '#6f5840';
  for (let x = 6120; x < 6480; x += 60) ctx.fillRect(x, 3326, 8, 34);
}

function drawRoads(ctx, G, view) {
  const half = ROAD_WIDTH / 2;
  for (const c of ROAD_CENTERS) {
    // Sidewalk, then asphalt.
    ctx.fillStyle = PALETTE.sidewalk;
    if (c - half >= view.x0 - 10 && c - half <= view.x1 + 10) ctx.fillRect(c - half, view.y0, ROAD_WIDTH, view.y1 - view.y0);
    if (c - half >= view.y0 - 10 && c - half <= view.y1 + 10) ctx.fillRect(view.x0, c - half, view.x1 - view.x0, ROAD_WIDTH);
    ctx.fillStyle = PALETTE.road;
    if (c - half + 14 >= view.x0 - 10 && c - half + 14 <= view.x1 + 10) ctx.fillRect(c - half + 14, view.y0, ROAD_WIDTH - 28, view.y1 - view.y0);
    if (c - half + 14 >= view.y0 - 10 && c - half + 14 <= view.y1 + 10) ctx.fillRect(view.x0, c - half + 14, view.x1 - view.x0, ROAD_WIDTH - 28);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const c of ROAD_CENTERS) {
    for (let v = Math.floor(view.y0 / 64) * 64; v < view.y1; v += 64) {
      if (c >= view.x0 - 4 && c <= view.x1 + 4) ctx.fillRect(c - 2, v, 4, 30);
    }
    for (let v = Math.floor(view.x0 / 64) * 64; v < view.x1; v += 64) {
      if (c >= view.y0 - 4 && c <= view.y1 + 4) ctx.fillRect(v, c - 2, 30, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      if (cx < view.x0 - 80 || cx > view.x1 + 80 || cy < view.y0 - 80 || cy > view.y1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 12 - 4, cy - half + 16, 8, 16);
        ctx.fillRect(cx + i * 12 - 4, cy + half - 32, 8, 16);
        ctx.fillRect(cx - half + 16, cy + i * 12 - 4, 16, 8);
        ctx.fillRect(cx + half - 32, cy + i * 12 - 4, 16, 8);
      }
    }
  }
}

function drawParks(ctx, G, view) {
  for (const park of G.city.parks) {
    if (park.x > view.x1 || park.x + park.w < view.x0 || park.y > view.y1 || park.y + park.h < view.y0) continue;
    ctx.fillStyle = park.kind === 'park' ? PALETTE.park : PALETTE.plaza;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.kind === 'park') {
      ctx.fillStyle = PALETTE.parkDark;
      ctx.beginPath();
      ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, park.w * 0.28, park.h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const tree of G.city.trees) {
    if (tree.x < view.x0 - 20 || tree.x > view.x1 + 20 || tree.y < view.y0 - 20 || tree.y > view.y1 + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(tree.x + 4, tree.y + 5, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tree.palm ? '#4f9e44' : PALETTE.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tree.palm ? '#67b95a' : PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, G, view) {
  // South-most first, so a tall building's shaded side overlaps the one
  // behind it instead of the other way round.
  const list = G.city.buildings
    .filter((b) => b.x + b.w > view.x0 && b.x < view.x1 && b.y + b.h > view.y0 && b.y < view.y1)
    .sort((a, b) => a.y - b.y);
  for (const b of list) {
    const h = b.height;
    // Ground shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(b.x + 6, b.y + h + 4, b.w, b.h);
    // Shaded sides for a hint of height.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x, b.y + h, b.w, b.h);
    ctx.fillRect(b.x + b.w, b.y + h, h * 0.7, b.h);
    // Roof.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof furniture: vents and a lit skylight or two.
    const seed = b.seed;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 10 + (seed % 30), b.y + 12, 16, 12);
    ctx.fillRect(b.x + b.w - 30 - (seed % 20), b.y + b.h - 26, 14, 10);
    ctx.fillStyle = PALETTE.windowLit;
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 6, 16, 12);
  }
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.kind === 'police' ? PALETTE.policeWhite : car.color;
  roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.kind === 'police') {
    ctx.fillStyle = PALETTE.policeBlack;
    ctx.fillRect(-6, -CAR_WIDTH / 2, 14, CAR_WIDTH);
    // Flashing light bar.
    const phase = Math.floor(time * 4 + car.siren) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-4, -CAR_WIDTH / 2 - 2, 8, 5);
    ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-4, CAR_WIDTH / 2 - 3, 8, 5);
  }
  // Windshield, roof, rear window.
  ctx.fillStyle = 'rgba(20, 30, 44, 0.85)';
  ctx.fillRect(6, -CAR_WIDTH / 2 + 3, 10, CAR_WIDTH - 6);
  ctx.fillStyle = car.kind === 'police' ? PALETTE.policeWhite : car.color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-8, -CAR_WIDTH / 2 + 3, 12, CAR_WIDTH - 6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(20, 30, 44, 0.85)';
  ctx.fillRect(-CAR_LENGTH / 2 + 2, -CAR_WIDTH / 2 + 3, 7, CAR_WIDTH - 6);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff7c0';
  ctx.fillRect(CAR_LENGTH / 2 - 2, -CAR_WIDTH / 2 + 2, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 2, CAR_WIDTH / 2 - 7, 3, 5);
  ctx.fillStyle = car.brake ? '#ff3b30' : '#a33';
  ctx.fillRect(-CAR_LENGTH / 2 - 1, -CAR_WIDTH / 2 + 2, 3, 5);
  ctx.fillRect(-CAR_LENGTH / 2 - 1, CAR_WIDTH / 2 - 7, 3, 5);
  ctx.restore();
  // Smoke from a wrecked car.
  if (car.smoke > 0.25) {
    ctx.fillStyle = `rgba(60,60,60,${0.25 + car.smoke * 0.4})`;
    ctx.beginPath();
    ctx.arc(car.x + Math.sin(time * 3 + car.x) * 4, car.y - 8, 6 + car.smoke * 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPed(ctx, ped, time) {
  if (ped.state === 'down') {
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, ped.downT / 6);
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = ped.state === 'walk' ? Math.sin(time * 9 + ped.x) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.kind === 'cop') {
    ctx.fillStyle = '#dfe6ee';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', ped.x, ped.y - 13);
  }
}

function drawPlayer(ctx, G, time) {
  const p = G.player;
  if (!p.onFoot || G.state === 'title') return;
  // Gold ring so the eye finds the player at a glance.
  ctx.strokeStyle = PALETTE.playerRing;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.runT > 0 ? Math.sin(time * 12) * 1.5 : 0;
  ctx.fillStyle = '#1f8a4c';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.aimAngle || p.angle) * 3, p.y + Math.sin(p.aimAngle || p.angle) * 3, 6, 0, Math.PI * 2);
  ctx.fill();
  // The pistol points where the mouse aims.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aimAngle || 0) * 8, p.y + Math.sin(p.aimAngle || 0) * 8);
  ctx.lineTo(p.x + Math.cos(p.aimAngle || 0) * 20, p.y + Math.sin(p.aimAngle || 0) * 20);
  ctx.stroke();
}

function drawBulletsAndParticles(ctx, G) {
  for (const b of G.bullets) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissionBeacon(ctx, G, time) {
  const target = G.missions.target();
  if (!target) return;
  const pulse = 0.5 + Math.sin(time * 4) * 0.5;
  // A column of light and a pulsing ring mark the objective.
  const grad = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
  grad.addColorStop(0, 'rgba(255, 201, 60, 0)');
  grad.addColorStop(1, 'rgba(255, 201, 60, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 14, target.y - 260, 28, 260);
  ctx.strokeStyle = `rgba(255, 201, 60, ${0.55 + pulse * 0.45})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.r * (0.7 + pulse * 0.3), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▼', target.x, target.y - target.r - 8);
}

function drawLandmarkLabels(ctx, G, view) {
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (lm.x < view.x0 - 100 || lm.x > view.x1 + 100 || lm.y < view.y0 - 100 || lm.y > view.y1 + 100) continue;
    ctx.fillStyle = 'rgba(12,16,24,0.55)';
    const w = ctx.measureText(lm.name).width + 12;
    ctx.fillRect(lm.x - w / 2, lm.y - 44, w, 18);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillText(lm.name, lm.x, lm.y - 31);
  }
}

export function drawWorld(ctx, G, cam) {
  const view = {
    x0: cam.x - cam.viewW / 2 - 60,
    y0: cam.y - cam.viewH / 2 - 60,
    x1: cam.x + cam.viewW / 2 + 60,
    y1: cam.y + cam.viewH / 2 + 60,
  };
  drawGround(ctx, G, view);
  drawRoads(ctx, G, view);
  drawParks(ctx, G, view);
  drawBuildings(ctx, G, view);
  drawMissionBeacon(ctx, G, G.time);
  drawLandmarkLabels(ctx, G, view);
  // Cars, southernmost first so nearer cars overlap farther ones.
  const cars = G.cars
    .filter((c) => c.x > view.x0 && c.x < view.x1 && c.y > view.y0 && c.y < view.y1)
    .sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(ctx, car, G.time);
  if (G.player.car) {
    ctx.strokeStyle = PALETTE.playerRing;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(G.player.car.x, G.player.car.y, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  const peds = G.peds.filter((p) => p.x > view.x0 && p.x < view.x1 && p.y > view.y0 && p.y < view.y1);
  for (const ped of peds) drawPed(ctx, ped, G.time);
  drawPlayer(ctx, G, G.time);
  drawBulletsAndParticles(ctx, G);
  void isWater;
}
