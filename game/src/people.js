// Pedestrians: the crowds that make a street feel lived in. They wander the sidewalk rings,
// scatter when they hear gunfire or see a body, and some of them (the enforcers a mission sends)
// shoot back. A walker that is hit leaves a mark on the ground and a puddle that stays.
import { CELL, GRID, COLORS, PLAYER } from './config.js';
import { Rng, mixSeed } from './random.js';

const WALK = 34;
const PANIC_SPEED = 96;

export class Pedestrian {
  constructor(x, y, rng, kind = 'walker', district = 'midtown') {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.state = 'walk';
    this.speed = kind === 'enforcer' ? 58 : rng.range(WALK - 8, WALK + 16);
    this.dir = rng.heading();
    this.rng = rng;
    this.skin = rng.pick(COLORS.skin);
    this.shirt = kind === 'enforcer' ? '#2c3444' : rng.pick(COLORS.shirt);
    this.pants = rng.pick(COLORS.pants);
    this.health = kind === 'enforcer' ? 60 : 30;
    this.armour = false;
    this.walkPhase = rng.range(0, 6.28);
    this.timer = rng.range(0, 6);
    this.dead = false;
    this.deadTimer = 0;
    this.district = district;
    this.fireCooldown = rng.range(0.4, 1.4);
    this.alerted = false;
    this.step = rng.range(0, 1);
  }

  /** Aim the walker at a new spot on the sidewalk ring of a nearby block. */
  retarget(city) {
    const cx = Math.min(GRID - 1, Math.max(0, Math.floor(this.x / CELL)));
    const cy = Math.min(GRID - 1, Math.max(0, Math.floor(this.y / CELL)));
    const spot = city.sidewalkSpot(cx, cy, this.rng);
    const dx = spot.x - this.x;
    const dy = spot.y - this.y;
    const length = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / length, y: dy / length };
    this.timer = this.rng.range(2.5, 7);
  }

  /** Drop the walker dead where it stands: a body the world keeps until it is cleaned. */
  kill(world, killer = 'player') {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deadTimer = 0;
    world.spawnEffect(this.x, this.y, 'blood');
    world.decals.push({ x: this.x, y: this.y, r: 13 + this.rng.range(0, 5), colour: COLORS.blood, life: 900 });
    if (killer === 'player') world.addHeat(world.crime.ped_kill ?? 2);
    world.spawnSound('thud', this);
  }

  panic(fromX, fromY) {
    if (this.dead || this.kind === 'enforcer') return;
    this.state = 'flee';
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / length, y: dy / length };
    this.timer = 3.5;
  }
}

/** Fill the sidewalks with walkers, and keep a fixed crowd around the player as they move. */
export function spawnCrowd(world, count) {
  const rng = new Rng(mixSeed(world.seed, 331));
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 20) {
    guard += 1;
    const spot = world.city.randomRoad(rng);
    const city = world.city;
    const walker = {
      x: spot.x + (rng.chance(0.5) ? 22 : -22) + (rng.chance(0.5) ? 14 : -14),
      y: spot.y + (rng.chance(0.5) ? 22 : -22),
    };
    if (city.isRoad(walker.x, walker.y) || city.isSolid(walker.x, walker.y, PLAYER.radius)) continue;
    if (city.beyondWater(walker.x)) continue;
    peds.push(new Pedestrian(walker.x, walker.y, rng, 'walker', city.districtAtPoint(walker.x, walker.y)));
  }
  return peds;
}

/** Every pedestrian's step: wander, panic, or (for an enforcer) close in and fire. */
export function updatePeds(world, dt) {
  const player = world.player;
  for (const ped of world.peds) {
    if (ped.dead) {
      ped.deadTimer += dt;
      continue;
    }
    const distanceToPlayer = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (ped.state === 'walk' && distanceToPlayer < 130 && world.playerInVehicle) ped.panic(player.x, player.y);
    if (ped.kind === 'enforcer' && ped.alerted && !world.player.dead) {
      const angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      ped.dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const speed = distanceToPlayer > 190 ? 74 : 34;
      movePed(world, ped, speed * dt);
      ped.fireCooldown -= dt;
      if (ped.fireCooldown <= 0 && distanceToPlayer < 420 && !world.player.dead) {
        ped.fireCooldown = world.rng.range(0.5, 1.2);
        world.copShoot(ped.x, ped.y, player.x, player.y, 0.12);
      }
      continue;
    }
    ped.timer -= dt;
    if (ped.state === 'flee') {
      ped.timer -= dt;
      movePed(world, ped, PANIC_SPEED * dt);
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.retarget(world.city);
      }
      continue;
    }
    if (ped.timer <= 0) ped.retarget(world.city);
    movePed(world, ped, ped.speed * dt);
    ped.step += (ped.speed * dt) / 20;
  }
  // A body is carried away after a while so the streets do not fill up.
  world.peds = world.peds.filter((ped) => !(ped.dead && ped.deadTimer > 60));
}

/** Move a walker, sliding along walls instead of walking into them. */
function movePed(world, ped, distance) {
  const nextX = ped.x + ped.dir.x * distance;
  const nextY = ped.y + ped.dir.y * distance;
  const radius = 7;
  if (!world.city.isSolid(nextX, ped.y, radius) && !world.city.beyondWater(nextX + radius) && nextX > 6) ped.x = nextX;
  else {
    ped.dir.x = -ped.dir.x;
    ped.timer = Math.min(ped.timer, 1.5);
  }
  if (!world.city.isSolid(ped.x, nextY, radius) && !world.city.beyondWater(ped.x + radius) && nextY > 6) ped.y = nextY;
  else {
    ped.dir.y = -ped.dir.y;
    ped.timer = Math.min(ped.timer, 1.5);
  }
}
