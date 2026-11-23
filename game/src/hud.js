// Port Aurora — everything drawn on top of the world: the HUD, the minimap,
// toasts, and the menu screens. One job: what the player reads, not what
// the player does.
import {
  WORLD, ROAD_CENTERS, ROAD_WIDTH, WATER_X, PALETTE, MAX_WANTED, CAR_MAX_SPEED,
} from './config.js';
import { districtAt } from './config.js';
import { LANDMARKS } from './city.js';
import { MISSIONS } from './missions.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawWantedStars(ctx, G, x, y) {
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < MAX_WANTED; i++) {
    ctx.fillStyle = i < G.wanted ? PALETTE.starOn : PALETTE.starOff;
    ctx.fillText('★', x + i * 30, y);
  }
  if (G.wanted > 0) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('WANTED', x, y + 24);
  }
}

function drawCashHealth(ctx, G, x, y) {
  panel(ctx, x, y, 220, 58);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${Math.round(G.cash).toLocaleString('en-US')}`, x + 14, y + 17);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px sans-serif';
  ctx.fillText(districtAt(G.player.x, G.player.y), x + 14, y + 42);
  // Health bar.
  const hw = 120;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x + 86, y + 40, hw, 10);
  ctx.fillStyle = G.player.health > 35 ? PALETTE.healthGood : PALETTE.healthLow;
  ctx.fillRect(x + 86, y + 40, hw * (G.player.health / 100), 10);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${Math.ceil(G.player.health)}`, x + 86 + hw + 8, y + 45);
}

function drawMissionCard(ctx, G, x, y) {
  const m = G.missions;
  if (!m.def) return;
  const step = m.current();
  panel(ctx, x, y, 300, 86);
  ctx.fillStyle = PALETTE.missionGold;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`JOB ${G.missionIndex + 1}/${MISSIONS.length} — ${m.def.title}`, x + 12, y + 16);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px sans-serif';
  ctx.fillText(step ? step.label : '', x + 12, y + 38);
  // Timer or progress bar for the active step.
  if (step && (step.t === 'deliver' || step.t === 'escape')) {
    const total = step.seconds || 1;
    const frac = Math.max(0, m.timer / total);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 12, y + 56, 276, 10);
    ctx.fillStyle = frac > 0.3 ? PALETTE.missionGold : '#ff5a4d';
    ctx.fillRect(x + 12, y + 56, 276 * frac, 10);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.ceil(m.timer)}s`, x + 12, y + 76);
  } else if (step && (step.t === 'loseCops' || step.t === 'hold')) {
    const frac = Math.min(1, m.stepT / (step.seconds || 1));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 12, y + 56, 276, 10);
    ctx.fillStyle = PALETTE.missionGold;
    ctx.fillRect(x + 12, y + 56, 276 * frac, 10);
  } else {
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Reward $${m.def.reward.toLocaleString('en-US')}  •  Mara Voss`, x + 12, y + 66);
  }
}

function drawMinimap(ctx, G, x, y, size) {
  const scale = size / WORLD;
  panel(ctx, x - 6, y - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#5d7d43';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x + WATER_X * scale, y, size - WATER_X * scale, size);
  ctx.strokeStyle = 'rgba(230,230,230,0.55)';
  ctx.lineWidth = 2;
  for (const c of ROAD_CENTERS) {
    ctx.beginPath();
    ctx.moveTo(x + c * scale, y);
    ctx.lineTo(x + c * scale, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + c * scale);
    ctx.lineTo(x + size, y + c * scale);
    ctx.stroke();
  }
  // Mission target.
  const target = G.missions.target();
  if (target) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = PALETTE.missionGold;
    ctx.beginPath();
    ctx.arc(x + target.x * scale, y + target.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.disabled) continue;
    ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#ff2d2d' : '#2d6bff';
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player.
  const px = x + G.player.x * scale;
  const py = y + G.player.y * scale;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.playerRing;
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PORT AURORA', x, y - 14);
}

function drawSpeed(ctx, G, cx, y) {
  if (!G.player.car) return;
  const mph = Math.round(Math.abs(G.player.car.speed) * 0.09);
  panel(ctx, cx - 70, y, 140, 52);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${mph}`, cx, y + 19);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px sans-serif';
  ctx.fillText('mph', cx, y + 41);
}

function drawToasts(ctx, G, cx, y) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let yy = y;
  for (const t of G.toasts) {
    const a = Math.min(1, t.life / 1.2);
    // Word-wrap long story toasts so they never run off the screen.
    const words = t.text.split(' ');
    const lines = [''];
    for (const word of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (test.length > 58 && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = test;
    }
    ctx.font = 'bold 16px sans-serif';
    let w = 0;
    for (const line of lines) w = Math.max(w, ctx.measureText(line).width);
    w += 28;
    const h = lines.length * 22 + 14;
    ctx.globalAlpha = a;
    panel(ctx, cx - w / 2, yy - h / 2, w, h);
    ctx.fillStyle = PALETTE.hudText;
    lines.forEach((line, i) => ctx.fillText(line, cx, yy - h / 2 + 18 + i * 22));
    yy += h + 10;
    ctx.globalAlpha = 1;
  }
}

function drawMissionArrow(ctx, G, viewW, viewH) {
  const target = G.missions.target();
  if (!target) return;
  const px = G.player.x;
  const py = G.player.y;
  const dx = target.x - px;
  const dy = target.y - py;
  const d = Math.hypot(dx, dy);
  if (d < viewW * 0.6) return; // On screen already: the beacon shows it.
  const angle = Math.atan2(dy, dx);
  const cx = viewW / 2 + Math.cos(angle) * (viewW / 2 - 90);
  const cy = viewH / 2 + Math.sin(angle) * (viewH / 2 - 90);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.missionGold;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(d / 50)}m`, cx, cy + 26);
}

function drawControlsHint(ctx, G, x, y) {
  if (G.time - G.startedAt > 14) return;
  panel(ctx, x, y, 330, 66);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('WASD move / drive   •   E steal car', x + 12, y + 16);
  ctx.fillText('Mouse + click shoot   •   Space handbrake', x + 12, y + 34);
  ctx.fillText('P pause   •   M mute   •   R reload', x + 12, y + 52);
}

function drawDamageFlash(ctx, G, viewW, viewH) {
  if (G.flashRed <= 0) return;
  const grad = ctx.createRadialGradient(
    viewW / 2, viewH / 2, viewH * 0.3, viewW / 2, viewH / 2, viewH * 0.75,
  );
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(1, `rgba(255,0,0,${G.flashRed * 0.5})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawAmmo(ctx, G, x, y) {
  if (!G.player.onFoot) return;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const reload = G.player.reloadT > 0 ? ' — reloading…' : '';
  ctx.fillText(`AMMO ${G.player.ammo}/12${reload}`, x, y);
}

export function drawHud(ctx, G, viewW, viewH) {
  drawCashHealth(ctx, G, 16, 16);
  drawWantedStars(ctx, G, viewW - 170, 30);
  drawMissionCard(ctx, G, 16, 86);
  drawMinimap(ctx, G, viewW - 206, viewH - 206, 190);
  drawSpeed(ctx, G, viewW / 2, viewH - 68);
  drawControlsHint(ctx, G, 16, viewH - 82);
  drawAmmo(ctx, G, 16, 188);
  drawMissionArrow(ctx, G, viewW, viewH);
  drawToasts(ctx, G, viewW / 2, 120);
  drawDamageFlash(ctx, G, viewW, viewH);
  if (G.player.health < 30 && G.state === 'playing') {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW HEALTH — find cover!', viewW / 2, 170);
  }
}

function menuButton(ctx, text, x, y, w, selected) {
  ctx.fillStyle = selected ? PALETTE.missionGold : 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 44, 8);
  ctx.fill();
  ctx.fillStyle = selected ? '#1a1a1a' : PALETTE.hudText;
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 22);
}

export function drawTitle(ctx, G, viewW, viewH) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
  ctx.fillRect(0, 0, viewW, viewH);
  const cx = viewW / 2;
  ctx.fillStyle = PALETTE.missionGold;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PORT AURORA', cx, viewH * 0.2);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story — drive, steal, escape.', cx, viewH * 0.2 + 44);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '15px sans-serif';
  ctx.fillText('A living city • 6 story jobs • 5-star wanted • traffic, police, missions', cx, viewH * 0.2 + 72);

  const items = G.loadedSave ? ['Continue', 'New Game', 'How to Play'] : ['New Game', 'How to Play'];
  const bw = 280;
  const bx = cx - bw / 2;
  let by = viewH * 0.42;
  items.forEach((item, i) => {
    menuButton(ctx, item, bx, by, bw, G.menuIndex === i);
    by += 56;
  });
  if (G.menuView === 'help') {
    panel(ctx, cx - 330, viewH * 0.42 + items.length * 56 + 8, 660, 150);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      'WASD / arrows — move on foot, drive the car',
      'E — enter or steal a car (walk up to one first)',
      'Mouse + click — aim and shoot (on foot)   •   R — reload',
      'Shift — run   •   Space — handbrake   •   H — horn',
      'P / Esc — pause   •   M — mute',
      'Follow the gold marker: Mara Voss pays in cash. Watch the stars.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, cx - 312, viewH * 0.42 + items.length * 56 + 36 + i * 20));
  }
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A wholly original game — no Rockstar content, no borrowed assets.', cx, viewH - 28);
}

export function drawPause(ctx, G, viewW, viewH) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.6)';
  ctx.fillRect(0, 0, viewW, viewH);
  const cx = viewW / 2;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', cx, viewH * 0.3);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.fillText('WASD drive • E steal car • Mouse + click shoot • Space handbrake', cx, viewH * 0.3 + 34);
  const items = ['Resume', 'Restart Job', 'Quit to Title'];
  const bw = 280;
  const bx = cx - bw / 2;
  let by = viewH * 0.45;
  items.forEach((item, i) => {
    menuButton(ctx, item, bx, by, bw, G.menuIndex === i);
    by += 56;
  });
}

function drawEndScreen(ctx, viewW, viewH, title, color, lines, hint) {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  const cx = viewW / 2;
  ctx.fillStyle = color;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, cx, viewH * 0.32);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, cx, viewH * 0.32 + 44 + i * 28));
  ctx.fillStyle = PALETTE.missionGold;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(hint, cx, viewH * 0.32 + 44 + lines.length * 28 + 22);
}

export function drawBusted(ctx, G, viewW, viewH) {
  drawEndScreen(ctx, viewW, viewH, 'BUSTED', '#5aa2ff',
    ['The Aurora PD took you in.', `The cops kept $${G.bustedFine.toLocaleString('en-US')} of your cash as a fine.`],
    'Press Enter to get out and keep playing');
}

export function drawWasted(ctx, G, viewW, viewH) {
  drawEndScreen(ctx, viewW, viewH, 'WASTED', '#ff5a4d',
    ['You woke up at Marina General.', `The hospital bill cost you $${G.bustedFine.toLocaleString('en-US')}.`],
    'Press Enter to walk out and keep playing');
}

export function drawComplete(ctx, G, viewW, viewH) {
  drawEndScreen(ctx, viewW, viewH, 'DEBT PAID', PALETTE.missionGold,
    ['Every job done. Mara Voss shakes your hand — and lets you go.',
     `You walk away with $${Math.round(G.cash).toLocaleString('en-US')} and the whole city still yours.`,
     'Free roam continues: steal, drive, outrun the law.'],
    'Press Enter to keep playing Port Aurora');
}
