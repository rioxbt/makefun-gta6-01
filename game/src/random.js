// A tiny seeded generator. The city, the traffic, the pedestrians and the staged screenshot
// scenes all draw from it, so the same seed always builds the same Velamar.

/** mulberry32: 32 bits of state, one fast mixing step a call. */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator with the conveniences the world builders want. */
export class Rng {
  constructor(seed) {
    this.next = makeRandom(seed);
  }

  /** A float in [lo, hi). */
  range(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  /** An integer in [lo, hi]. */
  int(lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  }

  /** True with chance `p`. */
  chance(p) {
    return this.next() < p;
  }

  /** One element of a list. */
  pick(list) {
    return list[Math.floor(this.next() * list.length) % list.length];
  }

  /** A unit vector turned by a random angle: a direction on foot or on the road. */
  heading() {
    const angle = this.next() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }
}

/** A stable seed from a few numbers, so one district or one lane can be rebuilt on its own. */
export function mixSeed(...parts) {
  let hash = 0x9e3779b9;
  for (const part of parts) hash = (Math.imul(hash ^ (part | 0), 0x85ebca6b) + 0x165667b1) >>> 0;
  return hash >>> 0;
}
