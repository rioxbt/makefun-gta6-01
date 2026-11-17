// The wanted level and the police who answer it: heat climbs with every crime, a star cools off
// when nothing happens for a while, and while the stars are up cruisers hunt the player down the
// streets with officers on foot beside them.
import { CELL, WORLD, COLORS, WANTED } from './config.js';
import { makePoliceCar, driveVehicle } from './traffic.js';
import { Pedestrian } from './people.js';

/** Raise the heat; the level is what the HUD shows as stars. */
export function addHeat(world, amount) {
  if (world.godMode) return;
  world.heat = Math.min(WANTED.max, world.heat + amount);
  world.heatTimer = 0;
  const stars = Math.ceil(world.heat);
  if (stars > world.stars) {
    world.stars = stars;
    world.notify(stars >= 4 ? `Wanted level ${stars} — the whole force is out` : `Wanted level ${stars}`);
    world.spawnSound('alarm', world.player);
  }
  world.heatTimer = 0;
}

/** Lower it: a single star fades when the streets go quiet, the top of the scale holds on. */
export function coolHeat(world, dt) {
  world.heatTimer += dt;
  const delay = WANTED.decay + world.stars * 2.2;
  if (world.heatTimer > delay && world.heat > 0) {
    world.heat = Math.max(0, world.heat - dt * (0.28 + world.stars * 0.05));
    world.heatTimer = delay * 0.55;
  }
  const stars = Math.ceil(world.heat);
  if (stars < world.stars) {
    world.stars = Math.max(0, stars);
    if (world.stars === 0) world.notify('You lost the police');
  }
  if (world.heat <= 0) {
    world.heat = 0;
    world.stars = 0;
  }
}

/** Keep as many cruisers and officers on the player as the level calls for. */
export function updatePolice(world, dt) {
  const wantedCars = WANTED.cars[world.stars] ?? 0;
  const wantedFoot = WANTED.foot[world.stars] ?? 0;
  const liveCars = world.vehicles.filter((car) => car.kind === 'police' && !car.burnt);
  const liveFoot = world.peds.filter((ped) => ped.kind === 'officer' && !ped.dead);

  if (liveCars.length < wantedCars && world.spawnCooldown <= 0) {
    const spawn = policeSpawnPoint(world);
    if (spawn) {
      const car = makePoliceCar(world, spawn.x, spawn.y, spawn.angle);
      world.vehicles.push(car);
      world.spawnCooldown = 1.6;
      world.notify(world.stars >= 3 ? 'More units inbound' : 'Police on the way', 'short');
    }
  }
  if (liveFoot.length < wantedFoot && world.spawnCooldown <= 0 && !world.playerInVehicle) {
    const spawn = policeSpawnPoint(world);
    if (spawn) {
      const officer = new Pedestrian(spawn.x + 26, spawn.y + 26, world.rng, 'enforcer', 'midtown');
      officer.kind = 'officer';
      officer.skin = COLORS.skin[0];
      officer.shirt = COLORS.police;
      officer.pants = '#1b2740';
      officer.alerted = true;
      officer.health = 55;
      world.peds.push(officer);
      world.spawnCooldown = 1.6;
    }
  }
  world.spawnCooldown = Math.max(0, world.spawnCooldown - dt);

  const fireRate = WANTED.fire_rate[world.stars] ?? 0;
  for (const car of liveCars) {
    car.siren = true;
    car.sirenPhase += dt * 6;
    if (car.driver !== 'police') car.seat('police', 'driving');
    if (car.burnt) continue;
    const controls = policeChaseControls(world, car);
    driveVehicle(world, car, controls, dt);
    const distance = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (fireRate > 0 && distance < 340) {
      car.guard -= dt;
      if (car.guard <= 0 && !world.player.dead) {
        car.guard = 1 / fireRate;
        const spread = 0.08 + distance / 5200;
        world.copShoot(car.x + Math.cos(car.angle) * 24, car.y + Math.sin(car.angle) * 24, world.player.x, world.player.y, spread);
      }
    }
    if (distance > 1500) {
      car.x = -4000;
      car.y = -4000;
      car.retire = true;
    }
  }
  // Retire the cruisers that fell too far behind, and the officers nobody is near.
  world.vehicles = world.vehicles.filter((car) => !car.retire);
  if (world.stars === 0) world.vehicles = world.vehicles.filter((car) => car.kind !== 'police' || Math.hypot(car.x - world.player.x, car.y - world.player.y) < 220);
}

/** Where a unit joins the chase: a road around the player, off the screen. */
function policeSpawnPoint(world) {
  const player = world.player;
  const facing = world.playerInVehicle && world.vehicle ? world.vehicle.angle : player.angle;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const angle = world.rng.range(0, Math.PI * 2);
    const distance = world.rng.range(620, 900);
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;
    if (x < 40 || y < 40 || x > WORLD - 60 || y > WORLD - 40) continue;
    if (world.city.beyondWater(x)) continue;
    if (!world.city.isRoad(x, y) && !world.city.isSidewalk(x, y)) continue;
    if (world.city.isSolid(x, y, 26)) continue;
    void facing;
    return { x, y, angle: Math.atan2(player.y - y, player.x - x) };
  }
  return null;
}

/**
 * The chase's driving: head straight at the player, ease off when very close so it rams rather
 * than parks on top of them, and back out of a wall it just drove into.
 */
export function policeChaseControls(world, car) {
  const player = world.player;
  const targetX = player.x;
  const targetY = player.y;
  const desired = Math.atan2(targetY - car.y, targetX - car.x);
  let difference = desired - car.angle;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  const distance = Math.hypot(targetX - car.x, targetY - car.y);
  const steer = Math.max(-1, Math.min(1, difference * 2.4));
  let throttle = 1;
  if (Math.abs(difference) > 1.7 && Math.abs(car.speed) > 150) throttle = 0.25;
  if (distance < 70 && Math.abs(car.speed) > 200) throttle = 0.2;
  if (car.blockedFor > 0.35) {
    throttle = -0.6;
    car.blockedFor = 0;
  }
  car.blockedFor = Math.abs(car.speed) < 14 && throttle > 0 ? (car.blockedFor ?? 0) + 1 / 60 : 0;
  return { throttle, steer, brake: false };
}

/** The heat below a car that has just been wrecked by the player. */
export function heatForDestroyedPolice(world) {
  addHeat(world, 2.5);
}

/** Cells of the city the police prowl when nothing is happening: used for parked cruisers. */
export function prowlCells() {
  return [[6, 3], [4, 8], [9, 5], [11, 3], [5, 11]].map(([cx, cy]) => ({ x: cx * CELL, y: cy * CELL }));
}
