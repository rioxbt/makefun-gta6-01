// Velamar Heat: the entry point make.fun runs. Plumbing only — the game itself is the static
// files under game/, which a desktop browser plays (game/index.html and its modules, no build
// step and no network request). This program copies game/ and screenshots/ from beside itself
// into the output directory and writes dossier.json there with the kit's own dossier builder, so
// what make.fun reads is exactly what those two folders hold.
//
// Node 22 or later, standard library only. Outside the grader MAKEFUN_OUTPUT_DIR stands in for
// the /output it writes in the container:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repository = dirname(fileURLToPath(import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, so a run that would be refused for size is refused here first, where the
// numbers can be read: 160 KiB of dossier text, at most 4 screenshots of 256 KiB each, at most
// 993 files and 48 MiB under game/, and no path under game/ over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one folder of the repository into the output directory, answer whether it was there. */
function deliver(name) {
  const from = join(repository, name);
  if (!existsSync(from)) return false;
  const to = join(output, name);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return true;
}

mkdirSync(output, { recursive: true });
deliver('game');
deliver('screenshots');

// The dossier is the summary the judge reads: the entry's screenshots and the game's own source,
// written last and from the files just delivered, byte for byte as the library writes it.
writeFileSync(join(output, 'dossier.json'), buildDossier(output, CAPS));
