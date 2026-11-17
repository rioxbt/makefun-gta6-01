// The story of Velamar Heat and the jobs that carry it: five chapters for Delia Marchetti's
// crew, each a short chain of objectives, plus the repeatable courier work that pays the bills
// between them. A mission is a list of steps the world checks every frame; the marker the HUD
// points at is always the one the current step asks for.
import { CELL, COLORS } from './config.js';
import { Pedestrian } from './people.js';
import { Vehicle } from './traffic.js';

/** Where the crew's garage sits: the corner the HUD calls home and the jobs are handed out from. */
export const GARAGE = { x: 2 * CELL - 18, y: 8 * CELL - 18 };

/** A point on a road at (cx, cy) in the grid, nudged by (ox, oy) pixels. */
function point(cx, cy, ox = 0, oy = 0) {
  return { x: cx * CELL + ox, y: cy * CELL + oy };
}

/**
 * The five chapters, in order. Each step names what it wants, and `story` is the line the HUD
 * shows when the job is taken. A step runs until the world's mission engine is satisfied.
 */
export const MISSIONS = [
  {
    id: 'courier',
    name: 'COURIER RUN',
    client: 'Delia Marchetti',
    story: 'Delia needs a locked case moved across Velamar before midnight, and she needs it moved quietly.',
    reward: 250,
    steps: [
      { kind: 'goto', label: 'Collect the case from the callejon behind Avenida del Sol', at: point(4, 4, -20, 20), radius: 46, onFoot: true, hint: 'Case' },
      { kind: 'goto', label: 'Run the case to the Marina Real lock-up', at: { x: GARAGE.x, y: GARAGE.y }, radius: 52, hint: 'Delia' },
    ],
  },
  {
    id: 'wheelman',
    name: 'WHEELMAN WORK',
    client: 'Tito Marchetti',
    story: 'A customer at the Neon Strip left a car she wants back. Take it to the marina and leave the keys.',
    reward: 450,
    steps: [
      { kind: 'steal', label: 'Steal the gold Sombra MS parked off the Neon Strip', at: point(8, 6, 40, -30), radius: 60, kindName: 'sport' },
      { kind: 'deliver', label: 'Drive the Sombra to the Marina Real lock-up', at: { x: GARAGE.x, y: GARAGE.y }, radius: 58, needVehicle: true, heat: 1 },
    ],
  },
  {
    id: 'hotstrip',
    name: 'HOT STRIP',
    client: 'Delia Marchetti',
    story: 'Los Cuervos are leaning on the Neon Strip, and Delia will not pay them. Tito is inside the Vela Lounge.',
    reward: 700,
    steps: [
      { kind: 'goto', label: 'Get to the Vela Lounge on the Neon Strip', at: point(8, 7, -20, 20), radius: 60 },
      { kind: 'kill', label: 'Clear Los Cuervos out of the Vela Lounge', at: point(8, 7, -20, 20), count: 3, spread: 120 },
      { kind: 'escape', label: 'Lose the police before they pin you down', stars: 0 },
    ],
  },
  {
    id: 'colonel',
    name: 'THE COLONEL',
    client: 'Delia Marchetti',
    story: 'Colonel Vega raided the Muelle Viejo warehouse. His detail is still there, and so is the payroll.',
    reward: 1100,
    steps: [
      { kind: 'goto', label: 'Reach the Muelle Viejo warehouses', at: point(1, 5, 20, 20), radius: 70, heat: 1 },
      { kind: 'kill', label: 'Take the Colonel\'s detail apart', at: point(1, 5, 20, 20), count: 4, spread: 150, armed: true },
      { kind: 'goto', label: 'Grab the payroll case from the wharf', at: point(0, 4, 24, -20), radius: 44, onFoot: true, hint: 'Payroll' },
      { kind: 'escape', label: 'Get the payroll out of the docks', stars: 0 },
    ],
  },
  {
    id: 'marina',
    name: 'MARINA SCORE',
    client: 'Delia Marchetti',
    story: 'One banker, one armoured van, one afternoon: the last job Delia intends to run in Velamar.',
    reward: 2500,
    steps: [
      { kind: 'steal', label: 'Take the armoured van at the Muelle Viejo yard', at: point(0, 3, 30, 30), radius: 64, kindName: 'van' },
      { kind: 'goto', label: 'Park the van at the Banco Solargo on the downtown grid', at: point(6, 5, 14, -14), radius: 60, needVehicle: true, heat: 2, wait: 8 },
      { kind: 'deliver', label: 'Run the take to the Marina Real while the force is out', at: { x: GARAGE.x, y: GARAGE.y }, radius: 60, needVehicle: true, heat: 3 },
    ],
  },
];

/** The courier board: short repeatable work that always pays and keeps the city in use. */
export const ACTIVITY = {
  id: 'courier-board',
  name: 'COURIER BOARD',
  reward: 140,
  bonusPerSecond: 9,
  limit: 60,
};

/** The state a fresh game or a fresh job starts from. */
export function makeMissionState() {
  return {
    index: 0,
    step: -1,
    active: null,
    status: 'idle',
    kills: 0,
    timer: 0,
    wait: 0,
    target: null,
    vehicle: null,
    car: null,
    marker: null,
    message: '',
    completed: [],
    failed: 0,
    activity: null,
  };
}

/** The marker the HUD, the minimap and the on-screen compass all point at. */
export function currentMarker(world) {
  const mission = world.mission;
  if (mission.active) {
    const step = mission.active.steps[mission.step];
    if (!step) return null;
    if (step.kind === 'kill') return mission.target ? { x: mission.target.x, y: mission.target.y, kind: 'kill', label: step.label } : null;
    if (step.kind === 'steal') return mission.car ? { x: mission.car.x, y: mission.car.y, kind: 'steal', label: step.label } : null;
    if (step.kind === 'escape') return null;
    if (step.kind === 'goto' && mission.step + 1 < mission.active.steps.length && mission.step === 0 && mission.active.steps[0].hint) {
      return { x: mission.target.x, y: mission.target.y, kind: 'objective', label: step.label };
    }
    return { x: mission.target.x, y: mission.target.y, kind: 'objective', label: step.label };
  }
  if (mission.activity) {
    const activity = mission.activity;
    return { x: activity.target.x, y: activity.target.y, kind: activity.phase === 'pickup' ? 'pickup' : 'objective', label: activity.phase === 'pickup' ? 'Courier parcel' : 'Drop the parcel' };
  }
  if (mission.completed.length >= MISSIONS.length) return { x: GARAGE.x, y: GARAGE.y, kind: 'done', label: 'The Marina Real' };
  const next = MISSIONS[mission.index];
  return next ? { x: GARAGE.x, y: GARAGE.y, kind: 'mission', label: next.name } : null;
}

/** Start the next chapter: put its first objective up and stage whatever it needs. */
export function startMission(world, index = world.mission.index) {
  const mission = MISSIONS[index];
  if (!mission) return false;
  const state = world.mission;
  state.index = index;
  state.active = mission;
  state.step = 0;
  state.status = 'active';
  state.kills = 0;
  state.wait = 0;
  state.timer = 0;
  world.notify(`${mission.name} — ${mission.client}`, 'big');
  prepareStep(world, mission.steps[0]);
  return true;
}

/** Set up whatever the current step needs: a marked car, a crew of enforcers, a timer. */
export function prepareStep(world, step) {
  const state = world.mission;
  state.timer = 0;
  state.wait = step.wait ?? 0;
  if (step.kind === 'steal') {
    const car = new Vehicle(step.at.x, step.at.y, world.rng.chance(0.5) ? 0 : Math.PI / 2, step.kindName ?? 'sport', world.rng, '#e8c246');
    car.park();
    car.mission = state.active.id;
    world.vehicles.push(car);
    state.car = car;
    state.target = { x: step.at.x, y: step.at.y };
  } else if (step.kind === 'kill') {
    state.target = { x: step.at.x, y: step.at.y };
    state.kills = 0;
    for (let guard = 0; guard < step.count + 1; guard += 1) {
      const angle = (guard / (step.count + 1)) * Math.PI * 2 + world.rng.range(0, 1);
      const distance = world.rng.range(20, step.spread ?? 110);
      const x = step.at.x + Math.cos(angle) * distance;
      const y = step.at.y + Math.sin(angle) * distance;
      if (world.city.isSolid(x, y, 10)) continue;
      const enforcer = new Pedestrian(x, y, world.rng, 'enforcer', world.city.districtAtPoint(x, y));
      enforcer.alerted = true;
      enforcer.armed = step.armed ?? true;
      enforcer.health = 70;
      world.peds.push(enforcer);
    }
  } else {
    state.target = { x: step.at.x, y: step.at.y };
    state.car = state.car ?? null;
  }
}

/** The world's own check for the step in front of the player. */
export function updateMission(world, dt) {
  const state = world.mission;
  if (!state.active) {
    updateActivity(world, dt);
    return;
  }
  const step = state.active.steps[state.step];
  if (!step) return completeMission(world);
  state.timer += dt;
  const player = world.player;
  if (step.kind === 'goto') {
    const distance = Math.hypot(player.x - state.target.x, player.y - state.target.y);
    if (distance < step.radius) {
      if (step.onFoot && world.playerInVehicle) {
        world.notify('Get out of the car', 'short');
        return;
      }
      if (step.wait > 0) {
        state.wait -= dt;
        if (state.wait <= 0) {
          if (step.heat) world.addHeatForMission(step.heat);
          advanceStep(world);
        }
        return;
      }
      if (step.heat) world.addHeatForMission(step.heat);
      advanceStep(world);
    }
  } else if (step.kind === 'steal') {
    if (state.car) {
      state.target = { x: state.car.x, y: state.car.y };
      if (world.vehicle === state.car) {
        world.notify('Car taken — deliver it', 'short');
        advanceStep(world);
      }
    }
  } else if (step.kind === 'deliver') {
    const distance = Math.hypot(player.x - state.target.x, player.y - state.target.y);
    if (distance < step.radius && (!step.needVehicle || world.vehicle === state.car || world.playerInVehicle)) {
      if (step.heat) world.addHeatForMission(step.heat);
      advanceStep(world);
    }
  } else if (step.kind === 'kill') {
    const remaining = world.peds.filter((ped) => ped.kind === 'enforcer' && !ped.dead && Math.hypot(ped.x - state.target.x, ped.y - state.target.y) < 420).length;
    state.remaining = remaining;
    if (remaining === 0) advanceStep(world);
  } else if (step.kind === 'escape') {
    if (world.stars <= (step.stars ?? 0)) {
      world.notify('You lost them', 'short');
      advanceStep(world);
    }
  }
}

/** Step forward, or finish the chapter when there is nothing left to do. */
export function advanceStep(world) {
  const state = world.mission;
  state.step += 1;
  const step = state.active.steps[state.step];
  if (!step) {
    completeMission(world);
    return;
  }
  prepareStep(world, step);
  world.notify(step.label, 'objective');
}

/** Pay the job out, unlock the next chapter and open the weapons it brings. */
export function completeMission(world) {
  const state = world.mission;
  const mission = state.active;
  state.completed.push(mission.id);
  state.status = 'complete';
  state.index = Math.min(MISSIONS.length - 1, state.index + 1);
  state.active = null;
  state.step = -1;
  state.car = null;
  world.cash += mission.reward;
  world.stats.missions += 1;
  world.notify(`${mission.name} complete  +$${mission.reward}`, 'big');
  world.spawnSound('mission', world.player);
  world.unlockForProgress(state.index);
}

/** A job that goes wrong keeps its place: the player can start it again at the marker. */
export function failMission(world, reason) {
  const state = world.mission;
  if (!state.active) return;
  world.notify(`${state.active.name} failed — ${reason}`, 'big');
  world.spawnSound('fail', world.player);
  state.failed += 1;
  state.active = null;
  state.step = -1;
  state.car = null;
}

// --- the repeatable courier work ---------------------------------------------------------------

/** The courier board: pick a parcel up, run it across town, hear the clock tick. */
export function startActivity(world) {
  const state = world.mission;
  const pickupAt = { x: 2.5 * CELL + 20, y: 6.5 * CELL - 20 };
  const targetAt = { x: 10.5 * CELL - 30, y: 3.5 * CELL + 30 };
  state.activity = {
    phase: 'pickup',
    target: pickupAt,
    drop: targetAt,
    limit: ACTIVITY.limit,
    remaining: ACTIVITY.limit,
    carried: false,
  };
  world.notify(`${ACTIVITY.name}: a parcel is waiting on Calle Hierro`, 'objective');
  void COLORS;
}

function updateActivity(world, dt) {
  const activity = world.mission.activity;
  if (!activity) return;
  const player = world.player;
  if (activity.phase === 'pickup') {
    if (Math.hypot(player.x - activity.target.x, player.y - activity.target.y) < 44) {
      activity.phase = 'drop';
      activity.carried = true;
      activity.target = activity.drop;
      world.notify(`Parcel collected — ${ACTIVITY.limit}s to deliver`, 'objective');
    }
    return;
  }
  activity.remaining -= dt;
  if (activity.remaining <= 0) {
    world.mission.activity = null;
    world.notify('The courier run timed out', 'big');
    return;
  }
  if (Math.hypot(player.x - activity.target.x, player.y - activity.target.y) < 48) {
    const bonus = Math.max(0, Math.round(activity.remaining * ACTIVITY.bonusPerSecond));
    world.cash += ACTIVITY.reward + bonus;
    world.stats.jobs += 1;
    world.mission.activity = null;
    world.notify(`Parcel delivered  +$${ACTIVITY.reward + bonus}`, 'big');
    world.spawnSound('mission', world.player);
  }
}
