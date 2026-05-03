/**
 * mulberry32 — a fast, seedable 32-bit PRNG.
 *
 * Returns a stateful generator function. Each call to the returned function
 * advances the state and returns a float in [0, 1).
 *
 * Passes PractRand at 32 GB; sufficient for Monte Carlo path generation at the
 * scale this project requires. State is a single 32-bit integer, making seeds
 * trivial to store, communicate, and reproduce.
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

/**
 * Derives a child seed from a master seed and an integer index.
 * Mixing prevents correlated sequences between paths while keeping the entire
 * run reproducible from a single master seed.
 */
export function deriveSeed(masterSeed: number, index: number): number {
  const mixed = (masterSeed ^ index) >>> 0;
  const prng = mulberry32(mixed);
  prng();
  prng();
  return (prng() * 0x100000000) >>> 0;
}
