// The world: Velamar, the player, the traffic and the crowd, the bullets in the air, the missions
// on the go and the clock over it all. One step of `dt` moves everything, and the renderer only
// ever reads this state.
import { STEP, CELL, PLAYER, COLORS, CRIME, DAY_SECONDS, START_CLOCK, CAMERA, WORLD, SEA_END, SEA_EDGE, COAST_X, POPULATION, CAR } from './config.js';
import { Rng, mixSeed } from './random.js';
import { buildCity } from './city.js';
import { spawnCrowd, Pedestrian, updatePeds } from './people.js';
import { spawnTraffic, spawnParked, updateLaneTraffic, driveVehicle, resolveVehicleContacts, runOverCheck, nearestVehicle, CAR_KINDS } from './traffic.js';
import { makeArsenal, advanceWeapons, fireWeapon, currentWeapon, ammoOf, selectWeapon, cycleWeapon, giveAmmo, unlockWeapon } from './weapons.js';
import { addHeat, coolHeat, updatePolice } from './police.js';
import { makeMissionState, updateMission, startMission, failMission, currentMarker, MISSIONS, startActivity, GARAGE, ACTIVITY } from './missions.js';

/** Where the player wakes up after a night in the cells, and where a new game starts. */
export const SAFEHOUSE = GARAGE;

export class World {
  constructor(seed = 20261118) {
    this.seed = seed;
    this.reset(seed);
  }

  /** Everything a new game (or a restart) begins with. The city itself is built once a seed. */
  reset(seed = this.seed) {
    this.seed = seed;
    if (!this.city || this.city.seed !== seed) this.city = buildCity(seed);
    this.rng = new Rng(mixSeed(seed, 4242));
    this.crime = CRIME;
    this.time = 0;
    this.clock = START_CLOCK;
    this.day = 1;
    this.cash = 400;
    this.heat = 0;
    this.stars = 0;
    this.heatTimer = 0;
    this.spawnCooldown = 0;
    this.godMode = false;
    this.paused = false;
    this.shakeAmount = 0;
    this.bullets = [];
    this.particles = [];
    this.decals = [];
    this.marks = [];
    this.notifications = [];
    this.sounds = [];
    this.pickups = [];
    this.mission = makeMissionState();
    this.stats = { kills: 0, stolen: 0, driven: 0, missions: 0, jobs: 0, busted: 0, distance: 0 };
    this.player = {
      x: GARAGE.x + 40,
      y: GARAGE.y + 30,
      angle: 0,
      vx: 0,
      vy: 0,
      health: PLAYER.health,
      armour: 0,
      dead: false,
      deadTimer: 0,
      busted: false,
      walkPhase: 0,
      regenTimer: 0,
      hitAndRun: 0,
      arsenal: makeArsenal(0),
      speed: 0,
    };
    this.vehicles = [];
    this.peds = [];
    this.vehicle = null;
    this.playerInVehicle = false;
    this.camera = { x: this.player.x, y: this.player.y, zoom: CAMERA.zoom, shakeX: 0, shakeY: 0 };
    this.aim = { x: 1, y: 0 };
    this.prompt = '';
    this.recycleTimer = 0;
    this.crowd = spawnCrowd(this, POPULATION.crowd);
    this.peds = this.crowd;
    this.vehicles = spawnTraffic(this, POPULATION.traffic).concat(spawnParked(this, 22));
    this.spawnPickups(30);
    this.unlockForProgress(0);
  }

  /** Weapons arrive with the story: a pistol once the first job is done, and so on. */
  unlockForProgress(index) {
    if (index >= 1) unlockWeapon(this.player.arsenal, 'pistol');
    if (index >= 2) unlockWeapon(this.player.arsenal, 'smg');
    if (index >= 3) unlockWeapon(this.player.arsenal, 'shotgun');
    selectWeapon(this.player.arsenal, Math.max(1, Math.min(3, index)));
  }

  // --- small services the systems share ---------------------------------------------------------

  notify(text, kind = 'info') {
    this.notifications.push({ text, kind, life: kind === 'big' ? 4.5 : kind === 'objective' ? 5 : 2.6 });
    if (this.notifications.length > 4) this.notifications.shift();
  }

  shake(amount) {
    this.shakeAmount = Math.min(CAMERA.shake_max, Math.max(this.shakeAmount, amount));
  }

  /** One of the named effects: sparks, muzzle flash, blood, smoke, an explosion ring. */
  spawnEffect(x, y, kind) {
    const count = kind === 'explosion' ? 30 : kind === 'blood' ? 12 : kind === 'muzzle' ? 5 : 8;
    for (let index = 0; index < count; index += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = kind === 'explosion' ? this.rng.range(80, 320) : kind === 'blood' ? this.rng.range(20, 90) : this.rng.range(40, 160);
      const colour = kind === 'blood' ? COLORS.blood
        : kind === 'muzzle' ? COLORS.headlight
        : kind === 'explosion' ? this.rng.pick([COLORS.fire, COLORS.spark, COLORS.smoke])
        : kind === 'swing' ? '#ffffff'
        : this.rng.pick([COLORS.spark, '#ffffff', COLORS.smoke]);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: kind === 'explosion' ? this.rng.range(0.6, 1.6) : this.rng.range(0.18, 0.55),
        max: 1.6,
        kind,
        colour,
        r: kind === 'smoke' ? 8 : kind === 'muzzle' ? 5.5 : kind === 'blood' ? 3.5 : 2.5,
      });
    }
    if (kind === 'explosion') {
      this.spawnSound('explosion', { x, y });
      this.shake(14);
      this.decals.push({ x, y, r: 26, colour: 'rgba(28,20,18,0.45)', life: 900 });
    }
  }

  spawnSound(name, at) {
    const distance = Math.hypot((at?.x ?? 0) - this.camera.x, (at?.y ?? 0) - this.camera.y);
    this.sounds.push({ name, distance, x: at?.x ?? 0, y: at?.y ?? 0 });
    if (this.sounds.length > 24) this.sounds.shift();
  }

  // --- heat and damage -------------------------------------------------------------------------

  addHeat(amount) {
    addHeat(this, amount);
  }

  addHeatForMission(amount) {
    this.heat = Math.max(this.heat, amount);
    this.heatTimer = 0;
    const stars = Math.ceil(this.heat);
    if (stars > this.stars) {
      this.stars = stars;
      this.notify(`Wanted level ${stars}`, 'big');
    }
  }

  /** A round from a cop or an enforcer, aimed at where the player is. */
  copShoot(x, y, targetX, targetY, spread) {
    const angle = Math.atan2(targetY - y, targetX - x) + (this.rng.next() - 0.5) * spread * 2;
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * 520,
      vy: Math.sin(angle) * 520,
      life: 0.9,
      damage: 7,
      fromPlayer: false,
      colour: '#9fd8ff',
    });
    this.spawnSound('cop_shot', { x, y });
    this.spawnEffect(x, y, 'muzzle');
  }

  /** A fist or a bat: whatever is at arm's length in the swing's way takes the hit. */
  meleeSwing(shooter, range, damage, isPlayer) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const distance = Math.hypot(ped.x - shooter.x, ped.y - shooter.y);
      if (distance > range + 8) continue;
      const facing = Math.atan2(ped.y - shooter.y, ped.x - shooter.x);
      const difference = Math.abs(((facing - shooter.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (difference > 1.3) continue;
      ped.health -= damage;
      this.spawnEffect(ped.x, ped.y, 'blood');
      if (ped.health <= 0) {
        ped.kill(this, isPlayer ? 'player' : 'other');
        if (isPlayer) this.stats.kills += 1;
      } else if (isPlayer) {
        ped.panic(shooter.x, shooter.y);
        this.addHeat(CRIME.ped_hit);
      }
    }
    if (!isPlayer) return;
    for (const car of this.vehicles) {
      if (car.burnt) continue;
      if (Math.hypot(car.x - shooter.x, car.y - shooter.y) < range + 14) {
        car.hurt(this, damage * 0.8);
        this.addHeat(CRIME.property * 0.5);
      }
    }
  }

  /** The player takes a hit: armour first, then health, and the police are called. */
  damagePlayer(amount, fromX = null, fromY = null) {
    const player = this.player;
    if (player.dead || this.godMode) return;
    if (player.armour > 0) {
      const absorbed = Math.min(player.armour, amount * 0.7);
      player.armour -= absorbed;
      amount -= absorbed;
    }
    player.health -= amount;
    player.regenTimer = 0;
    this.shake(3);
    if (fromX !== null) {
      const angle = Math.atan2(player.y - fromY, player.x - fromX);
      player.vx += Math.cos(angle) * 6;
      player.vy += Math.sin(angle) * 6;
    }
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      player.deadTimer = 0;
      player.busted = this.stars > 0;
      this.stats.busted += player.busted ? 1 : 0;
      this.notify(player.busted ? 'BUSTED' : 'WASTED', 'big');
      this.spawnSound(player.busted ? 'busted' : 'wasted', player);
      this.shake(18);
    }
  }

  // --- pickups -----------------------------------------------------------------------------------

  /** Cash, health, armour and ammo scattered over the sidewalks and lots. */
  spawnPickups(count) {
    const kinds = ['cash', 'cash', 'cash', 'health', 'health', 'ammo', 'ammo', 'armour'];
    for (let index = 0; index < count; index += 1) {
      const spot = this.city.randomRoad(this.rng);
      const x = spot.x + (this.rng.chance(0.5) ? 18 : -18);
      const y = spot.y + (this.rng.chance(0.5) ? 18 : -18);
      if (this.city.isSolid(x, y, 10) || this.city.beyondWater(x)) continue;
      const kind = this.rng.pick(kinds);
      this.pickups.push({ kind, x, y, amount: kind === 'cash' ? this.rng.pick([25, 40, 60, 90]) : 30, bob: this.rng.range(0, 6.28) });
    }
  }

  collectPickups() {
    const player = this.player;
    for (let index = this.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.pickups[index];
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) > 22) continue;
      if (pickup.kind === 'cash') {
        this.cash += pickup.amount;
        this.notify(`+$${pickup.amount}`, 'short');
      } else if (pickup.kind === 'health') {
        player.health = Math.min(PLAYER.health, player.health + pickup.amount);
        this.notify('Health restored', 'short');
      } else if (pickup.kind === 'armour') {
        player.armour = Math.min(100, player.armour + pickup.amount);
        this.notify('Body armour', 'short');
      } else {
        const weapon = this.player.arsenal.weapons.find((entry, slot) => entry.unlocked && slot > 0) ?? { id: 'pistol' };
        giveAmmo(player.arsenal, weapon.id ?? 'pistol', 24);
        this.notify('Ammo found', 'short');
      }
      this.spawnSound('pickup', pickup);
      this.pickups.splice(index, 1);
      this.spawnEffect(pickup.x, pickup.y, 'pickup');
    }
    // The city restocks itself now and then, so it never runs bare.
    if (this.pickups.length < 14 && this.rng.chance(0.01)) this.spawnPickups(4);
  }

  /**
   * Velamar is bigger than the screen: twice a second the traffic and the crowd that have fallen
   * far behind are moved to a street or a pavement just off the edge, so wherever the player goes
   * the city is already busy.
   */
  recyclePopulation(dt) {
    this.recycleTimer += dt;
    if (this.recycleTimer < 0.5) return;
    this.recycleTimer = 0;
    const focus = this.playerInVehicle && this.vehicle ? this.vehicle : this.player;
    for (const car of this.vehicles) {
      if (car.mode !== 'traffic' || car.burnt) continue;
      if (Math.hypot(car.x - focus.x, car.y - focus.y) < POPULATION.recycle) continue;
      this.repositionTraffic(car, focus);
    }
    for (const ped of this.peds) {
      if (ped.dead || ped.kind !== 'walker') continue;
      if (Math.hypot(ped.x - focus.x, ped.y - focus.y) < POPULATION.crowd_recycle) continue;
      this.repositionWalker(ped, focus);
    }
  }

  /** Drop a traffic car into a lane a few hundred metres from the player, out of sight. */
  repositionTraffic(car, focus) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const vertical = this.rng.chance(0.5);
      const offset = this.rng.chance(0.5) ? 14 : -14;
      if (vertical) {
        const coord = (Math.round(focus.x / CELL) + this.rng.int(-3, 3)) * CELL + offset;
        if (coord < 40 || coord > COAST_X) continue;
        const along = Math.max(60, Math.min(WORLD - 60, focus.y + this.rng.range(-POPULATION.recycle, POPULATION.recycle)));
        if (this.city.isSolid(coord, along, 26)) continue;
        car.lane = { axis: 'y', coord, dir: offset > 0 ? -1 : 1, along };
      } else {
        const coord = (Math.round(focus.y / CELL) + this.rng.int(-3, 3)) * CELL + offset;
        if (coord < 40 || coord > WORLD - 40) continue;
        const along = Math.max(60, Math.min(COAST_X - 60, focus.x + this.rng.range(-POPULATION.recycle, POPULATION.recycle)));
        if (this.city.isSolid(along, coord, 26)) continue;
        car.lane = { axis: 'x', coord, dir: offset > 0 ? -1 : 1, along };
      }
      car.x = car.lane.axis === 'y' ? car.lane.coord : car.lane.along;
      car.y = car.lane.axis === 'x' ? car.lane.coord : car.lane.along;
      car.angle = car.lane.axis === 'y'
        ? (car.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (car.lane.dir > 0 ? 0 : Math.PI);
      car.speed = this.rng.range(90, 150);
      car.mode = 'traffic';
      car.driver = 'traffic';
      return true;
    }
    return false;
  }

  /** Move a walker onto a pavement near the player, out of sight, and let it wander on. */
  repositionWalker(ped, focus) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const distance = this.rng.range(560, 980);
      const x = focus.x + Math.cos(angle) * distance;
      const y = focus.y + Math.sin(angle) * distance;
      if (x < 40 || y < 40 || y > WORLD - 40 || this.city.beyondWater(x)) continue;
      if (this.city.isSolid(x, y, PLAYER.radius)) continue;
      if (this.city.isRoad(x, y) && !this.city.isSidewalk(x, y)) continue;
      ped.x = x;
      ped.y = y;
      ped.state = 'walk';
      ped.retarget(this.city);
      return true;
    }
    return false;
  }

  // --- the player's own step ---------------------------------------------------------------------

  /** On foot: walk, run, punch or shoot, steal the nearest car, change weapon. */
  updatePlayerOnFoot(world, input, dt) {
    const player = this.player;
    const speed = input.run ? PLAYER.run : PLAYER.walk;
    const nextX = player.x + input.move.x * speed * dt;
    const nextY = player.y + input.move.y * speed * dt;
    if (!this.city.isSolid(nextX, player.y, PLAYER.radius) && !this.city.beyondWater(nextX + PLAYER.radius)) player.x = nextX;
    if (!this.city.isSolid(player.x, nextY, PLAYER.radius) && !this.city.beyondWater(player.x + PLAYER.radius)) player.y = nextY;
    player.vx = input.move.x * speed;
    player.vy = input.move.y * speed;
    if (input.move.length > 0) {
      player.walkPhase += dt * (input.run ? 13 : 8);
      player.angle = Math.atan2(input.aim.y, input.aim.x);
    } else player.angle = Math.atan2(input.aim.y, input.aim.x);
    if (this.aimDistance > 0) player.angle = Math.atan2(input.aim.y, input.aim.x);
    this.aim = input.aim;
    if (input.attack) fireWeapon(this, player, input.aim, true);
    if (input.pressed('enter')) {
      const car = nearestVehicle(this, player.x, player.y, 62);
      if (car) this.enterVehicle(car);
      else if (this.prompt === 'activity') startActivity(this);
      else if (this.prompt === 'mission') startMission(this, this.mission.index);
    }
  }

  /** In a car: throttle, steering, handbrake, a horn, a drive-by, and getting out. */
  updatePlayerDriving(world, input, dt) {
    const car = this.vehicle;
    const throttle = (input.held('up') ? 1 : 0) - (input.held('down') ? 1 : 0);
    const steer = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const brake = input.held('run');
    driveVehicle(this, car, { throttle, steer, brake }, dt);
    this.stats.driven += Math.abs(car.speed) * dt;
    this.aim = input.aim;
    if (input.attack) fireWeapon(this, { x: car.x, y: car.y, angle: this.player.angle, arsenal: this.player.arsenal }, input.aim, true);
    if (input.pressed('horn')) {
      this.spawnSound('horn', car);
      this.notify('Beep', 'short');
      for (const ped of this.peds) if (Math.hypot(ped.x - car.x, ped.y - car.y) < 90) ped.panic(car.x, car.y);
    }
    if (input.pressed('enter')) this.exitVehicle();
  }

  enterVehicle(car) {
    this.vehicle = car;
    this.playerInVehicle = true;
    car.seat('player', 'driving');
    if (!car.stolen && car.kind !== 'police') {
      car.stolen = true;
      this.stats.stolen += 1;
      this.notify('Car stolen', 'short');
      if (this.rng.chance(0.5)) this.addHeat(0.5);
    }
    this.spawnSound('door', car);
  }

  exitVehicle() {
    const car = this.vehicle;
    if (!car) return;
    car.park();
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 12), y: car.y + Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 12) };
    if (this.city.isSolid(side.x, side.y, PLAYER.radius)) {
      side.x = car.x - Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 12);
      side.y = car.y - Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 12);
    }
    if (!this.city.isSolid(side.x, side.y, PLAYER.radius)) {
      this.player.x = side.x;
      this.player.y = side.y;
    } else {
      this.player.x = car.x;
      this.player.y = car.y;
    }
    this.playerInVehicle = false;
    this.vehicle = null;
    this.spawnSound('door', car);
  }

  // --- the step ------------------------------------------------------------------------------------

  /** One step of the world. `input` is the sampled keyboard and mouse. */
  step(dt, input) {
    this.time += dt;
    this.clock = (this.clock + dt / DAY_SECONDS) % 1;
    const player = this.player;

    if (input) {
      if (input.pressed('w1')) selectWeapon(player.arsenal, 1);
      if (input.pressed('w2')) selectWeapon(player.arsenal, 2);
      if (input.pressed('w3')) selectWeapon(player.arsenal, 3);
      if (input.pressed('w4')) selectWeapon(player.arsenal, 4);
      if (input.pressed('weapon_prev')) cycleWeapon(player.arsenal);
    }

    if (player.dead) {
      player.deadTimer += dt;
      if (player.deadTimer > 2.8) this.respawn();
    } else if (input) {
      if (this.playerInVehicle && this.vehicle) this.updatePlayerDriving(this, input, dt);
      else this.updatePlayerOnFoot(this, input, dt);
      player.regenTimer += dt;
      if (player.regenTimer > PLAYER.regen_delay && player.health < PLAYER.health) {
        player.health = Math.min(PLAYER.health, player.health + PLAYER.regen * dt);
      }
    }
    advanceWeapons(player.arsenal, dt);

    // Traffic holds its lane; anything with a driver takes the physical model.
    for (const car of this.vehicles) {
      if (car.mode === 'traffic') updateLaneTraffic(this, car, dt);
      else if (car.mode === 'driving') driveVehicle(this, car, car.controls, dt);
      if (Math.abs(car.speed) > 40) runOverCheck(this, car);
    }
    resolveVehicleContacts(this);

    updatePeds(this, dt);
    updatePolice(this, dt);
    this.recyclePopulation(dt);
    coolHeat(this, dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updatePrompt(input);
    this.collectPickups();
    updateMission(this, dt);

    // The camera leans the way the player is moving and shakes off the last impact.
    const focusX = this.playerInVehicle && this.vehicle ? this.vehicle.x : player.x;
    const focusY = this.playerInVehicle && this.vehicle ? this.vehicle.y : player.y;
    const leadX = (player.vx + (this.vehicle ? Math.cos(this.vehicle.angle) * this.vehicle.speed * 0.5 : 0)) * CAMERA.lead;
    const leadY = (player.vy + (this.vehicle ? Math.sin(this.vehicle.angle) * this.vehicle.speed * 0.5 : 0)) * CAMERA.lead;
    this.camera.x += (focusX + leadX - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (focusY + leadY - this.camera.y) * Math.min(1, dt * 6);
    this.camera.x = Math.max(200, Math.min(SEA_END - 80, this.camera.x));
    this.camera.y = Math.max(200, Math.min(WORLD - 40, this.camera.y));
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * CAMERA.shake_decay * 2);
    this.camera.shakeX = (this.rng.next() - 0.5) * this.shakeAmount;
    this.camera.shakeY = (this.rng.next() - 0.5) * this.shakeAmount;
    if (this.playerInVehicle) player.x = this.vehicle.x, player.y = this.vehicle.y;

    this.stats.distance += Math.hypot(player.vx, player.vy) * dt;
    if (this.marks.length) {
      for (const mark of this.marks) mark.life -= dt;
      this.marks = this.marks.filter((mark) => mark.life > 0);
    }
    if (this.decals.length) for (const decal of this.decals) decal.life -= dt;
    for (const notification of this.notifications) notification.life -= dt;
    this.notifications = this.notifications.filter((notification) => notification.life > 0);
  }

  /** Walk into a marker and the HUD offers the job; the prompt names what E would start. */
  updatePrompt(input) {
    this.prompt = '';
    const marker = currentMarker(this);
    const player = this.player;
    if (!marker) return;
    const distance = Math.hypot(player.x - marker.x, player.y - marker.y);
    if (distance > 70) return;
    if (this.mission.active) return;
    if (marker.kind === 'mission' && this.mission.index < MISSIONS.length) {
      this.prompt = 'mission';
      if (input && input.pressed('enter')) startMission(this, this.mission.index);
    } else if (marker.kind === 'done') {
      this.prompt = 'activity';
      if (input && input.pressed('enter')) startActivity(this);
    }
  }

  updateBullets(dt) {
    const survivors = [];
    for (const bullet of this.bullets) {
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      const steps = Math.max(1, Math.ceil(Math.hypot(bullet.vx, bullet.vy) * dt / 12));
      let alive = true;
      for (let stepIndex = 0; stepIndex < steps && alive; stepIndex += 1) {
        bullet.x += (bullet.vx * dt) / steps;
        bullet.y += (bullet.vy * dt) / steps;
        if (this.city.isSolid(bullet.x, bullet.y, 2) || this.city.beyondWater(bullet.x)) {
          this.spawnEffect(bullet.x, bullet.y, 'sparks');
          alive = false;
          break;
        }
        alive = !this.bulletHits(bullet);
      }
      if (alive) survivors.push(bullet);
    }
    this.bullets = survivors;
  }

  /** What a bullet found on its way: a body, a windscreen or the player. */
  bulletHits(bullet) {
    if (!bullet.fromPlayer) {
      const player = this.player;
      if (!player.dead && Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER.radius + 3) {
        this.damagePlayer(bullet.damage, bullet.x, bullet.y);
        this.spawnEffect(bullet.x, bullet.y, 'blood');
        return true;
      }
    }
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) > 9) continue;
      if (!bullet.fromPlayer && (ped.kind === 'enforcer' || ped.kind === 'officer')) continue;
      ped.health -= bullet.damage;
      this.spawnEffect(ped.x, ped.y, 'blood');
      if (ped.health <= 0) {
        ped.kill(this, bullet.fromPlayer ? 'player' : 'other');
        if (bullet.fromPlayer) {
          this.stats.kills += 1;
          if (ped.kind === 'officer') this.addHeat(CRIME.cop_kill);
        }
      } else if (bullet.fromPlayer) ped.panic(bullet.x, bullet.y);
      return true;
    }
    for (const car of this.vehicles) {
      if (car.burnt) continue;
      if (Math.hypot(car.x - bullet.x, car.y - bullet.y) > car.width + 6) continue;
      car.hurt(this, bullet.damage * 0.5);
      this.spawnEffect(bullet.x, bullet.y, 'sparks');
      if (car.driver === 'police' && bullet.fromPlayer) this.addHeat(CRIME.cop_hit * 0.3);
      return true;
    }
    return false;
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  /** Back on the street after a night in the cells (or the hospital). */
  respawn() {
    const player = this.player;
    const busted = player.busted;
    if (busted && this.cash > 0) {
      const fee = Math.round(this.cash * CRIME.bust_fee);
      this.cash -= fee;
      this.notify(`Bail and fines  -$${fee}`, 'big');
    }
    player.health = PLAYER.health;
    player.armour = 0;
    player.dead = false;
    player.deadTimer = 0;
    player.busted = false;
    player.x = SAFEHOUSE.x + 30;
    player.y = SAFEHOUSE.y + 24;
    player.vx = 0;
    player.vy = 0;
    this.heat = 0;
    this.stars = 0;
    this.heatTimer = 0;
    this.playerInVehicle = false;
    this.vehicle = null;
    this.bullets = [];
    if (this.mission.active) failMission(this, busted ? 'the police got there first' : 'you went down');
    for (const ped of this.peds) if (ped.kind === 'enforcer' || ped.kind === 'officer') ped.dead = true;
    for (const car of this.vehicles) if (car.kind === 'police') car.retire = true;
  }

  /** The save file: everything that must come back with a loaded game. */
  snapshot() {
    return {
      seed: this.seed,
      cash: this.cash,
      clock: this.clock,
      day: this.day,
      stats: { ...this.stats },
      missionIndex: this.mission.index,
      completed: [...this.mission.completed],
      health: Math.round(this.player.health),
      armour: Math.round(this.player.armour),
      weapons: this.player.arsenal.weapons.map((entry) => ({ id: entry.id, ammo: entry.ammo, unlocked: entry.unlocked })),
      weaponIndex: this.player.arsenal.index,
    };
  }

  restore(data) {
    if (!data) return false;
    this.reset(data.seed ?? this.seed);
    this.cash = data.cash ?? this.cash;
    this.clock = data.clock ?? this.clock;
    this.day = data.day ?? 1;
    Object.assign(this.stats, data.stats ?? {});
    this.mission.index = Math.min(MISSIONS.length - 1, data.missionIndex ?? 0);
    this.mission.completed = data.completed ?? [];
    this.player.health = data.health ?? PLAYER.health;
    this.player.armour = data.armour ?? 0;
    if (Array.isArray(data.weapons)) {
      for (const saved of data.weapons) {
        const slot = this.player.arsenal.weapons.find((entry) => entry.id === saved.id);
        if (slot) {
          slot.ammo = saved.ammo;
          slot.unlocked = saved.unlocked;
        }
      }
    }
    this.unlockForProgress(this.mission.index);
    if (this.mission.completed.length >= MISSIONS.length) this.notify('The Marina Real is paid', 'short');
    return true;
  }

  /** The clock as the HUD writes it: 18:42, one in-game day every DAY_SECONDS. */
  clockText() {
    const minutes = Math.floor(this.clock * 24 * 60) % (24 * 60);
    const hours = Math.floor(minutes / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  /** 0 = midnight, 1 = the following midnight: what the light and the tint follow. */
  light() {
    return this.clock;
  }
}
