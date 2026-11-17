// Velamar, built once from a seed: streets on a grid, blocks of buildings, two parks, docks and
// containers at the west end, a neon strip, and sand and sea down the east side. The city also
// answers the questions the rest of the game asks of it: is this point road, sidewalk or solid,
// which district and which street is it on, and where is a free spot to drop a car or a walker.
import { CELL, ROAD, SIDEWALK, GRID, WORLD, SHORE_EDGE, SEA_EDGE, SEA_END, COAST_X, COLORS, DISTRICTS, DISTRICT_CELLS, STREETS } from './config.js';
import { Rng, mixSeed } from './random.js';

const HALF_ROAD = ROAD / 2;
const BUCKET = CELL / 2;

/** True when this cell of the grid is beach (the eastern column and the club blocks). */
function districtOf(cx, cy) {
  for (const name of ['park', 'strip', 'docks', 'beach']) {
    for (const [x, y] of DISTRICT_CELLS[name]) if (x === cx && y === cy) return name;
  }
  if (cx >= 12) return 'beach';
  if (cx === 0 && cy >= 2 && cy <= 6) return 'docks';
  const ring = Math.max(Math.abs(cx - 6), Math.abs(cy - 6));
  if (ring <= 1) return 'downtown';
  if (ring <= 3) return 'midtown';
  return 'homes';
}

export class City {
  constructor(seed) {
    this.seed = seed;
    this.rng = new Rng(mixSeed(seed, 7));
    this.blocks = [];
    this.solids = [];
    this.buckets = new Map();
    this.props = [];
    this.lots = [];
    this.houses = [];
    this.plazas = [];
    this.trees = [];
    this.parkedSpots = [];
    this.landmarks = [];
    this.gen = new Rng(mixSeed(seed, 21));
    this.buildGrid();
    this.buildShore();
    this.buildStreets();
    this.buildLandmarks();
    this.map = this.buildMapCanvas();
  }

  // --- the grid of blocks ---------------------------------------------------------------------

  /** The walkable footprint of one cell: roads on the outside, a sidewalk ring, an inside lot. */
  rectOf(cx, cy) {
    const x = cx * CELL + HALF_ROAD + SIDEWALK;
    const y = cy * CELL + HALF_ROAD + SIDEWALK;
    const size = CELL - 2 * (HALF_ROAD + SIDEWALK);
    return { x, y, w: size, h: size };
  }

  buildGrid() {
    for (let cy = 0; cy < GRID; cy += 1) {
      for (let cx = 0; cx < GRID; cx += 1) {
        const district = districtOf(cx, cy);
        const block = { cx, cy, district, rect: this.rectOf(cx, cy), buildings: [], prop: DISTRICTS[district].prop };
        this.blocks.push(block);
        if (district === 'park') this.buildParkBlock(block);
        else if (district === 'docks') this.buildDocksBlock(block);
        else this.buildCityBlock(block);
        this.buildSidewalk(block);
      }
    }
  }

  /** The city blocks: one tower, two half-blocks, four corner buildings, or a fenced lot. */
  buildCityBlock(block) {
    const spec = DISTRICTS[block.district];
    const rng = this.gen;
    const roll = rng.next();
    const { x, y, w, h } = block.rect;
    let parts;
    if (roll < 0.22) parts = [{ x, y, w, h }];
    else if (roll < 0.55) parts = [{ x, y, w, h: h / 2 - 5 }, { x, y: y + h / 2 + 5, w, h: h / 2 - 5 }];
    else if (roll < 0.86) parts = [
      { x, y, w: w / 2 - 5, h: h / 2 - 5 },
      { x: x + w / 2 + 5, y, w: w / 2 - 5, h: h / 2 - 5 },
      { x, y: y + h / 2 + 5, w: w / 2 - 5, h: h / 2 - 5 },
      { x: x + w / 2 + 5, y: y + h / 2 + 5, w: w / 2 - 5, h: h / 2 - 5 },
    ];
    else parts = [];
    if (parts.length === 0) {
      this.buildLot(block);
      return;
    }
    for (const part of parts) block.buildings.push(this.makeBuilding(part, spec, rng, block.district));
  }

  /** One building: footprint, roof palette, height and the roof clutter the district gets. */
  makeBuilding(part, spec, rng, district) {
    const inset = district === 'homes' ? 2 : 0;
    const x = part.x + inset;
    const y = part.y + inset;
    const w = part.w - inset * 2;
    const h = part.h - inset * 2;
    const building = {
      x, y, w, h,
      height: rng.range(spec.height[0], spec.height[1]),
      roof: rng.pick(spec.roof),
      trim: spec.trim,
      glass: spec.glass,
      district,
      roofProps: [],
    };
    if (district === 'downtown') {
      if (rng.chance(0.45)) building.roofProps.push({ kind: 'ac', x: x + w * rng.range(0.1, 0.6), y: y + h * rng.range(0.1, 0.6), w: 22, h: 16 });
      if (rng.chance(0.3)) building.roofProps.push({ kind: 'tank', x: x + w * rng.range(0.15, 0.7), y: y + h * rng.range(0.15, 0.7), w: 14, h: 14 });
      if (rng.chance(0.25)) building.roofProps.push({ kind: 'helipad', x, y, w, h });
    } else if (district === 'midtown') {
      if (rng.chance(0.6)) building.roofProps.push({ kind: 'ac', x: x + w * rng.range(0.2, 0.7), y: y + h * rng.range(0.2, 0.7), w: 20, h: 14 });
      if (rng.chance(0.4)) building.roofProps.push({ kind: 'vent', x: x + w * rng.range(0.2, 0.7), y: y + h * rng.range(0.2, 0.7), w: 10, h: 10 });
    } else if (district === 'homes') {
      building.roofProps.push({ kind: 'ridge', x, y, w, h });
      if (rng.chance(0.5)) building.roofProps.push({ kind: 'yard', x: x + w * 0.4, y: y + h * 0.4, w: 18, h: 18 });
    } else if (district === 'docks') {
      building.roofProps.push({ kind: 'skylights', x, y, w, h });
    } else if (district === 'beach') {
      building.roofProps.push({ kind: 'pool', x: x + w * 0.25, y: y + h * 0.55, w: w * 0.5, h: h * 0.28 });
    } else if (district === 'strip') {
      building.roofProps.push({ kind: 'sign', x: x + w * 0.2, y, w: w * 0.6, h: 16 });
    }
    this.addSolid(x, y, w, h);
    return building;
  }

  /** A paved lot with a fence, a couple of sheds and parking bays: somewhere to steal from. */
  buildLot(block) {
    const rng = this.gen;
    const { x, y, w, h } = block.rect;
    block.lot = true;
    const bays = rng.int(3, 6);
    for (let bay = 0; bay < bays; bay += 1) {
      const spot = {
        x: x + 26 + (bay % 3) * 46,
        y: y + 30 + Math.floor(bay / 3) * 58,
        angle: rng.chance(0.5) ? 0 : Math.PI / 2,
      };
      block.parking = block.parking ?? [];
      block.parking.push(spot);
      this.parkedSpots.push(spot);
    }
    if (rng.chance(0.5)) {
      const shed = { x: x + w - 54, y: y + h - 40, w: 50, h: 36 };
      block.buildings.push(this.makeBuilding(shed, DISTRICTS[block.district], rng, block.district));
    }
    this.lots.push(block);
  }

  /** A park block: lawn, paths, a pond, trees and benches; nothing solid but the trees. */
  buildParkBlock(block) {
    const rng = this.gen;
    const { x, y, w, h } = block.rect;
    block.park = {
      pond: rng.chance(0.6) ? { x: x + w * 0.18, y: y + h * 0.55, w: w * 0.42, h: h * 0.28 } : null,
      trees: [],
      path: rng.chance(0.5) ? 'cross' : 'ring',
      name: rng.chance(0.5) ? 'Parque Verde' : 'Jardines del Faro',
      bandstand: { x: x + w * 0.62, y: y + h * 0.12, w: 34, h: 34 },
    };
    for (let tree = 0; tree < rng.int(7, 11); tree += 1) {
      const point = { x: x + rng.range(10, w - 10), y: y + rng.range(10, h - 10), r: rng.range(13, 20) };
      if (block.park.pond && point.x > block.park.pond.x - 12 && point.x < block.park.pond.x + block.park.pond.w + 12 && point.y > block.park.pond.y - 12 && point.y < block.park.pond.y + block.park.pond.h + 12) continue;
      block.park.trees.push(point);
      this.trees.push(point);
    }
    this.plazas.push(block);
  }

  /** The docks: long warehouses, stacks of containers and a gantry crane over the quay. */
  buildDocksBlock(block) {
    const rng = this.gen;
    const { x, y, w, h } = block.rect;
    const spec = DISTRICTS.docks;
    const warehouse = { x: x + 4, y: y + 8, w: w - 8, h: h * 0.42 };
    block.buildings.push(this.makeBuilding(warehouse, spec, rng, 'docks'));
    for (let stack = 0; stack < rng.int(2, 4); stack += 1) {
      const crate = {
        kind: 'container',
        x: x + 6 + stack * 34,
        y: y + h * 0.6 + (stack % 2) * 34,
        w: 30, h: 26,
        colour: rng.pick(['#c2553f', '#3f7fc2', '#4f9f63', '#c2a13f', '#8a5cc2']),
      };
      block.crates = block.crates ?? [];
      block.crates.push(crate);
      this.props.push(crate);
      this.addSolid(crate.x, crate.y, crate.w, crate.h);
    }
    if (rng.chance(0.6)) block.crane = { x: x + w * 0.3, y: y + h * 0.05, w: w * 0.5, h: 12 };
  }

  /** Lamps, palms, hydrants, benches, bins and signs along the block's sidewalk ring. */
  buildSidewalk(block) {
    const rng = this.gen;
    const { x, y, w, h } = block.rect;
    const px = x - SIDEWALK;
    const py = y - SIDEWALK;
    const pw = w + SIDEWALK * 2;
    const ph = h + SIDEWALK * 2;
    const lampCount = rng.int(2, 4);
    for (let lamp = 0; lamp < lampCount; lamp += 1) {
      const along = lamp / lampCount;
      this.props.push({ kind: 'lamp', x: px + 8 + along * (pw - 16), y: py + 4, lit: true });
      this.props.push({ kind: 'lamp', x: px + 8 + along * (pw - 16), y: py + ph - 4, lit: true });
      this.props.push({ kind: 'lamp', x: px + 4, y: py + 8 + along * (ph - 16), lit: true });
      this.props.push({ kind: 'lamp', x: px + pw - 4, y: py + 8 + along * (ph - 16), lit: true });
    }
    const extras = rng.int(1, 3);
    for (let extra = 0; extra < extras; extra += 1) {
      const side = rng.int(0, 3);
      const alongX = px + rng.range(6, pw - 6);
      const alongY = py + rng.range(6, ph - 6);
      const kind = rng.pick(block.district === 'beach' ? ['palm', 'bench', 'hydrant'] : block.district === 'docks' ? ['bin', 'pallet', 'hydrant'] : ['hydrant', 'bench', 'bin', 'sign']);
      const spot = side === 0 ? { x: alongX, y: py + 6 } : side === 1 ? { x: alongX, y: py + ph - 6 } : side === 2 ? { x: px + 6, y: alongY } : { x: px + pw - 6, y: alongY };
      this.props.push({ kind, ...spot, r: kind === 'palm' ? 15 : 5 });
      if (kind === 'palm') this.trees.push({ x: spot.x, y: spot.y, r: 15 });
    }
  }

  /** The east shore: sand, breakwater, a pier and the sea beyond it. */
  buildShore() {
    const rng = this.gen;
    this.pier = { x: SHORE_EDGE + 4, y: WORLD * 0.44, w: 168, h: 48 };
    for (let umbrella = 0; umbrella < 34; umbrella += 1) {
      const spot = { kind: 'umbrella', x: rng.range(SHORE_EDGE + 14, SEA_EDGE - 24), y: rng.range(60, WORLD - 60), colour: rng.pick(COLORS.car) };
      this.props.push(spot);
      if (rng.chance(0.6)) this.props.push({ kind: 'deckchair', x: spot.x + 14, y: spot.y + 7, colour: spot.colour });
    }
    for (let palm = 0; palm < 30; palm += 1) {
      const spot = { x: rng.range(SHORE_EDGE - 26, SHORE_EDGE + 30), y: rng.range(30, WORLD - 30), r: 15 };
      this.trees.push(spot);
      this.props.push({ kind: 'palm', x: spot.x, y: spot.y, r: 15 });
    }
    for (let boat = 0; boat < 12; boat += 1) {
      this.props.push({ kind: 'boat', x: rng.range(SEA_EDGE + 26, SEA_END - 40), y: rng.range(40, WORLD + 160), angle: rng.range(0, Math.PI * 2), colour: rng.pick(['#e8e4d8', '#d0453a', '#3f6fa8']) });
    }
    this.marina = { x: SEA_EDGE - 90, y: WORLD * 0.72, w: 130, h: 130 };
  }

  /** Lane markings, crosswalks and parking bays: the paint on the asphalt. */
  buildStreets() {
    const rng = this.gen;
    this.parkedSpots = this.parkedSpots.concat([]);
    for (let line = 0; line < GRID; line += 1) {
      for (let along = 0; along < 3; along += 1) {
        if (rng.chance(0.5)) {
          this.props.push({ kind: 'bay', x: line * CELL + HALF_ROAD - 26, y: (rng.range(0.2, 0.8)) * CELL + along * CELL, vertical: true });
        }
      }
    }
  }

  /** Named places the missions and the HUD speak of. */
  buildLandmarks() {
    this.landmarks = [
      { name: 'Torre Sol', x: 6.5 * CELL, y: 6.5 * CELL, kind: 'tower' },
      { name: 'Parque Verde', x: 3.5 * CELL, y: 9.5 * CELL, kind: 'park' },
      { name: 'Muelle Viejo', x: 0.9 * CELL, y: 4.5 * CELL, kind: 'docks' },
      { name: 'Playa Coral', x: SEA_EDGE - 40, y: 4.5 * CELL, kind: 'beach' },
      { name: 'Neon Strip', x: 8.5 * CELL, y: 6.9 * CELL, kind: 'strip' },
      { name: 'Marina Real', x: SEA_EDGE - 90, y: WORLD * 0.72, kind: 'marina' },
    ];
    this.coastRoad = COAST_X;
  }

  addSolid(x, y, w, h) {
    const rect = { x, y, w, h };
    this.solids.push(rect);
    const from = this.bucketOf(x, y);
    const to = this.bucketOf(x + w, y + h);
    for (let by = from.by; by <= to.by; by += 1) {
      for (let bx = from.bx; bx <= to.bx; bx += 1) {
        const key = bx * 1000 + by;
        if (!this.buckets.has(key)) this.buckets.set(key, []);
        this.buckets.get(key).push(rect);
      }
    }
  }

  bucketOf(x, y) {
    return { bx: Math.floor(x / BUCKET), by: Math.floor(y / BUCKET) };
  }

  // --- the questions the game asks of the city -------------------------------------------------

  isRoad(x, y) {
    if (x < 0 || y < 0 || x > SEA_EDGE || y > WORLD) return false;
    const mx = Math.abs(x - Math.round(x / CELL) * CELL);
    const my = Math.abs(y - Math.round(y / CELL) * CELL);
    return mx < HALF_ROAD || my < HALF_ROAD;
  }

  isSidewalk(x, y) {
    if (x < 0 || y < 0 || x > SEA_EDGE || y > WORLD) return false;
    const mx = Math.abs(x - Math.round(x / CELL) * CELL);
    const my = Math.abs(y - Math.round(y / CELL) * CELL);
    return mx < HALF_ROAD + SIDEWALK || my < HALF_ROAD + SIDEWALK;
  }

  /** True when a circle at (x, y) overlaps a building, a container or a parked shed. */
  isSolid(x, y, radius = 0) {
    const from = this.bucketOf(x - radius, y - radius);
    const to = this.bucketOf(x + radius, y + radius);
    for (let by = from.by; by <= to.by; by += 1) {
      for (let bx = from.bx; bx <= to.bx; bx += 1) {
        const list = this.buckets.get(bx * 1000 + by);
        if (!list) continue;
        for (const rect of list) {
          if (x + radius > rect.x && x - radius < rect.x + rect.w && y + radius > rect.y && y - radius < rect.y + rect.h) return true;
        }
      }
    }
    return false;
  }

  /** Sea is off the map: everything east of the waterline is closed to walkers and cars. */
  beyondWater(x) {
    return x > SEA_EDGE;
  }

  districtAtPoint(x, y) {
    const cx = Math.min(GRID - 1, Math.max(0, Math.floor(x / CELL)));
    const cy = Math.min(GRID - 1, Math.max(0, Math.floor(y / CELL)));
    return districtOf(cx, cy);
  }

  /** The street a point is on, as the HUD writes it: the nearest vertical and horizontal road. */
  streetNameAt(x, y) {
    const kx = Math.min(GRID, Math.max(0, Math.round(x / CELL)));
    const ky = Math.min(GRID, Math.max(0, Math.round(y / CELL)));
    if (this.isRoad(x, y)) {
      const vertical = Math.abs(x - kx * CELL) < HALF_ROAD;
      const name = vertical ? STREETS[kx % STREETS.length] : STREETS[(ky + 6) % STREETS.length];
      return vertical ? name : `${name} Sur`;
    }
    const block = this.blocks[Math.min(GRID - 1, Math.floor(y / CELL)) * GRID + Math.min(GRID - 1, Math.floor(x / CELL))];
    return block && block.park ? block.park.name : `${this.districtAtPoint(x, y)} block`;
  }

  /** A point in the middle of an intersection: always open, used for markers and spawns. */
  intersection(kx, ky) {
    return { x: kx * CELL, y: ky * CELL };
  }

  /** A point in a driving lane a little off an intersection, facing a way. */
  lanePoint(kx, ky, offsetX = 14, offsetY = 14) {
    return { x: kx * CELL + offsetX, y: ky * CELL + offsetY };
  }

  /** A free sidewalk spot inside a block ring, for a walker or a pickup to stand on. */
  sidewalkSpot(cx, cy, rng) {
    const { x, y, w, h } = this.rectOf(cx, cy);
    const inset = SIDEWALK / 2;
    const side = rng.int(0, 3);
    if (side === 0) return { x: x + rng.range(6, w - 6), y: y - inset };
    if (side === 1) return { x: x + rng.range(6, w - 6), y: y + h + inset };
    if (side === 2) return { x: x - inset, y: y + rng.range(6, h - 6) };
    return { x: x + w + inset, y: y + rng.range(6, h - 6) };
  }

  /** A spot on the asphalt somewhere in the city, for traffic, police and pickups. */
  randomRoad(rng) {
    const along = rng.chance(0.5);
    const line = rng.int(0, GRID);
    const offset = rng.range(-HALF_ROAD + 8, HALF_ROAD - 8);
    const travel = rng.range(0, WORLD);
    return along
      ? { x: line * CELL + offset, y: travel, angle: offset < 0 ? -Math.PI / 2 : Math.PI / 2 }
      : { x: travel, y: line * CELL + offset, angle: offset < 0 ? Math.PI : 0 };
  }

  // --- the minimap ---------------------------------------------------------------------------

  /** A small painted map of the whole city: the minimap draws a crop of it as the player moves. */
  buildMapCanvas() {
    const scale = 0.14;
    const size = Math.round(WORLD * scale);
    const map = document.createElement('canvas');
    map.width = size;
    map.height = size;
    const ctx = map.getContext('2d');
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(Math.round(SHORE_EDGE * scale), 0, Math.round((SEA_EDGE - SHORE_EDGE) * scale), size);
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(0, 0, Math.round(SEA_EDGE * scale), size);
    for (const block of this.blocks) {
      ctx.fillStyle = block.park ? COLORS.grass : DISTRICTS[block.district].roof[0];
      const rect = block.rect;
      ctx.fillRect(Math.round((rect.x - SIDEWALK) * scale), Math.round((rect.y - SIDEWALK) * scale), Math.round((rect.w + SIDEWALK * 2) * scale), Math.round((rect.h + SIDEWALK * 2) * scale));
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    for (let line = 0; line <= GRID; line += 1) {
      ctx.beginPath();
      ctx.moveTo(line * CELL * scale, 0);
      ctx.lineTo(line * CELL * scale, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, line * CELL * scale);
      ctx.lineTo(size, line * CELL * scale);
      ctx.stroke();
    }
    return { canvas: map, scale };
  }
}

/** Build the city the whole game shares, once. */
export function buildCity(seed) {
  return new City(seed);
}
