// The screens around the game: the title card over the sea at dawn, the pause menu with the
// records and the save buttons, the busted and wasted cards. Saving keeps the run in the
// browser's own storage, so a player can close the tab and come back to the same Velamar.
import { COLORS } from './config.js';
import { roundRect } from './render.js';
import { MISSIONS } from './missions.js';

const FONT = 'system-ui, "DejaVu Sans", "Helvetica Neue", Arial, sans-serif';
export const SAVE_KEY = 'velamar-heat-save-v1';

/** Write the run to storage. Returns false when storage is unavailable or full. */
export function saveGame(world) {
  try {
    const payload = { version: 1, savedAt: Date.now(), data: world.snapshot() };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    void error;
    return false;
  }
}

/** Read a saved run back, or null when there is none. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch (error) {
    void error;
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    void error;
  }
}

function text(ctx, value, x, y, size, colour, weight = 'bold', align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(value, x + 2, y + 2);
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
  ctx.textAlign = 'left';
}

/** Skyline silhouettes: towers, palms and the pier, over a sunlit sea. */
function drawSkyline(ctx, width, height, time) {
  const horizon = height * 0.56;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2b3f6e');
  sky.addColorStop(0.42, '#c86f4e');
  sky.addColorStop(0.75, '#f0a95e');
  sky.addColorStop(1, '#f7cf86');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon + 2);
  ctx.fillStyle = 'rgba(255,236,180,0.95)';
  ctx.beginPath();
  ctx.arc(width * 0.72, horizon - 46, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,236,180,0.25)';
  ctx.beginPath();
  ctx.arc(width * 0.72, horizon - 46, 96, 0, Math.PI * 2);
  ctx.fill();
  const sea = ctx.createLinearGradient(0, horizon, 0, height);
  sea.addColorStop(0, '#2f7fa8');
  sea.addColorStop(1, '#194f6c');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, width, height - horizon);
  ctx.strokeStyle = 'rgba(255,236,180,0.35)';
  ctx.lineWidth = 3;
  for (let band = 0; band < 26; band += 1) {
    const y = horizon + 6 + band * ((height - horizon) / 26);
    const spread = 40 + band * 14;
    ctx.beginPath();
    ctx.moveTo(width * 0.72 - spread, y + Math.sin(time * 1.6 + band) * 2);
    ctx.lineTo(width * 0.72 + spread, y + Math.sin(time * 1.6 + band) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#1b2233';
  const towers = [
    [0.02, 190, 70], [0.1, 150, 54], [0.17, 240, 46], [0.24, 120, 60], [0.31, 285, 52], [0.39, 170, 74],
    [0.48, 210, 44], [0.55, 150, 58], [0.63, 260, 48], [0.71, 130, 66], [0.78, 200, 52], [0.86, 165, 72], [0.94, 230, 56],
  ];
  for (const [x, towerHeight, towerWidth] of towers) {
    const left = x * width;
    ctx.fillRect(left, horizon - towerHeight, towerWidth, towerHeight);
    ctx.fillStyle = 'rgba(255,214,140,0.55)';
    for (let floor = horizon - towerHeight + 14; floor < horizon - 12; floor += 22) {
      for (let window = 0; window < towerWidth - 14; window += 16) {
        if ((floor + window + Math.floor(x * 100)) % 7 < 3) ctx.fillRect(left + 8 + window, floor, 7, 9);
      }
    }
    ctx.fillStyle = '#1b2233';
  }
  ctx.fillStyle = '#141a26';
  for (const palm of [0.1, 0.28, 0.46, 0.66, 0.88]) {
    const x = palm * width;
    ctx.fillRect(x - 4, horizon - 96, 8, 96);
    for (let frond = 0; frond < 7; frond += 1) {
      const angle = -Math.PI / 2 + (frond - 3) * 0.34;
      ctx.save();
      ctx.translate(x, horizon - 96);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(26, 0, 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** The title card: the game's name, its pitch, the controls and the two ways in. */
export function drawTitle(ctx, width, height, time, saveFile) {
  drawSkyline(ctx, width, height, time);
  ctx.fillStyle = 'rgba(10,12,22,0.28)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  text(ctx, 'VELAMAR', cx, height * 0.2, 92, '#ffe9a8', 'bold', 'center');
  text(ctx, 'HEAT', cx, height * 0.3, 92, '#f2764a', 'bold', 'center');
  text(ctx, 'A sunlit open-world crime story of the Costa Vela coast', cx, height * 0.4, 20, '#f4f7ff', 'normal', 'center');

  const boxWidth = 520;
  const left = cx - boxWidth / 2;
  ctx.fillStyle = 'rgba(10,12,22,0.55)';
  roundRect(ctx, left, height * 0.46, boxWidth, 168, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();
  const controls = [
    'W A S D  walk and drive      SHIFT  run or handbrake',
    'ARROWS  drive                MOUSE  aim      CLICK  shoot',
    'E  steal or leave a car      X  change weapon   H  horn',
    '1-4  weapons   M mute   ESC pause, save and quit',
  ];
  controls.forEach((line, index) => text(ctx, line, left + 22, height * 0.48 + index * 26, 16, '#dfe6f5', 'normal'));

  const pulse = 0.6 + Math.sin(time * 3) * 0.4;
  ctx.globalAlpha = pulse;
  text(ctx, 'PRESS ENTER — START THE STORY', cx, height * 0.73, 26, '#ffd23c', 'bold', 'center');
  ctx.globalAlpha = 1;
  if (saveFile) {
    text(ctx, `PRESS C — CONTINUE  (saved $${saveFile.data.cash.toLocaleString('en-US')}, ${saveFile.data.completed.length} of ${MISSIONS.length} jobs done, ${new Date(saveFile.savedAt).toLocaleDateString()})`,
      cx, height * 0.79, 16, '#8fd4c8', 'normal', 'center');
  }
  text(ctx, 'Velamar is your city: five chapters, a wanted level that answers to you, cars to steal and a coast to drive.', cx, height * 0.86, 15, '#c3cee2', 'normal', 'center');
  text(ctx, 'M — sound on or off', cx, height * 0.92, 14, '#9fb2cc', 'normal', 'center');
}

/** Pause: the run's records, the save buttons and the keys you keep forgetting. */
export function drawPause(ctx, width, height, world, message) {
  ctx.fillStyle = 'rgba(8,10,18,0.66)';
  ctx.fillRect(0, 0, width, height);
  const boxWidth = 520;
  const boxHeight = 356;
  const x = (width - boxWidth) / 2;
  const y = (height - boxHeight) / 2 - 20;
  ctx.fillStyle = 'rgba(16,18,30,0.92)';
  roundRect(ctx, x, y, boxWidth, boxHeight, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();
  text(ctx, 'PAUSED', x + 24, y + 22, 34, '#ffd23c');
  text(ctx, 'VELAMAR HEAT', x + boxWidth - 24, y + 34, 16, '#8fa2bb', 'normal', 'right');
  const rows = [
    ['Cash', `$${world.cash.toLocaleString('en-US')}`],
    ['Chapters done', `${world.mission.completed.length} of ${MISSIONS.length}`],
    ['Kills', `${world.stats.kills}`],
    ['Cars stolen', `${world.stats.stolen}`],
    ['Distance driven', `${(world.stats.driven / 1000).toFixed(1)} km`],
    ['Courier runs', `${world.stats.jobs}`],
    ['Busted', `${world.stats.busted}`],
    ['Clock', `Day ${world.day}  ${world.clockText()}`],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y + 76 + Math.floor(index / 2) * 28;
    const columnX = x + 24 + (index % 2) * 244;
    text(ctx, label, columnX, rowY, 15, '#9fb2cc', 'normal');
    text(ctx, value, columnX + 170, rowY, 15, '#f4f7ff', 'bold', 'right');
  });
  text(ctx, '[ESC] RESUME     [ENTER] SAVE AND RESUME', x + 24, y + boxHeight - 74, 16, '#ffd23c');
  text(ctx, '[F] SAVE     [L] LOAD     [R] RESTART     [Q] QUIT TO THE TITLE', x + 24, y + boxHeight - 48, 16, '#8fd4c8');
  if (message) text(ctx, message, x + 24, y + boxHeight - 24, 15, '#f4f7ff', 'normal');
}

/** The card after the police or the paramedics win: one line, one key. */
export function drawEndCard(ctx, width, height, world, time) {
  const busted = world.player.busted;
  ctx.fillStyle = busted ? 'rgba(10,16,40,0.6)' : 'rgba(60,10,14,0.6)';
  ctx.fillRect(0, 0, width, height);
  text(ctx, busted ? 'BUSTED' : 'WASTED', width / 2, height * 0.36, 86, busted ? '#8fc4ff' : '#ff8a7a', 'bold', 'center');
  text(ctx, busted ? 'The Velamar police ran you down and took their cut.' : 'The coast is quiet for a moment.', width / 2, height * 0.48, 20, '#f4f7ff', 'normal', 'center');
  const pulse = 0.55 + Math.sin(time * 4) * 0.45;
  ctx.globalAlpha = pulse;
  text(ctx, 'RESPAWNING…', width / 2, height * 0.58, 22, '#ffd23c', 'bold', 'center');
  ctx.globalAlpha = 1;
  text(ctx, `Wanted level ${world.stars} · cash $${world.cash.toLocaleString('en-US')}`, width / 2, height * 0.66, 18, '#c3cee2', 'normal', 'center');
  void COLORS;
}
