// The HUD: money, health and armour, the wanted stars, the objective the job is asking for, the
// weapon in hand, the minimap with its blips, the scene's notices and the clock — everything a
// player needs without looking away from the street.
import { PLAYER, COLORS, WANTED, CRIME } from './config.js';
import { currentWeapon, ammoOf } from './weapons.js';
import { currentMarker, MISSIONS } from './missions.js';
import { locationLine, roundRect } from './render.js';

const FONT = 'system-ui, "DejaVu Sans", "Helvetica Neue", Arial, sans-serif';
const MINIMAP = 196;
const MINIMAP_WORLD = 470;

/** The whole overlay, drawn over the world frame. */
export function drawHud(ctx, world, width, height) {
  ctx.save();
  ctx.textBaseline = 'top';
  drawTopBar(ctx, world);
  drawObjective(ctx, world, width);
  drawWantedStars(ctx, world, width);
  drawWeaponCard(ctx, world, width, height);
  drawMinimap(ctx, world, 22, height - MINIMAP - 26);
  drawNotices(ctx, world, width, height);
  drawCompass(ctx, world, width, height);
  ctx.restore();
}

function panel(ctx, x, y, w, h, alpha = 0.42, radius = 8) {
  ctx.fillStyle = `rgba(14,16,26,${alpha})`;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, value, x, y, size, colour, weight = 'bold', align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(value, x + 1.5, y + 1.5);
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
  ctx.textAlign = 'left';
}

function drawTopBar(ctx, world) {
  panel(ctx, 18, 18, 268, 86);
  text(ctx, `$${world.cash.toLocaleString('en-US')}`, 34, 26, 30, '#f6e08a');
  text(ctx, locationLine(world), 34, 60, 14, '#e6e9f2', 'normal');
  text(ctx, `Day ${world.day}  ${world.clockText()}`, 34, 78, 14, '#9fb2cc', 'normal');
  const badge = world.stars > 0 ? 'CHASE ACTIVE' : world.mission.activity ? 'COURIER RUN' : world.mission.completed.length >= MISSIONS.length ? 'THE MARINA REAL' : 'FREEROAM';
  text(ctx, badge, 240, 30, 12, world.stars > 0 ? '#ff8a7a' : '#8fd4c8', 'bold', 'right');
}

/** The job in hand, what it wants next and how far the marker is. */
function drawObjective(ctx, world, width) {
  const marker = world.marker;
  const mission = world.mission.active;
  const activity = world.mission.activity;
  let title = '';
  let detail = '';
  if (mission) {
    const step = mission.steps[world.mission.step];
    title = `${mission.name} — ${mission.client}`;
    detail = step ? step.label : 'Return to the Marina Real';
    if (step && step.kind === 'kill') detail = `${detail}  (${world.peds.filter((ped) => ped.kind === 'enforcer' && !ped.dead).length} left)`;
  } else if (activity) {
    title = 'COURIER BOARD';
    detail = activity.phase === 'pickup' ? 'Collect the parcel on Calle Hierro' : `Deliver the parcel  ${Math.max(0, Math.ceil(activity.remaining))}s`;
  } else if (world.mission.completed.length >= MISSIONS.length) {
    title = 'ALL JOBS DONE';
    detail = 'Take the courier board at the Marina Real for more work';
  } else {
    const next = MISSIONS[world.mission.index];
    title = `NEXT JOB — ${next.name}`;
    detail = 'Press E at the yellow marker to start';
  }
  const boxWidth = Math.min(660, width - 300);
  const x = (width - boxWidth) / 2;
  panel(ctx, x, 18, boxWidth, 62, 0.46);
  text(ctx, title, x + 14, 25, 15, '#ffd23c');
  text(ctx, detail, x + 14, 46, 19, '#ffffff');
  if (marker) {
    const player = world.playerInVehicle && world.vehicle ? world.vehicle : world.player;
    const distance = Math.round(Math.hypot(marker.x - player.x, marker.y - player.y) / 10);
    text(ctx, `${distance} m`, x + boxWidth - 14, 34, 20, '#8fd4c8', 'bold', 'right');
  }
  if (world.prompt === 'mission' || world.prompt === 'activity') {
    text(ctx, world.prompt === 'mission' ? '[E] START THE JOB' : '[E] TAKE THE COURIER WORK', width / 2, 88, 16, '#f6e08a', 'bold', 'center');
  }
}

/** Five stars to the top right, lit as far as the chase has gone. */
function drawWantedStars(ctx, world, width) {
  const count = WANTED.max;
  const size = 22;
  const startX = width - 24 - count * (size + 6);
  panel(ctx, startX - 12, 18, count * (size + 6) + 22, 44, world.stars > 0 ? 0.5 : 0.3);
  for (let index = 0; index < count; index += 1) {
    const lit = index < world.stars;
    const x = startX + index * (size + 6);
    ctx.save();
    ctx.translate(x, 40);
    starPath(ctx, size * 0.5, size * 0.22);
    ctx.fillStyle = lit ? '#ffd23c' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  if (world.stars > 0) text(ctx, 'WANTED', startX - 12 + count * (size + 6) + 10, 30, 14, '#ff8a7a', 'bold', 'right');
}

function starPath(ctx, outer, inner) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * point - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Health, armour and the weapon in hand, with its ammunition. */
function drawWeaponCard(ctx, world, width, height) {
  const weapon = currentWeapon(world.player.arsenal);
  const ammo = ammoOf(world.player.arsenal);
  panel(ctx, width - 246, height - 122, 224, 96);
  text(ctx, weapon.name.toUpperCase(), width - 232, height - 112, 20, '#ffffff');
  text(ctx, ammo === Infinity ? '—' : `${ammo}`, width - 34, height - 112, 26, ammo === 0 ? '#ff8a7a' : '#f6e08a', 'bold', 'right');
  text(ctx, 'ROUNDS', width - 34, height - 84, 11, '#9fb2cc', 'normal', 'right');
  text(ctx, `Kills ${world.stats.kills}   Steals ${world.stats.stolen}   Jobs ${world.stats.missions + world.stats.jobs}`, width - 232, height - 62, 13, '#c9d4e6', 'normal');
  text(ctx, `1 Fists  2 Pistol  3 SMG  4 Shotgun`, width - 232, height - 44, 12, '#8fa2bb', 'normal');
}

/** The bars over the minimap, the map itself and its blips. */
function drawMinimap(ctx, world, x, y) {
  const size = MINIMAP;
  panel(ctx, x - 4, y - 30, size + 8, size + 34, 0.4);
  ctx.save();
  roundRect(ctx, x, y, size, size, 6);
  ctx.clip();
  const map = world.city.map;
  const sourceSize = MINIMAP_WORLD * map.scale;
  const player = world.playerInVehicle && world.vehicle ? world.vehicle : world.player;
  let sourceX = player.x * map.scale - sourceSize / 2;
  let sourceY = player.y * map.scale - sourceSize / 2;
  sourceX = Math.max(0, Math.min(map.canvas.width - sourceSize, sourceX));
  sourceY = Math.max(0, Math.min(map.canvas.height - sourceSize, sourceY));
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(map.canvas, sourceX, sourceY, sourceSize, sourceSize, x, y, size, size);
  const scale = size / MINIMAP_WORLD;
  const centre = { x: sourceX / map.scale + MINIMAP_WORLD / 2, y: sourceY / map.scale + MINIMAP_WORLD / 2 };
  const place = (worldX, worldY) => ({ x: x + size / 2 + (worldX - centre.x) * scale, y: y + size / 2 + (worldY - centre.y) * scale });
  for (const car of world.vehicles) {
    if (car.burnt) continue;
    const spot = place(car.x, car.y);
    if (spot.x < x + 2 || spot.x > x + size - 2 || spot.y < y + 2 || spot.y > y + size - 2) continue;
    ctx.fillStyle = car.kind === 'police' ? COLORS.blip_cop : 'rgba(220,226,240,0.45)';
    ctx.fillRect(spot.x - 1.5, spot.y - 1.5, car.kind === 'police' ? 5 : 3, car.kind === 'police' ? 5 : 3);
  }
  for (const ped of world.peds) {
    if (ped.dead) continue;
    const spot = place(ped.x, ped.y);
    if (spot.x < x || spot.x > x + size || spot.y < y || spot.y > y + size) continue;
    ctx.fillStyle = ped.kind === 'officer' ? '#7fb0ff' : ped.kind === 'enforcer' ? '#ff7a6a' : 'rgba(240,244,255,0.5)';
    ctx.fillRect(spot.x - 1, spot.y - 1, 2, 2);
  }
  const marker = world.marker;
  if (marker) {
    const spot = place(marker.x, marker.y);
    ctx.fillStyle = marker.kind === 'pickup' ? COLORS.marker_alt : COLORS.marker;
    ctx.beginPath();
    ctx.arc(Math.max(x + 4, Math.min(x + size - 4, spot.x)), Math.max(y + 4, Math.min(y + size - 4, spot.y)), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(player.angle ?? 0);
  ctx.fillStyle = COLORS.blip_player;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, size, size, 6);
  ctx.stroke();
  ctx.fillStyle = 'rgba(6,8,14,0.55)';
  ctx.fillRect(x + 4, y + 4, 26, 14);
  text(ctx, 'N', x + 10, y + 5, 12, '#f6e08a');
  const health = Math.max(0, world.player.health) / PLAYER.health;
  bar(ctx, x - 2, y - 22, size + 4, 9, health, '#4fbf6a', 'HEALTH');
  if (world.player.armour > 0) bar(ctx, x - 2, y - 11, size + 4, 9, world.player.armour / 100, '#5f8fe8', 'ARMOUR');
  if (world.mission.active) {
    text(ctx, 'OBJECTIVE MARKED', x + 4, y + size - 20, 11, '#ffd23c');
  }
}

function bar(ctx, x, y, w, h, fraction, colour, label) {
  ctx.fillStyle = 'rgba(6,8,14,0.65)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = colour;
  roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * fraction), h - 4, 3);
  ctx.fill();
  void label;
}

/** The notices the world pushes: crimes, payouts, jobs taken and lost. */
function drawNotices(ctx, world, width, height) {
  let y = height - 210;
  for (let index = world.notifications.length - 1; index >= 0; index -= 1) {
    const notice = world.notifications[index];
    const alpha = Math.min(1, notice.life);
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, alpha);
    const colour = notice.kind === 'big' ? '#ffd23c' : notice.kind === 'objective' ? '#8fd4c8' : '#ffffff';
    panel(ctx, 250, y, 460, 30, 0.5);
    text(ctx, notice.text, 264, y + 7, notice.kind === 'big' ? 17 : 15, colour);
    ctx.restore();
    y -= 34;
  }
}

/** An arrow at the edge of the screen when the objective is off it. */
function drawCompass(ctx, world, width, height) {
  const marker = world.marker;
  if (!marker) return;
  const player = world.playerInVehicle && world.vehicle ? world.vehicle : world.player;
  const dx = marker.x - player.x;
  const dy = marker.y - player.y;
  const screen = { x: width / 2 + dx, y: height / 2 + dy };
  if (screen.x > 40 && screen.x < width - 40 && screen.y > 40 && screen.y < height - 40) return;
  const angle = Math.atan2(dy, dx);
  const radius = Math.min(width, height) * 0.36;
  const x = width / 2 + Math.cos(angle) * radius;
  const y = height / 2 + Math.sin(angle) * radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = marker.kind === 'pickup' ? COLORS.marker_alt : COLORS.marker;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, `${Math.round(Math.hypot(dx, dy) / 10)} m`, x, y + 16, 14, '#ffffff', 'bold', 'center');
  void CRIME;
}
