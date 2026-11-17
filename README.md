# makefun-gta6-01 — Velamar Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rioxbt/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rioxbt/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Velamar Heat** is a sun-soaked open-world crime game of my own making: no build step, no
network request, plain files a desktop browser plays from `game/index.html`. You are Rafa
Quiroga, a wheelman working the Costa Vela coast for Delia Marchetti, and Velamar is yours to
drive across — on foot, in stolen cars, with the police answering what you do.

Everything in it is original: the city of Velamar and its districts (Downtown, the Muelle Viejo
docks, the Parque Verde, the Neon Strip, Playa Coral), the five-chapter story, the characters,
the streets' names, the art, and the sound, which is synthesised on the spot rather than loaded.

## The game

- **A city you can cross**: a 13x13 street grid with downtown towers, midtown blocks, terraced
  barrios, a container port, two parks, a neon strip and a beach-and-sea coast road — all built
  from one seed, so the city is the same every time you load it.
- **On foot and by car**: walk, run, steal any car at the kerb, drive it with a handbrake, a
  horn, drive-by shooting and skid marks, then abandon it where you like.
- **Traffic and a crowd**: cars hold their lanes, turn at intersections, brake for each other and
  for people; the pavement crowd walks, panics at gunfire and goes down when a car finds them.
- **A wanted level that answers**: 0 to 5 stars, cooling off when the streets go quiet, answered
  by cruisers that hunt, ram and shoot and by officers on foot.
- **Five chapters and a story**: Courier Run, Wheelman Work, Hot Strip, The Colonel and Marina
  Score, plus a repeatable courier board that pays per second left on the clock.
- **Combat, weapons and progress**: fists, pistol, SMG and shotgun arrive as the story does; cash,
  health, armour and ammo pick up off the street; the payout buys nothing but your own record.
- **A HUD that says everything**: minimap with traffic, police and objective blips, wanted stars,
  money, health and armour bars, the objective and how far off it is, weapon and rounds, and the
  clock over a day that goes from dawn to golden hour to night.
- **Screens and a save file**: a title card, a pause menu with the run's records, save and load to
  the browser's own storage, and a BUSTED card when the police win.

Controls: **W A S D** walk and drive, **ARROWS** drive, **SHIFT** run or handbrake, **mouse**
aim, **click** shoot, **E** steal or leave a car, **1-4** or **X** weapons, **H** horn, **M**
mute, **ESC** pause (save, load, restart, quit).

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080 — open it in desktop Chrome
```

To build the entry the grader reads, run the program at the repository root:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with
`vendor/makefun-game.ts`; `screenshots/` holds four frames of the game itself, taken from its own
staged scenes (`?shot=chase`, `?shot=street`, `?shot=coast`, `?shot=shootout`, listed in
`shots.json`), which play the game's real rules forward and stop on the frame.

`game/src/` is one file per system: `city.js` builds the city, `traffic.js` the lanes and the
driving, `people.js` the crowd, `police.js` the chase, `weapons.js` the guns, `missions.js` the
story, `hud.js` the overlay, `render.js` the drawing, `audio.js` the sound, `screens.js` the
menus and the save file, `shots.js` the screenshot scenes.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
