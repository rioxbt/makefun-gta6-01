// Drawing Velamar: the asphalt and its paint, blocks of buildings with their shadows, palms and
// lamps along the kerb, cars and people sorted by depth, bullets, sparks and the light of the
// hour. Nothing here changes the world; it only reads it.
import { CELL, ROAD, SIDEWALK, GRID, WORLD, SHORE_EDGE, SEA_EDGE, SEA_END, COLORS, DISTRICTS, PLAYER } from './config.js';

const SUN = { x: 0.2, y: 0.15 };

/** Warm, flat and readable at a glance: the palette the light of the hour paints over the city. */
export function lightTint(clock) {
  const stops = [
    [0.0, [22, 30, 62, 0.5], 0.34],
    [0.2, [30, 40, 74, 0.4], 0.3],
    [0.28, [255, 150, 92, 0.2], 0.24],
    [0.4, [255, 240, 214, 0.04], 0.2],
    [0.58, [255, 236, 196, 0.06], 0.2],
    [0.68, [255, 176, 96, 0.16], 0.26],
    [0.78, [214, 120, 96, 0.24], 0.3],
    [0.86, [90, 74, 150, 0.34], 0.34],
    [1.0, [22, 30, 62, 0.5], 0.34],
  ];
  let before = stops[0];
  let after = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clock >= stops[index][0] && clock <= stops[index + 1][0]) {
      before = stops[index];
      after = stops[index + 1];
      break;
    }
  }
  const span = after[0] - before[0] || 1;
  const t = Math.max(0, Math.min(1, (clock - before[0]) / span));
  const colour = [0, 1, 2, 3].map((channel) => before[1][channel] + (after[1][channel] - before[1][channel]) * t);
  const shadow = before[2] + (after[2] - before[2]) * t;
  const night = clock < 0.24 || clock > 0.86 ? 1 : clock < 0.3 || clock > 0.8 ? (0.3 - Math.min(Math.abs(clock - 0.24), Math.abs(clock - 0.86))) / 0.06 : 0;
  return { tint: `rgba(${Math.round(colour[0])},${Math.round(colour[1])},${Math.round(colour[2])},${colour[3].toFixed(3)})`, shadow, night: Math.max(0, Math.min(1, night)) };
}

/** The whole frame: the city, everything moving on it, then the light over the top. */
export function drawWorld(ctx, world, width, height) {
  const light = lightTint(world.clock);
  ctx.save();
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2 - world.camera.x + world.camera.shakeX, height / 2 - world.camera.y + world.camera.shakeY);
  drawGround(ctx, world);
  drawPaint(ctx, world);
  drawGroundMarks(ctx, world);
  drawShoreline(ctx, world);
  drawPickups(ctx, world);
  drawProps(ctx, world, light);
  drawBlocks(ctx, world, light);
  drawMarker(ctx, world);
  drawActors(ctx, world);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  ctx.restore();
  drawLight(ctx, world, width, height, light);
}

/** Asphalt, sand, sea and the sidewalk aprons of every block. */
function drawGround(ctx, world) {
  const city = world.city;
  ctx.fillStyle = '#22617f';
  ctx.fillRect(SEA_EDGE, -600, SEA_END - SEA_EDGE + 900, WORLD + 1500);
  const sea = ctx.createLinearGradient(SEA_EDGE, 0, SEA_EDGE + 340, 0);
  sea.addColorStop(0, COLORS.sea);
  sea.addColorStop(1, '#1d5876');
  ctx.fillStyle = sea;
  ctx.fillRect(SEA_EDGE, -600, 420, WORLD + 1500);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(SHORE_EDGE, -600, SEA_EDGE - SHORE_EDGE, WORLD + 1500);
  ctx.fillStyle = COLORS.sand_dark;
  ctx.fillRect(SHORE_EDGE, -600, 16, WORLD + 1500);
  ctx.fillStyle = COLORS.foam;
  ctx.fillRect(SEA_EDGE - 5, -600, 5, WORLD + 1500);
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(-600, -600, SHORE_EDGE + 600, WORLD + 1500);
  for (const block of city.blocks) {
    const rect = block.rect;
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(rect.x - SIDEWALK, rect.y - SIDEWALK, rect.w + SIDEWALK * 2, rect.h + SIDEWALK * 2);
    ctx.fillStyle = COLORS.sidewalk_edge;
    ctx.fillRect(rect.x - SIDEWALK, rect.y - SIDEWALK, rect.w + SIDEWALK * 2, 2);
    ctx.fillRect(rect.x - SIDEWALK, rect.y + rect.h + SIDEWALK - 2, rect.w + SIDEWALK * 2, 2);
    if (block.park) {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = COLORS.grass_dark;
      for (let stripe = 0; stripe < 6; stripe += 1) ctx.fillRect(rect.x, rect.y + stripe * (rect.h / 6) + 4, rect.w, 3);
      const park = block.park;
      ctx.fillStyle = '#c9b78e';
      if (park.path === 'cross') {
        ctx.fillRect(rect.x, rect.y + rect.h / 2 - 5, rect.w, 10);
        ctx.fillRect(rect.x + rect.w / 2 - 5, rect.y, 10, rect.h);
      } else {
        ctx.strokeStyle = '#c9b78e';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (park.pond) {
        ctx.fillStyle = '#4f9fc0';
        ctx.beginPath();
        ctx.ellipse(park.pond.x + park.pond.w / 2, park.pond.y + park.pond.h / 2, park.pond.w / 2, park.pond.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(park.pond.x + park.pond.w / 2 - 6, park.pond.y + park.pond.h / 2 - 4, park.pond.w / 5, park.pond.h / 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e8dfc6';
      ctx.fillRect(park.bandstand.x, park.bandstand.y, park.bandstand.w, park.bandstand.h);
      ctx.fillStyle = '#b7a682';
      ctx.fillRect(park.bandstand.x + 4, park.bandstand.y + 4, park.bandstand.w - 8, park.bandstand.h - 8);
    } else if (block.lot) {
      ctx.fillStyle = '#4a4d56';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(240,236,200,0.5)';
      ctx.lineWidth = 2;
      for (let bay = 0; bay < rect.w; bay += 30) {
        ctx.beginPath();
        ctx.moveTo(rect.x + bay, rect.y + 6);
        ctx.lineTo(rect.x + bay, rect.y + 40);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#8e8878';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  }
}

/** Lane dashes, kerb lines and the crosswalks at every intersection. */
function drawPaint(ctx, world) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(232,226,201,0.55)';
  ctx.setLineDash([16, 18]);
  for (let line = 0; line <= GRID; line += 1) {
    if (line === 0 || line === GRID) continue;
    ctx.beginPath();
    ctx.moveTo(line * CELL, 0);
    ctx.lineTo(line * CELL, SEA_EDGE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, line * CELL);
    ctx.lineTo(SEA_EDGE, line * CELL);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 4;
  for (let kx = 1; kx < GRID; kx += 1) {
    for (let ky = 1; ky < GRID; ky += 1) {
      const x = kx * CELL;
      const y = ky * CELL;
      for (let bar = -3; bar <= 3; bar += 1) {
        ctx.beginPath();
        ctx.moveTo(x - ROAD / 2 + 4, y + bar * 8);
        ctx.lineTo(x - ROAD / 2 + 4, y + bar * 8 + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + ROAD / 2 - 4, y + bar * 8);
        ctx.lineTo(x + ROAD / 2 - 4, y + bar * 8 + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + bar * 8, y - ROAD / 2 + 4);
        ctx.lineTo(x + bar * 8 + 5, y - ROAD / 2 + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + bar * 8, y + ROAD / 2 - 4);
        ctx.lineTo(x + bar * 8 + 5, y + ROAD / 2 - 4);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Blood, scorch and the tyre marks a hard corner leaves behind. */
function drawGroundMarks(ctx, world) {
  ctx.save();
  for (const decal of world.decals) {
    ctx.globalAlpha = Math.max(0, Math.min(1, decal.life / 40));
    ctx.fillStyle = decal.colour;
    ctx.beginPath();
    ctx.ellipse(decal.x, decal.y, decal.r, decal.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const mark of world.marks) {
    ctx.globalAlpha = Math.max(0, Math.min(0.5, mark.life / 14 * 0.5));
    ctx.strokeStyle = '#14161c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mark.x - Math.cos(mark.angle) * 6, mark.y - Math.sin(mark.angle) * 6);
    ctx.lineTo(mark.x + Math.cos(mark.angle) * 6, mark.y + Math.sin(mark.angle) * 6);
    ctx.stroke();
  }
  ctx.restore();
}

/** The water's edge: foam, the breakwater, the pier and a few boats riding the swell. */
function drawShoreline(ctx, world) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  for (let band = 0; band < 6; band += 1) {
    ctx.globalAlpha = 0.16 + band * 0.06;
    ctx.beginPath();
    for (let y = -200; y <= WORLD + 200; y += 40) {
      const x = SEA_EDGE + 10 + band * 34 + Math.sin((y + world.time * 36 + band * 60) / 90) * 8;
      if (y === -200) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const pier = world.city.pier;
  ctx.fillStyle = '#8a7a63';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.fillStyle = '#6f6250';
  for (let plank = 0; plank < pier.w; plank += 18) ctx.fillRect(pier.x + plank, pier.y, 4, pier.h);
  ctx.fillStyle = '#5b5348';
  ctx.fillRect(pier.x + pier.w - 30, pier.y + 6, 24, pier.h - 12);
  ctx.restore();
}

/** Cash, medkits, armour and ammo crates, bobbing a little to catch the eye. */
function drawPickups(ctx, world) {
  for (const pickup of world.pickups) {
    const bob = Math.sin(world.time * 3 + pickup.bob) * 2;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8 - bob, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pickup.kind === 'cash') {
      ctx.fillStyle = '#3f9d5a';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#e8e2c9';
      ctx.fillRect(-8, -6, 16, 3);
      ctx.fillStyle = '#2c7042';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('$', -3, 5);
    } else if (pickup.kind === 'health') {
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#c8382f';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (pickup.kind === 'armour') {
      ctx.fillStyle = '#3f6fe2';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(9, -3);
      ctx.lineTo(6, 8);
      ctx.lineTo(-6, 8);
      ctx.lineTo(-9, -3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#6b5a49';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#e0b93c';
      ctx.fillRect(-6, -4, 12, 2);
      ctx.fillRect(-6, 0, 12, 2);
    }
    ctx.restore();
  }
}

/** Lamps, hydrants, benches, bins, crates, palms and the umbrellas of the beach. */
function drawProps(ctx, world, light) {
  for (const prop of world.city.props) {
    if (prop.kind === 'lamp') {
      ctx.fillStyle = '#4c4f57';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (light.night > 0.1) {
        ctx.save();
        ctx.globalAlpha = light.night * 0.4;
        const glow = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 46);
        glow.addColorStop(0, 'rgba(255,226,150,0.9)');
        glow.addColorStop(1, 'rgba(255,226,150,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#c8382f';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'bench') {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(prop.x - 9, prop.y - 4, 18, 8);
      ctx.fillStyle = '#5e3d22';
      ctx.fillRect(prop.x - 9, prop.y - 4, 18, 3);
    } else if (prop.kind === 'bin') {
      ctx.fillStyle = '#3d4a52';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#54646e';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'sign') {
      ctx.fillStyle = '#6f7889';
      ctx.fillRect(prop.x - 1, prop.y - 12, 2, 14);
      ctx.fillStyle = '#e6e6e0';
      ctx.fillRect(prop.x - 7, prop.y - 20, 14, 9);
      ctx.fillStyle = '#3f6fe2';
      ctx.fillRect(prop.x - 5, prop.y - 18, 10, 2);
    } else if (prop.kind === 'pallet') {
      ctx.fillStyle = '#a07a4c';
      ctx.fillRect(prop.x - 10, prop.y - 7, 20, 14);
      ctx.fillStyle = '#7d5c37';
      ctx.fillRect(prop.x - 10, prop.y - 2, 20, 2);
    } else if (prop.kind === 'umbrella') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 4, prop.y + 5, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = prop.colour;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(prop.x - 14, prop.y);
      ctx.arc(prop.x, prop.y, 14, Math.PI, Math.PI * 1.5);
      ctx.lineTo(prop.x, prop.y);
      ctx.fill();
    } else if (prop.kind === 'deckchair') {
      ctx.fillStyle = prop.colour;
      ctx.fillRect(prop.x - 8, prop.y - 5, 16, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(prop.x - 8, prop.y - 5, 16, 3);
    } else if (prop.kind === 'boat') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = prop.colour;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(-4, -3, 10, 6);
      ctx.restore();
    } else if (prop.kind === 'container') {
      ctx.fillStyle = prop.colour;
      ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      for (let ridge = 6; ridge < prop.w; ridge += 8) {
        ctx.beginPath();
        ctx.moveTo(prop.x + ridge, prop.y + 3);
        ctx.lineTo(prop.x + ridge, prop.y + prop.h - 3);
        ctx.stroke();
      }
    } else if (prop.kind === 'bay') {
      ctx.strokeStyle = 'rgba(240,236,200,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x, prop.y, 4, 40);
    }
  }
  for (const tree of world.city.trees) {
    ctx.fillStyle = 'rgba(30,24,40,0.28)';
    ctx.beginPath();
    ctx.arc(tree.x + 5, tree.y + 5, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6b34';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8a42';
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.25, tree.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#579a4c';
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.4, tree.y - tree.r * 0.4, tree.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Every building on the grid, drawn as walls and a roof standing off its own shadow. */
function drawBlocks(ctx, world, light) {
  for (const block of world.city.blocks) {
    for (const building of block.buildings) {
      const height = building.height;
      const dx = height * SUN.x;
      const dy = height * SUN.y;
      ctx.save();
      ctx.globalAlpha = 0.28 + light.shadow * 0.5;
      ctx.fillStyle = '#241f33';
      ctx.beginPath();
      ctx.moveTo(building.x + dx * 2.1, building.y + dy * 2.1 + building.h);
      ctx.lineTo(building.x + building.w + dx * 2.1, building.y + dy * 2.1 + building.h);
      ctx.lineTo(building.x + building.w + dx * 2.1, building.y + dy * 2.1);
      ctx.lineTo(building.x + dx * 2.1, building.y + dy * 2.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // the two walls we can see, then the roof standing on them
      ctx.fillStyle = shade(building.trim, -18);
      ctx.beginPath();
      ctx.moveTo(building.x, building.y);
      ctx.lineTo(building.x + dx, building.y + dy);
      ctx.lineTo(building.x + dx, building.y + dy + building.h);
      ctx.lineTo(building.x, building.y + building.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(building.trim, -34);
      ctx.beginPath();
      ctx.moveTo(building.x, building.y);
      ctx.lineTo(building.x + building.w, building.y);
      ctx.lineTo(building.x + building.w + dx, building.y + dy);
      ctx.lineTo(building.x + dx, building.y + dy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = building.roof;
      ctx.fillRect(building.x + dx, building.y + dy, building.w, building.h);
      ctx.strokeStyle = 'rgba(20,16,30,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(building.x + dx + 0.5, building.y + dy + 0.5, building.w - 1, building.h - 1);
      if (building.district === 'downtown' || building.district === 'midtown') {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (let floor = 0.25; floor < 0.9; floor += 0.3) {
          ctx.fillRect(building.x + dx + 4, building.y + dy + building.h * floor, building.w - 8, 2);
        }
        ctx.fillStyle = building.glass;
        ctx.fillRect(building.x + dx + building.w * 0.12, building.y + dy + 4, building.w * 0.22, 5);
      }
      for (const detail of building.roofProps) drawRoofDetail(ctx, detail, building, dx, dy);
    }
    if (block.crane) {
      ctx.strokeStyle = '#c8a23c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(block.crane.x, block.crane.y);
      ctx.lineTo(block.crane.x + block.crane.w, block.crane.y);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let leg = 0; leg < 3; leg += 1) {
        ctx.beginPath();
        ctx.moveTo(block.crane.x + block.crane.w * (0.2 + leg * 0.3), block.crane.y);
        ctx.lineTo(block.crane.x + block.crane.w * (0.2 + leg * 0.3), block.crane.y + 42);
        ctx.stroke();
      }
    }
  }
}

/** Roof clutter and street signs: what tells one district from the next at a glance. */
function drawRoofDetail(ctx, detail, building, dx, dy) {
  const x = detail.x + dx;
  const y = detail.y + dy;
  if (detail.kind === 'ac') {
    ctx.fillStyle = '#9aa0aa';
    ctx.fillRect(x, y, detail.w, detail.h);
    ctx.fillStyle = '#6c727c';
    ctx.fillRect(x + 2, y + 2, detail.w - 4, detail.h - 4);
  } else if (detail.kind === 'tank') {
    ctx.fillStyle = '#b7bcc4';
    ctx.beginPath();
    ctx.arc(x + detail.w / 2, y + detail.h / 2, detail.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b9099';
    ctx.beginPath();
    ctx.arc(x + detail.w / 2, y + detail.h / 2, detail.w / 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (detail.kind === 'helipad') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x + detail.w / 2, y + detail.h / 2, Math.min(detail.w, detail.h) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f4756';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('H', x + detail.w / 2 - 5, y + detail.h / 2 + 5);
  } else if (detail.kind === 'vent') {
    ctx.fillStyle = '#5f6672';
    ctx.fillRect(x, y, detail.w, detail.h);
  } else if (detail.kind === 'ridge') {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y + detail.h / 2 - 2, detail.w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y, detail.w, 4);
  } else if (detail.kind === 'yard') {
    ctx.fillStyle = '#4f8a46';
    ctx.fillRect(x, y, detail.w, detail.h);
  } else if (detail.kind === 'skylights') {
    ctx.fillStyle = '#cfe6ea';
    for (let strip = 8; strip < detail.w - 12; strip += 20) ctx.fillRect(x + strip, y + 8, 10, detail.h - 16);
  } else if (detail.kind === 'pool') {
    ctx.fillStyle = '#4fc0dc';
    ctx.fillRect(x, y, detail.w, detail.h);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x, y, detail.w, 2);
  } else if (detail.kind === 'sign') {
    ctx.fillStyle = '#ff7ad0';
    ctx.fillRect(x, y, detail.w, detail.h);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + 4, y + 4, detail.w - 8, 2);
    ctx.fillRect(x + 4, y + 9, detail.w - 8, 2);
  }
}

/** The objective the mission is asking for: a ring on the ground with a soft glow. */
function drawMarker(ctx, world) {
  const marker = world.marker;
  if (!marker) return;
  const pulse = 0.6 + Math.sin(world.time * 4) * 0.25;
  ctx.save();
  ctx.globalAlpha = 0.28 + pulse * 0.2;
  const gradient = ctx.createRadialGradient(marker.x, marker.y, 6, marker.x, marker.y, 64);
  gradient.addColorStop(0, marker.kind === 'pickup' ? 'rgba(63,208,216,0.9)' : 'rgba(255,210,60,0.9)');
  gradient.addColorStop(1, 'rgba(255,210,60,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = marker.kind === 'pickup' ? '#3fd0d8' : '#ffd23c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 + Math.sin(world.time * 4) * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Cars and people, back to front, so whoever is lower on the screen stands in front. */
function drawActors(ctx, world) {
  const actors = [];
  for (const car of world.vehicles) actors.push({ y: car.y, kind: 'car', ref: car });
  for (const ped of world.peds) actors.push({ y: ped.y, kind: 'ped', ref: ped });
  if (!world.playerInVehicle) actors.push({ y: world.player.y, kind: 'player', ref: world.player });
  actors.sort((one, two) => one.y - two.y);
  for (const actor of actors) {
    if (actor.kind === 'car') drawCar(ctx, world, actor.ref);
    else if (actor.kind === 'ped') drawPerson(ctx, actor.ref, actor.ref.kind === 'officer' ? 'officer' : actor.ref.kind === 'enforcer' ? 'enforcer' : 'walker');
    else drawPlayer(ctx, world);
  }
}

/** A car from above: body, glass, lights, and a light bar if it is a cruiser. */
function drawCar(ctx, world, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(20,16,30,0.3)';
  ctx.save();
  ctx.rotate(car.angle);
  ctx.fillRect(-spec.length / 2 + 5, -spec.width / 2 + 6, spec.length, spec.width);
  ctx.restore();
  ctx.rotate(car.angle);
  const body = car.burnt ? '#2a2521' : car.colour;
  ctx.fillStyle = body;
  roundRect(ctx, -spec.length / 2, -spec.width / 2, spec.length, spec.width, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -spec.length / 2 + 3, -spec.width / 2 + 2, spec.length - 6, spec.width - 4, 5);
  ctx.fill();
  ctx.fillStyle = car.kind === 'police' ? '#e8ecf2' : 'rgba(190,225,235,0.9)';
  ctx.fillRect(spec.length * 0.06, -spec.width / 2 + 3, spec.length * 0.3, spec.width - 6);
  ctx.fillRect(-spec.length * 0.36, -spec.width / 2 + 3, spec.length * 0.2, spec.width - 6);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f4f7';
    ctx.fillRect(-spec.length / 2, -spec.width / 2 + 2, spec.length, 4);
    ctx.fillRect(-spec.length / 2, spec.width / 2 - 6, spec.length, 4);
    const flash = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f6bff';
    ctx.fillRect(-4, -spec.width / 2 - 3, 9, 6);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#2f3540';
    ctx.fillRect(-4, -4, 8, 8);
  }
  ctx.fillStyle = car.burnt ? '#4a4038' : COLORS.headlight;
  ctx.fillRect(spec.length / 2 - 3, -spec.width / 2 + 2, 3, 4);
  ctx.fillRect(spec.length / 2 - 3, spec.width / 2 - 6, 3, 4);
  ctx.fillStyle = car.controls && car.controls.brake ? '#ff5a4a' : '#a83a30';
  ctx.fillRect(-spec.length / 2, -spec.width / 2 + 2, 3, 4);
  ctx.fillRect(-spec.length / 2, spec.width / 2 - 6, 3, 4);
  if (car.burnt) {
    ctx.fillStyle = 'rgba(90,80,72,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, spec.width * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world.vehicle === car && world.playerInVehicle) {
    ctx.fillStyle = '#37b0a8';
    ctx.beginPath();
    ctx.moveTo(spec.length * 0.26, 0);
    ctx.lineTo(-spec.length * 0.06, -5);
    ctx.lineTo(-spec.length * 0.06, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
  if (car.mission) {
    ctx.save();
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** A person from above: shoulders, head and the swing of a walk. */
function drawPerson(ctx, ped, role) {
  const swing = ped.dead ? 0 : Math.sin(ped.step) * 3;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(20,16,30,0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 5, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.dead) {
    ctx.rotate(1.2);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -15, -6, 30, 12, 6);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(16, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(Math.atan2(ped.dir.y, ped.dir.x) + Math.PI / 2);
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-7, 3 + swing * 0.3, 5, 9);
  ctx.fillRect(2, 3 - swing * 0.3, 5, 9);
  ctx.fillStyle = ped.shirt;
  roundRect(ctx, -9, -8, 18, 17, 5);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,24,20,0.8)';
  ctx.beginPath();
  ctx.arc(0, -4.5, 5.4, Math.PI, Math.PI * 2);
  ctx.fill();
  if (role === 'officer' || (role === 'enforcer' && ped.armed)) {
    ctx.fillStyle = '#2f3540';
    ctx.fillRect(5, -8, 3, 14);
  }
  if (role === 'officer') {
    ctx.fillStyle = COLORS.police;
    roundRect(ctx, -8, -7, 16, 6, 3);
    ctx.fill();
  }
  ctx.restore();
  if (role === 'enforcer' && ped.alerted) {
    ctx.save();
    ctx.strokeStyle = 'rgba(226,86,74,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** The player: a dark jacket and a teal shirt, with a line showing where the gun points. */
function drawPlayer(ctx, world) {
  const player = world.player;
  player.angle = Math.atan2(world.aim.y, world.aim.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(20,16,30,0.32)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle) * 46, Math.sin(player.angle) * 46);
  ctx.stroke();
  ctx.rotate(player.angle + Math.PI / 2);
  const swing = Math.sin(player.walkPhase) * 3.4;
  ctx.fillStyle = '#2f3540';
  ctx.fillRect(-5, 2 + swing * 0.4, 4, 8);
  ctx.fillRect(1, 2 - swing * 0.4, 4, 8);
  ctx.fillStyle = '#1f2630';
  roundRect(ctx, -8, -7, 16, 14, 5);
  ctx.fill();
  ctx.fillStyle = '#37b0a8';
  ctx.fillRect(-6, -5, 12, 6);
  ctx.fillStyle = '#c98d63';
  ctx.beginPath();
  ctx.arc(0, -2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(0, -3.5, 4.4, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (world.playerInVehicle && world.vehicle) {
    ctx.save();
    ctx.strokeStyle = 'rgba(55,176,168,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(world.vehicle.x, world.vehicle.y, world.vehicle.spec.length * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (player.health < 35 && !player.dead) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(world.time * 6) * 0.1;
    ctx.strokeStyle = '#c8382f';
    ctx.lineWidth = 12;
    ctx.strokeRect(4, 4, 1280 - 8, 720 - 8);
    ctx.restore();
  }
}

/** Tracers, sparks, blood, smoke and fire. */
function drawBullets(ctx, world) {
  for (const bullet of world.bullets) {
    ctx.save();
    ctx.strokeStyle = bullet.colour;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.03, bullet.y - bullet.vy * 0.03);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx, world) {
  for (const particle of world.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.life * 2.4));
    ctx.fillStyle = particle.colour;
    if (particle.kind === 'smoke') {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r * (1.4 - particle.life), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === 'swing') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 18 * (1.2 - particle.life), 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === 'muzzle') {
      const glow = ctx.createRadialGradient(particle.x, particle.y, 1, particle.x, particle.y, 16);
      glow.addColorStop(0, 'rgba(255,244,194,0.95)');
      glow.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(particle.x, particle.y, particle.r, particle.r);
    }
    ctx.restore();
  }
}

/** The hour over everything: a warm wash by day, a blue one at night, and a soft vignette. */
function drawLight(ctx, world, width, height, light) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = light.tint;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  if (light.night > 0.05) {
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(6,8,22,${(0.45 * light.night).toFixed(3)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** A rounded rectangle path, the shape nearly every vehicle body wants. */
export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Lighten or darken a hex colour by a percentage, for walls and trims. */
function shade(hex, amount) {
  const value = hex.replace('#', '');
  const number = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  const r = Math.max(0, Math.min(255, (number >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((number >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (number & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

/** The district name and the street the player is on, for the HUD's location line. */
export function locationLine(world) {
  const player = world.playerInVehicle && world.vehicle ? world.vehicle : world.player;
  const district = world.city.districtAtPoint(player.x, player.y);
  const street = WORLD > player.x ? world.city.streetNameAt(player.x, player.y) : district;
  const names = { downtown: 'Downtown Velamar', midtown: 'Midtown', homes: 'Barrio Alto', docks: 'Muelle Viejo', beach: 'Playa Coral', strip: 'Neon Strip', park: 'Parque Verde' };
  return `${names[district] ?? 'Velamar'} · ${street}`;
}

export const CITY_STATS = { cell: CELL, road: ROAD, blocks: GRID * GRID, edge: SEA_EDGE, player: PLAYER.radius, colours: Object.keys(COLORS).length, districts: Object.keys(DISTRICTS).length };
