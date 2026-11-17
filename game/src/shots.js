// The scenes behind ?shot=name: each one builds a real Velamar, plays the game's own rules
// forward with a scripted hand on the controls, and stops on the frame worth showing. Nothing
// here fakes a picture: the world steps, the traffic drives, the police chase and the HUD reads
// the same state a player would be in.
import { STEP, CELL, COLORS, WORLD, PLAYER } from './config.js';
import { Vehicle } from './traffic.js';
import { Pedestrian } from './people.js';
import { startMission, MISSIONS, GARAGE, currentMarker } from './missions.js';
import { giveAmmo, unlockWeapon, selectWeapon } from './weapons.js';

/** A hand on the controls a scene can steer: the same interface the real Input offers. */
class ScriptInput {
  constructor() {
    this.down = new Set();
    this.fresh = new Set();
    this.move = { x: 0, y: 0, length: 0 };
    this.aim = { x: 1, y: 0 };
    this.run = false;
  }

  /** The trigger, read the same way the real Input offers it: the attack key or the mouse. */
  get attack() {
    return this.down.has('attack');
  }

  press(name) {
    this.down.add(name);
    this.fresh.add(name);
  }

  release(name) {
    this.down.delete(name);
  }

  held(name) {
    return this.down.has(name);
  }

  pressed(name) {
    if (!this.fresh.has(name)) return false;
    this.fresh.delete(name);
    return true;
  }

  /** Walk toward a point: the move axis and the facing both follow it. */
  walkToward(world, x, y) {
    const player = world.player;
    const dx = x - player.x;
    const dy = y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    this.move = { x: dx / length, y: dy / length, length: 1 };
    this.aim = { x: dx / length, y: dy / length };
  }

  /** Drive toward a point: full throttle when the nose is close to the bearing, and a bank. */
  driveToward(world, x, y, aggression = 1) {
    const car = world.vehicle;
    if (!car) return;
    const desired = Math.atan2(y - car.y, x - car.x);
    let difference = desired - car.angle;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    this.release('left');
    this.release('right');
    if (difference > 0.03) this.press('right');
    else if (difference < -0.03) this.press('left');
    if (Math.abs(difference) < 0.9) this.press('up');
    else this.release('up');
    if (aggression < 1 && Math.abs(car.speed) > 210) this.release('up');
    this.aim = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  }

  endStep() {
    this.fresh.clear();
  }
}

/** Put the player on a stretch of sidewalk with a bearing to walk on. */
function standOnFoot(world, x, y) {
  world.playerInVehicle = false;
  world.vehicle = null;
  world.player.x = x;
  world.player.y = y;
  world.player.health = PLAYER.health;
  world.player.dead = false;
}

/** Put the player behind the wheel of a fresh car, rolling down the street. */
function seatInCar(world, x, y, angle, kind = 'sport', speed = 150) {
  const car = new Vehicle(x, y, angle, kind, world.rng);
  car.seat('player', 'driving');
  car.stolen = true;
  car.speed = speed;
  world.vehicles.push(car);
  world.vehicle = car;
  world.playerInVehicle = true;
  world.player.x = x;
  world.player.y = y;
  return car;
}

/** Line the pavement with onlookers so a downtown corner reads as a crowd. */
function gatherCrowd(world, x, y, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + world.rng.range(-0.3, 0.3);
    const distance = world.rng.range(42, 130);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (world.city.isSolid(px, py, 8) || world.city.beyondWater(px)) continue;
    world.peds.push(new Pedestrian(px, py, world.rng, 'walker', world.city.districtAtPoint(px, py)));
  }
}

/** Bring cruisers in on the player from behind, lights on, ready to be chased. */
function bringPolice(world, count, behindX, behindY) {
  for (let index = 0; index < count; index += 1) {
    const x = behindX + (index - (count - 1) / 2) * 7;
    const y = behindY + index * 128;
    const car = new Vehicle(x, y, Math.atan2(world.player.y - y, world.player.x - x), 'police', world.rng);
    car.seat('police', 'driving');
    car.siren = true;
    car.speed = 236;
    world.vehicles.push(car);
  }
}

/** Run the world forward for `seconds` with `steer(world, input, elapsed)` on the controls. */
function play(world, seconds, input, steer) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const elapsed = index * STEP;
    if (steer) steer(world, input, elapsed);
    world.marker = currentMarker(world);
    world.step(STEP, input);
  }
  world.marker = currentMarker(world);
}

/** Bring the city to life around wherever the player happens to be. */
function warmUp(world, seconds = 4) {
  const input = new ScriptInput();
  play(world, seconds, input, null);
}

/** Stop the frame: no more steps, so the screenshot shows exactly what the scene set up. */
function freeze(world) {
  world.frozen = true;
  return world;
}

/**
 * Build the named scene on top of the world (start, street, drive, chase, shootout) and hand it
 * back for the renderer. Unknown names fall back to the title card.
 */
export function stageShot(name, world) {
  world.reset(world.seed);
  world.clock = 0.7;
  world.cash = 1840;
  const input = new ScriptInput();
  const seedSeed = world.seed;
  if (name === 'start') {
    warmUp(world, 3);
    return { screen: 'title', world: freeze(world) };
  }

  if (name === 'street') {
    // On foot on a midtown boulevard: a crowd, two ways of traffic and the minimap in use.
    const at = { x: 6 * CELL + 34, y: 8 * CELL + 34 };
    standOnFoot(world, at.x, at.y);
    world.camera.x = at.x + 120;
    world.camera.y = at.y + 40;
    gatherCrowd(world, at.x + 70, at.y + 50, 32);
    world.notify('Midtown — Avenida del Sol at rush hour', 'objective');
    play(world, 8, input, (universe, hand, elapsed) => {
      const target = elapsed < 5 ? { x: at.x + 210, y: at.y + 30 } : { x: at.x + 320, y: at.y + 150 };
      hand.walkToward(universe, target.x, target.y);
      hand.run = true;
      hand.aim = { x: Math.cos(elapsed * 1.2), y: Math.sin(elapsed * 1.2) };
    });
    return { screen: 'play', world: freeze(world) };
  }

  if (name === 'coast') {
    // The coast road at Playa Coral: sea and sand on one side, palms and umbrellas on the other.
    const car = seatInCar(world, CELL * 12 - 14, 8.6 * CELL, -Math.PI / 2, 'sport', 195);
    car.colour = '#e6e6e0';
    world.camera.x = car.x + 380;
    world.camera.y = car.y - 120;
    world.cash = 3460;
    world.stats.jobs = 2;
    world.notify('Playa Coral — the coast road north', 'objective');
    play(world, 4.5, input, (universe, hand) => hand.driveToward(universe, CELL * 12 - 14, 2.5 * CELL, 0.85));
    return { screen: 'play', world: freeze(world) };
  }

  if (name === 'drive') {
    // Driving a stolen Sombra up the Neon Strip, traffic on both sides and the HUD lit up.
    const car = seatInCar(world, 8.5 * CELL, 7.4 * CELL + 220, -Math.PI / 2, 'sport', 200);
    car.colour = '#e8c246';
    world.camera.x = car.x;
    world.camera.y = car.y;
    world.cash = 2640;
    world.notify('Neon Strip — the Sombra is running sweet', 'objective');
    world.stats.stolen = 3;
    play(world, 4.2, input, (universe, hand) => hand.driveToward(universe, 8.5 * CELL + 200, 4.0 * CELL));
    return { screen: 'play', world: freeze(world) };
  }

  if (name === 'chase') {
    // Three stars on Avenida del Sol: the police behind, the objective ahead, the minimap busy.
    world.mission.index = 4;
    world.mission.active = MISSIONS[4];
    world.mission.step = 2;
    world.mission.target = { x: GARAGE.x, y: GARAGE.y };
    world.mission.remaining = 0;
    unlockWeapon(world.player.arsenal, 'smg');
    giveAmmo(world.player.arsenal, 'smg', 120);
    selectWeapon(world.player.arsenal, 2);
    const car = seatInCar(world, 6 * CELL + 14, 8.4 * CELL, -Math.PI / 2, 'sport', 230);
    car.colour = '#e8c246';
    world.camera.x = car.x;
    world.camera.y = car.y - 40;
    world.player.health = 74;
    world.player.armour = 42;
    world.heat = 3.1;
    world.stars = 3;
    bringPolice(world, 3, car.x, car.y + 170);
    world.notify('Wanted level 3 — get the take to the Marina Real', 'big');
    play(world, 1.7, input, (universe, hand, elapsed) => {
      hand.driveToward(universe, 6 * CELL + 14, 4.2 * CELL);
      if (elapsed > 0.6) hand.aim = { x: -Math.sin(universe.vehicle.angle), y: Math.cos(universe.vehicle.angle) };
    });
    return { screen: 'play', world: freeze(world) };
  }

  if (name === 'shootout') {
    // The Vela Lounge on the Neon Strip: Los Cuervos, muzzle flashes, a pistol at work.
    startMission(world, 2);
    world.mission.step = 1;
    world.peds = world.peds.filter((ped) => ped.kind !== 'enforcer');
    const lounge = { x: 8 * CELL - 20, y: 7 * CELL + 20 };
    standOnFoot(world, lounge.x + 120, lounge.y + 96);
    world.camera.x = lounge.x + 60;
    world.camera.y = lounge.y + 40;
    unlockWeapon(world.player.arsenal, 'pistol');
    giveAmmo(world.player.arsenal, 'pistol', 48);
    selectWeapon(world.player.arsenal, 1);
    world.player.health = 62;
    world.heat = 1.4;
    world.stars = 2;
    world.stats.kills = 2;
    const enforcers = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      const guard = new Pedestrian(lounge.x + Math.cos(angle) * 90, lounge.y + Math.sin(angle) * 90, world.rng, 'enforcer', 'strip');
      guard.alerted = true;
      guard.health = 70;
      world.peds.push(guard);
      enforcers.push(guard);
    }
    world.notify('HOT STRIP — clear the Vela Lounge', 'objective');
    world.stats.kills = 3;
    enforcers[3].kill(world, 'player');
    play(world, 2.7, input, (universe, hand, elapsed) => {
      const target = enforcers[1];
      const angle = Math.atan2(target.y - universe.player.y, target.x - universe.player.x);
      hand.aim = { x: Math.cos(angle), y: Math.sin(angle) };
      hand.move = { x: 0, y: 0, length: 0 };
      if (elapsed > 0.7 && elapsed < 1.6) hand.press('attack');
      else hand.release('attack');
      if (elapsed > 2.35 && !hand.held('attack')) hand.press('attack');
    });
    return { screen: 'play', world: freeze(world) };
  }

  if (name === 'docks') {
    // The Muelle Viejo heist: an armoured van, the payroll objective and the force closing in.
    world.mission.index = 4;
    world.mission.active = MISSIONS[4];
    world.mission.step = 2;
    world.mission.target = { x: GARAGE.x, y: GARAGE.y };
    const car = seatInCar(world, 1.2 * CELL, 4.0 * CELL, 0, 'van', 120);
    car.colour = '#e6e6e0';
    world.camera.x = car.x;
    world.camera.y = car.y;
    world.cash = 12400;
    world.heat = 2.2;
    world.stars = 3;
    bringPolice(world, 1, car.x, car.y - 260);
    world.notify('MARINA SCORE — the payroll is loaded', 'big');
    play(world, 2.4, input, (universe, hand) => hand.driveToward(universe, 4 * CELL, 4.4 * CELL));
    return { screen: 'play', world: freeze(world) };
  }

  warmUp(world, 3);
  void COLORS;
  void WORLD;
  void seedSeed;
  return { screen: 'title', world: freeze(world) };
}

/** The scenes shots.json names, in the order they are taken. */
export const SHOT_SCENES = ['chase', 'street', 'coast', 'shootout'];
