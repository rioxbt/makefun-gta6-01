// Vehicles: the traffic that fills the streets, the cars you can steal, and the arcade driving
// they all share once someone is behind the wheel. A car in traffic keeps to its lane and stops
// for what is in front of it; a car with a driver takes throttle and steering and slides, dents
// and finally burns.
import { CELL, GRID, WORLD, COAST_X, COLORS, PLAYER } from './config.js';
import { Rng, mixSeed } from './random.js';

/** What each kind of car is like to drive and how much it can take before it burns. */
export const CAR_KINDS = {
  sedan: { length: 46, width: 21, max: 248, accel: 205, steer: 3.0, drag: 1.15, health: 100, weight: 1 },
  sport: { length: 44, width: 20, max: 320, accel: 305, steer: 3.2, drag: 1.0, health: 80, weight: 0.9 },
  taxi: { length: 48, width: 21, max: 242, accel: 198, steer: 2.9, drag: 1.15, health: 100, weight: 1 },
  van: { length: 54, width: 24, max: 205, accel: 168, steer: 2.45, drag: 1.25, health: 130, weight: 1.3 },
  truck: { length: 76, width: 28, max: 180, accel: 132, steer: 1.95, drag: 1.3, health: 195, weight: 2 },
  police: { length: 50, width: 23, max: 302, accel: 300, steer: 3.1, drag: 1.0, health: 140, weight: 1.2 },
};

export const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'truck', 'sedan', 'sport'];

export class Vehicle {
  constructor(x, y, angle, kind, rng, colour = null) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.kind = kind;
    this.spec = CAR_KINDS[kind] ?? CAR_KINDS.sedan;
    this.colour = colour ?? (kind === 'police' ? COLORS.police : kind === 'taxi' ? '#e8b62c' : rng.pick(COLORS.car));
    this.speed = 0;
    this.health = this.spec.health;
    this.mode = 'traffic';
    this.driver = 'traffic';
    this.stolen = false;
    this.burnt = false;
    this.siren = false;
    this.sirenPhase = 0;
    this.controls = { throttle: 0, steer: 0, brake: false };
    this.slip = 0;
    this.guard = 0;
    this.honk = 0;
    this.lane = { axis: Math.abs(Math.cos(angle)) > 0.5 ? 'x' : 'y', coord: 0, dir: 1, along: 0 };
    this.wrecks = 0;
    this.damageTimer = 0;
    this.mission = null;
  }

  get length() {
    return this.spec.length;
  }

  get width() {
    return this.spec.width;
  }

  /** The point this car's nose (or tail) reaches along its heading. */
  nose(scale = 0.42) {
    return { x: this.x + Math.cos(this.angle) * this.spec.length * scale, y: this.y + Math.sin(this.angle) * this.spec.length * scale };
  }

  /** Seat a driver: the player, a police officer or traffic. */
  seat(driver, mode) {
    this.driver = driver;
    this.mode = mode ?? (driver === 'traffic' ? 'traffic' : 'driving');
  }

  /** Leave the car where it stands; if it is running, it coasts to a stop. */
  park() {
    this.driver = null;
    this.mode = 'parked';
    this.controls = { throttle: 0, steer: 0, brake: true };
  }

  /** Fire in front of the car and burn down where it stands. */
  explode(world) {
    if (this.burnt) return;
    this.burnt = true;
    this.mode = 'wreck';
    this.driver = null;
    this.speed = 0;
    world.spawnEffect(this.x, this.y, 'explosion');
    world.spawnSound('explosion', this);
    world.shake(16);
    for (let spark = 0; spark < 22; spark += 1) {
      const angle = world.rng.range(0, Math.PI * 2);
      const speed = world.rng.range(60, 260);
      world.particles.push({ x: this.x, y: this.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: world.rng.range(0.4, 1.2), max: 1.2, kind: 'spark', colour: COLORS.fire });
    }
    world.decals.push({ x: this.x, y: this.y, r: 30, colour: 'rgba(30,26,24,0.5)', life: 900 });
    if (this.kind === 'police') world.addHeat(2);
  }

  /** Take a hit: sparks, a dent, and a wreck once it has had enough. */
  hurt(world, amount, fromX = null, fromY = null) {
    if (this.burnt) return;
    this.health -= amount;
    if (this.health <= 0) this.explode(world);
    else if (amount > 4) {
      world.spawnEffect(this.x, this.y, 'sparks');
      if (fromX !== null) world.shake(2.5);
    }
  }
}

/** Line up a car with a lane so the traffic model can drive it. */
export function alignToLane(car, rng) {
  const vertical = rng.chance(0.5);
  const line = rng.int(0, GRID);
  const laneOffset = rng.chance(0.5) ? 14 : -14;
  if (vertical) {
    car.lane = { axis: 'y', coord: line * CELL + laneOffset, dir: laneOffset > 0 ? -1 : 1, along: rng.range(0, WORLD) };
    car.angle = car.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x = car.lane.coord;
    car.y = car.lane.along;
  } else {
    car.lane = { axis: 'x', coord: line * CELL + laneOffset, dir: laneOffset > 0 ? -1 : 1, along: rng.range(0, WORLD) };
    car.angle = car.lane.dir > 0 ? 0 : Math.PI;
    car.x = car.lane.along;
    car.y = car.lane.coord;
  }
  car.speed = rng.range(90, 150);
}

/** Put `count` cars on the roads, all of them in a lane and already rolling. */
export function spawnTraffic(world, count) {
  const rng = new Rng(mixSeed(world.seed, 907));
  const cars = [];
  for (let index = 0; index < count; index += 1) {
    const kind = rng.pick(TRAFFIC_KINDS);
    const car = new Vehicle(0, 0, 0, kind, rng);
    alignToLane(car, rng);
    if (Math.abs(car.x - world.player.x) < 260 && Math.abs(car.y - world.player.y) < 200) continue;
    cars.push(car);
  }
  return cars;
}

/** Parked cars along the kerb and in the lots: the easy first steal. */
export function spawnParked(world, count) {
  const rng = new Rng(mixSeed(world.seed, 131));
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 25) {
    guard += 1;
    const spot = rng.pick(world.city.parkedSpots) ?? world.city.randomRoad(rng);
    const angle = spot.vertical ? Math.PI / 2 : spot.angle ?? (rng.chance(0.5) ? 0 : Math.PI / 2);
    const kind = rng.pick(['sedan', 'van', 'sport', 'truck', 'taxi']);
    const car = new Vehicle(spot.x, spot.y, angle, kind, rng);
    car.park();
    if (world.city.isSolid(car.x, car.y, 20)) continue;
    cars.push(car);
  }
  return cars;
}

/**
 * The traffic model: hold the lane, roll to the next intersection, sometimes turn, slow for the
 * car or the person in front. Cheap and tidy, which is what a street of cars should look like.
 */
export function updateLaneTraffic(world, car, dt) {
  const speed = Math.max(60, car.speed);
  const ahead = 46 + car.spec.length * 0.5;
  const obstacle = carAhead(world, car, ahead) || personAhead(world, car, ahead * 0.8);
  const target = obstacle ? 0 : car.speed;
  if (obstacle && car.honk <= 0 && world.rng.chance(0.004)) {
    car.honk = 0.5;
    world.spawnSound('horn', car);
  }
  car.speed += (target - car.speed) * Math.min(1, dt * 2.4);
  car.lane.along += car.lane.dir * speed * dt;
  const line = Math.round(car.lane.along / CELL);
  if (Math.abs(car.lane.along - line * CELL) < speed * dt + 8 && world.rng.chance(dt * 0.5)) {
    turnAtIntersection(world, car, line);
  }
  const end = cityEnd(car);
  if (car.lane.along < 20 || car.lane.along > end) {
    car.lane.along = car.lane.along < 20 ? end - 20 : 20 + (car.lane.along - end);
    car.lane.dir *= -1;
  }
  const lane = car.lane;
  if (lane.axis === 'y') {
    car.x = lane.coord;
    car.y = lane.along;
    car.angle = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = lane.coord;
    car.x = lane.along;
    car.angle = lane.dir > 0 ? 0 : Math.PI;
  }
  if (car.honk > 0) car.honk -= dt;
}

/** How far along its lane a car may run: north to south across the city, or the coast road's far end. */
function cityEnd(car) {
  return car.lane.axis === 'x' ? COAST_X : WORLD - 20;
}

/** Swing the car onto the crossing street, staying in the right-hand lane of the new road. */
function turnAtIntersection(world, car, line) {
  const lane = car.lane;
  const other = lane.axis === 'y' ? 'x' : 'y';
  const newDir = world.rng.chance(0.5) ? 1 : -1;
  const coord = line * CELL + (newDir > 0 ? -14 : 14);
  car.lane = {
    axis: other,
    coord,
    dir: newDir,
    along: lane.along,
  };
}

/** Is a car of the same lane just ahead? */
function carAhead(world, car, distance) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const x = car.x + cos * distance;
  const y = car.y + sin * distance;
  for (const other of world.vehicles) {
    if (other === car || other.burnt) continue;
    if (other.mode === 'parked' || other.mode === 'wreck') continue;
    if (Math.abs(other.x - x) < 24 && Math.abs(other.y - y) < 24) return true;
  }
  return false;
}

/** Is somebody about to be run over? Traffic brakes for them. */
function personAhead(world, car, distance) {
  const x = car.x + Math.cos(car.angle) * distance;
  const y = car.y + Math.sin(car.angle) * distance;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < 22) return true;
  }
  if (!world.playerInVehicle && Math.hypot(world.player.x - x, world.player.y - y) < 26) return true;
  return false;
}

/**
 * Arcade driving: throttle to the limit, brake or reverse, and a steering angle that bites with
 * speed. The car keeps a little sideways slide, which is what leaves the tyre marks.
 */
export function driveVehicle(world, car, controls, dt) {
  const spec = car.spec;
  car.controls = controls;
  const throttle = controls.throttle;
  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) car.speed += spec.accel * 1.15 * throttle * dt;
  else car.speed -= car.speed * spec.drag * dt * 1.5;
  if (controls.brake) car.speed -= Math.sign(car.speed) * 420 * dt;
  car.speed = Math.max(-96, Math.min(spec.max, car.speed));
  if (Math.abs(car.speed) < 1.5 && throttle === 0) car.speed = 0;
  const bite = Math.min(1, Math.abs(car.speed) / 70);
  const turn = controls.steer * spec.steer * bite * dt * (car.speed < 0 ? -1 : 1);
  car.angle += turn;
  car.slip = turn * Math.abs(car.speed) * 0.16;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const nextX = car.x + cos * car.speed * dt - sin * car.slip * dt;
  const nextY = car.y + sin * car.speed * dt + cos * car.slip * dt;
  const halfWidth = spec.width / 2;
  const blocked = world.city.isSolid(nextX + cos * spec.length * 0.42, nextY + sin * spec.length * 0.42, halfWidth)
    || world.city.isSolid(nextX - cos * spec.length * 0.42, nextY - sin * spec.length * 0.42, halfWidth);
  if (blocked || world.city.beyondWater(nextX + cos * spec.length * 0.4)) {
    const impact = Math.abs(car.speed);
    car.speed = -car.speed * 0.22;
    car.hurt(world, impact * 0.06, nextX, nextY);
    world.shake(Math.min(10, impact * 0.05));
    world.spawnEffect(car.x + cos * spec.length * 0.45, car.y + sin * spec.length * 0.45, 'sparks');
  } else {
    car.x = nextX;
    car.y = nextY;
  }
  if (Math.abs(car.slip) > 6 && Math.abs(car.speed) > 90) {
    world.marks.push({ x: car.x - sin * halfWidth, y: car.y + cos * halfWidth, angle: car.angle, life: 14 });
    world.marks.push({ x: car.x + sin * halfWidth, y: car.y - cos * halfWidth, angle: car.angle, life: 14 });
    if (world.marks.length > 900) world.marks.splice(0, 200);
  }
  car.damageTimer = Math.max(0, car.damageTimer - dt);
}

/** Cars shove each other: separate the pair and pass some speed between them. */
export function resolveVehicleContacts(world) {
  const list = world.vehicles;
  for (let a = 0; a < list.length; a += 1) {
    const one = list[a];
    if (one.burnt) continue;
    for (let b = a + 1; b < list.length; b += 1) {
      const two = list[b];
      if (two.burnt) continue;
      const dx = two.x - one.x;
      const dy = two.y - one.y;
      const reach = (one.spec.length + two.spec.length) * 0.36;
      const distance = Math.hypot(dx, dy);
      if (distance > reach || distance === 0) continue;
      const overlap = reach - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      const push = overlap / 2;
      one.x -= nx * push;
      one.y -= ny * push;
      two.x += nx * push;
      two.y += ny * push;
      const force = Math.abs(one.speed - two.speed) + 2;
      if (force > 26) {
        one.hurt(world, force * 0.05);
        two.hurt(world, force * 0.05);
        world.spawnEffect((one.x + two.x) / 2, (one.y + two.y) / 2, 'sparks');
        world.shake(Math.min(6, force * 0.03));
      }
      const average = (one.speed + two.speed) / 2;
      one.speed = average * 0.6;
      two.speed = average * 0.6;
      if (one.mode === 'traffic') alignToHeading(one);
      if (two.mode === 'traffic') alignToHeading(two);
    }
  }
}

/** A lane car that has been shunted turns into a plain physical car going the way it faces. */
export function alignToHeading(car) {
  car.lane.along = car.lane.axis === 'y' ? car.y : car.x;
  car.lane.dir = Math.cos(car.angle) * (car.lane.axis === 'y' ? Math.sin(car.angle) : Math.cos(car.angle)) >= 0 ? 1 : -1;
}

/** The nearest car to a point that could be stolen, and how far off it is. */
export function nearestVehicle(world, x, y, radius = 62) {
  let best = null;
  let bestDistance = radius;
  for (const car of world.vehicles) {
    if (car.burnt || car.kind === 'police') continue;
    const distance = Math.hypot(car.x - x, car.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = car;
    }
  }
  return best;
}

/** A car that can be stolen from where the player stands, or null. */
export function stealableNear(world, radius = 62) {
  const car = nearestVehicle(world, world.player.x, world.player.y, radius);
  if (!car) return null;
  if (world.mission && world.mission.targetVehicle && world.mission.targetVehicle !== car) {
    return car;
  }
  return car;
}

/** Rolling a car onto the player does damage and pushes them off their feet. */
export function runOverCheck(world, car) {
  const player = world.player;
  if (world.playerInVehicle || player.dead) return;
  if (Math.abs(car.speed) < 40) return;
  if (Math.hypot(car.x - player.x, car.y - player.y) < 22) {
    world.damagePlayer(18 + Math.abs(car.speed) * 0.05, car.x, car.y);
    world.spawnEffect(player.x, player.y, 'blood');
  }
  for (const ped of world.peds) {
    if (ped.dead) continue;
    if (Math.hypot(car.x - ped.x, car.y - ped.y) < 20) {
      ped.kill(world, car.driver === 'player' ? 'player' : 'traffic');
      if (car.driver === 'player') world.player.hitAndRun = (world.player.hitAndRun ?? 0) + 1;
      car.speed *= 0.94;
    }
  }
}

/** A fresh, well-driven police cruiser, ready to be handed a chase. */
export function makePoliceCar(world, x, y, angle) {
  const car = new Vehicle(x, y, angle, 'police', world.rng);
  car.seat('police', 'driving');
  car.siren = true;
  return car;
}

/** How far the driver may see: used by the police chase to pick its line. */
export function laneForwardPoint(car, distance) {
  return { x: car.x + Math.cos(car.angle) * distance, y: car.y + Math.sin(car.angle) * distance };
}
