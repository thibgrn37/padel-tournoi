// Tirages au sort reproductibles : chaque tirage part d'une graine enregistrée dans le journal.
import type { Tirage } from './types';

export type Rng = () => number;

export function creerRng(graine: number): Rng {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nouvelleGraine(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}

export function melanger<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Journal d'un tirage en cours. */
export class Journal {
  details: string[] = [];
  constructor(public libelle: string, public graine: number) {}
  log(s: string) { this.details.push(s); }
  vers(): Tirage {
    return { date: new Date().toISOString(), libelle: this.libelle, graine: this.graine, details: this.details };
  }
}

/**
 * Trie des éléments par valeur croissante ; les égalités sont départagées par tirage au sort.
 */
export function trierAvecTirage<T>(
  items: T[],
  valeur: (x: T) => number,
  nom: (x: T) => string,
  rng: Rng,
  journal?: Journal,
): T[] {
  const groupes = new Map<number, T[]>();
  for (const it of items) {
    const v = valeur(it);
    groupes.set(v, [...(groupes.get(v) ?? []), it]);
  }
  const cles = [...groupes.keys()].sort((x, y) => x - y);
  const res: T[] = [];
  for (const k of cles) {
    const g = groupes.get(k)!;
    if (g.length > 1) {
      const m = melanger(g, rng);
      journal?.log(`Égalité à ${k} : ${g.map(nom).join(', ')} → ordre tiré : ${m.map(nom).join(', ')}`);
      res.push(...m);
    } else res.push(g[0]);
  }
  return res;
}
