// Guns and fists: what the player carries, when each weapon arrives, the rounds in flight and
// what they leave behind. A round is a point that steps forward and looks for something to hit.
import { WEAPONS } from './config.js';

/** The rack a fresh game starts with; a loaded save fills the same slots back in. */
export function makeArsenal(missionIndex = 0) {
  return {
    index: 1,
    weapons: WEAPONS.map((weapon) => ({
      id: weapon.id,
      ammo: weapon.ammo === Infinity ? Infinity : weapon.ammo,
      unlocked: weapon.unlock <= missionIndex,
      cooldown: 0,
    })),
  };
}

export function currentWeapon(arsenal) {
  return WEAPONS[arsenal.index];
}

/** Hand a weapon over early (a story reward or a pickup). Answers whether it was new. */
export function unlockWeapon(arsenal, id) {
  const slot = arsenal.weapons.find((entry) => entry.id === id);
  const spec = WEAPONS.find((entry) => entry.id === id);
  if (!slot || !spec) return false;
  const fresh = !slot.unlocked;
  slot.unlocked = true;
  if (slot.ammo !== Infinity && slot.ammo < spec.ammo * 0.3) slot.ammo += Math.ceil(spec.ammo * 0.5);
  return fresh;
}

/** A pickup's rounds: a locked weapon is handed over loaded, an open one just gets more. */
export function giveAmmo(arsenal, id, rounds) {
  const slot = arsenal.weapons.find((entry) => entry.id === id);
  if (!slot) return 0;
  slot.unlocked = true;
  if (slot.ammo === Infinity) return 0;
  slot.ammo += rounds;
  return rounds;
}

/** The number keys: switch to that slot when it is unlocked. */
export function selectWeapon(arsenal, slot) {
  const entry = arsenal.weapons[slot];
  if (!entry || !entry.unlocked) return false;
  arsenal.index = slot;
  return true;
}

/** Q cycles on to the next weapon that is unlocked. */
export function cycleWeapon(arsenal) {
  for (let step = 1; step <= arsenal.weapons.length; step += 1) {
    const index = (arsenal.index + step) % arsenal.weapons.length;
    if (arsenal.weapons[index].unlocked) {
      arsenal.index = index;
      return true;
    }
  }
  return false;
}

export function ammoOf(arsenal) {
  const entry = arsenal.weapons[arsenal.index];
  return entry ? entry.ammo : 0;
}

/** Tick the triggers down with the rest of the world. */
export function advanceWeapons(arsenal, dt) {
  for (const entry of arsenal.weapons) entry.cooldown = Math.max(0, entry.cooldown - dt);
}

/**
 * Pull the trigger: a fist swings, a gun puts its rounds down the aim line. Answers whether the
 * weapon actually fired, so callers can add a muzzle flash or drive-by recoil of their own.
 */
export function fireWeapon(world, shooter, aim, isPlayer) {
  const spec = currentWeapon(shooter.arsenal);
  const slot = shooter.arsenal.weapons[shooter.arsenal.index];
  if (!spec || !slot || slot.cooldown > 0) return false;
  if (slot.ammo <= 0) {
    slot.cooldown = 0.6;
    if (isPlayer) world.notify('Out of ammo — find a crate', 'short');
    return false;
  }
  slot.cooldown = spec.rate;
  if (slot.ammo !== Infinity) slot.ammo -= 1;
  if (spec.count === 0) {
    world.meleeSwing(shooter, spec.range, spec.damage, isPlayer);
    world.spawnEffect(shooter.x + aim.x * 22, shooter.y + aim.y * 22, 'swing');
    return true;
  }
  const base = Math.atan2(aim.y, aim.x);
  for (let pellet = 0; pellet < spec.count; pellet += 1) {
    const angle = base + (world.rng.next() - 0.5) * spec.spread * 2;
    world.bullets.push({
      x: shooter.x + Math.cos(angle) * 16,
      y: shooter.y + Math.sin(angle) * 16,
      vx: Math.cos(angle) * spec.speed,
      vy: Math.sin(angle) * spec.speed,
      life: spec.range / spec.speed,
      damage: spec.damage,
      fromPlayer: isPlayer,
      colour: isPlayer ? '#ffe08a' : '#9fd8ff',
    });
  }
  world.spawnEffect(shooter.x + aim.x * 18, shooter.y + aim.y * 18, 'muzzle');
  if (isPlayer) world.addHeat(world.crime ? world.crime.shot_fired : 0.4);
  world.spawnSound(isPlayer ? 'shot' : 'cop_shot', shooter);
  return true;
}
