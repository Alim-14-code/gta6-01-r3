// Port Aurora — the city itself: roads, blocks, buildings, parks, the harbour,
// and the collision queries everything else uses to stay on the streets.
// One job: build a fixed city from a seed and answer "what is here?".
import {
  WORLD, ROAD_CENTERS, ROAD_WIDTH, WATER_X, BEACH_X, PALETTE,
} from './config.js';
import { makeRng } from './random.js';

// Named places the missions and the minimap point at.
export const LANDMARKS = {
  docks: { name: 'The Docks', x: 5960, y: 5600 },
  motel: { name: 'Sunset Motel', x: 900, y: 4760 },
  warehouse: { name: 'Warehouse 9', x: 5180, y: 6040 },
  garage: { name: "Voss Garage", x: 3080, y: 1450 },
  bank: { name: 'Aurora National Bank', x: 3360, y: 2240 },
  safehouse: { name: 'Safehouse', x: 3080, y: 5600 },
  hospital: { name: 'Marina General', x: 5180, y: 900 },
  pier: { name: 'The Old Pier', x: 6120, y: 3360 },
  plaza: { name: 'Founders Plaza', x: 3360, y: 3360 },
};

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const half = ROAD_WIDTH / 2;

  // Blocks sit between neighbouring road centres. Each block gets buildings,
  // a park, or a plaza; blocks east of the beach stay empty sand.
  for (let ix = 0; ix < ROAD_CENTERS.length - 1; ix++) {
    for (let iy = 0; iy < ROAD_CENTERS.length - 1; iy++) {
      const x0 = ROAD_CENTERS[ix] + half + 14;
      const x1 = ROAD_CENTERS[ix + 1] - half - 14;
      const y0 = ROAD_CENTERS[iy] + half + 14;
      const y1 = ROAD_CENTERS[iy + 1] - half - 14;
      if (x0 >= BEACH_X) continue;
      const roll = rng.next();
      const downtown = ix >= 4 && ix <= 7 && iy >= 0 && iy <= 6;
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'park' });
        const n = rng.int(6, 12);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 16) });
        }
      } else if (roll < 0.24) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'plaza' });
        const n = rng.int(2, 4);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(8, 12) });
        }
      } else {
        // One to four buildings per block, with a margin for the sidewalk.
        const cols = rng.chance(0.5) ? 2 : 1;
        const rows = rng.chance(0.5) ? 2 : 1;
        const cw = (x1 - x0) / cols;
        const ch = (y1 - y0) / rows;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const bw = cw * rng.range(0.55, 0.8);
            const bh = ch * rng.range(0.55, 0.8);
            const bx = x0 + c * cw + (cw - bw) / 2;
            const by = y0 + r * ch + (ch - bh) / 2;
            buildings.push({
              x: bx, y: by, w: bw, h: bh,
              height: downtown ? rng.range(16, 30) : rng.range(7, 15),
              color: rng.pick(PALETTE.buildingRoof),
              seed: rng.int(0, 999999),
            });
          }
        }
      }
    }
  }

  // A row of palms along the beach, and a pier reaching into the water.
  for (let y = 300; y < WORLD - 300; y += 170) {
    trees.push({ x: BEACH_X + 26, y: y + rng.range(-30, 30), r: rng.range(10, 15), palm: true });
  }
  return { buildings, parks, trees, seed };
}

export function isWater(x, y) {
  return x > WATER_X;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

// Nearest road centre coordinate on one axis, and the distance to it.
export function nearestRoadCoord(v) {
  let best = ROAD_CENTERS[0];
  let bestD = Math.abs(v - best);
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(v - c);
    if (d < bestD) { best = c; bestD = d; }
  }
  return { coord: best, dist: bestD };
}

// The intersection a traveller is crossing right now, if any. A traveller
// drives or walks in a lane offset from the road centre (19px for cars, 43px
// for pedestrians), so only the distance along their own axis is tested —
// the perpendicular offset is their lane, not a miss.
export function crossingAhead(x, y, axis) {
  const nx = nearestRoadCoord(x);
  const ny = nearestRoadCoord(y);
  if (axis === 'h' && nx.dist < 12) return { cx: nx.coord, cy: ny.coord };
  if (axis === 'v' && ny.dist < 12) return { cx: nx.coord, cy: ny.coord };
  return null;
}

// Push a circle out of buildings, the world edge and the water. Returns the
// corrected position; also reports whether a collision happened.
export function resolveCircle(city, x, y, r) {
  let hit = false;
  let cx = x;
  let cy = y;
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(cx, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(cy, b.y + b.h));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        cx = nearestX + (dx / d) * r;
        cy = nearestY + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest overlap.
        const left = cx - b.x;
        const right = b.x + b.w - cx;
        const top = cy - b.y;
        const bottom = b.y + b.h - cy;
        const m = Math.min(left, right, top, bottom);
        if (m === left) cx = b.x - r;
        else if (m === right) cx = b.x + b.w + r;
        else if (m === top) cy = b.y - r;
        else cy = b.y + b.h + r;
      }
    }
  }
  if (cx < r) { cx = r; hit = true; }
  if (cy < r) { cy = r; hit = true; }
  if (cx > WORLD - r) { cx = WORLD - r; hit = true; }
  if (cy > WORLD - r) { cy = WORLD - r; hit = true; }
  if (cx > WATER_X - r) { cx = WATER_X - r; hit = true; }
  return { x: cx, y: cy, hit };
}

// A point on a road centre line, on a lane offset, facing along the road.
export function roadSpawn(rng, axis) {
  const line = rng.pick(ROAD_CENTERS);
  const along = rng.range(600, WORLD - 600);
  const lane = rng.chance(0.5) ? 19 : -19;
  if (axis === 'h') return { x: along, y: line + lane, angle: lane > 0 ? 0 : Math.PI };
  return { x: line + lane, y: along, angle: lane > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

// A sidewalk point near a road, for pedestrians and parked cars.
export function sidewalkPoint(rng) {
  const line = rng.pick(ROAD_CENTERS);
  const along = rng.range(500, WORLD - 500);
  const side = rng.chance(0.5) ? 1 : -1;
  const off = ROAD_WIDTH / 2 - 9;
  if (rng.chance(0.5)) return { x: along, y: line + side * off };
  return { x: line + side * off, y: along };
}
