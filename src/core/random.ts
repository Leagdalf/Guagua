// Zufall mit Startwert. Die Logik ruft nie `Math.random()`, sondern bekommt ein `Rng` hineingereicht.

/** Liefert Zahlen im Bereich [0, 1). */
export type Rng = () => number;

function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return seed >>> 0;
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Reproduzierbarer Zufall (mulberry32). Gleicher Startwert, gleiche Folge. */
export function createRng(seed: number | string): Rng {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gemischte Kopie (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
