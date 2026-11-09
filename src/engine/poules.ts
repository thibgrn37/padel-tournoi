// Constitution des poules, matchs de poule et classement (Chapitre I).
import { POINTS_POULE } from './regles';
import { Journal, melanger, type Rng } from './tirage';
import type { FormatCode, Match, MethodePoules, Poule } from './types';

export const nomPoule = (i: number) => String.fromCharCode(65 + i);

/** Tailles des poules : N paires réparties au mieux dans P poules. */
export function taillesPoules(N: number, P: number): number[] {
  return Array.from({ length: P }, (_, i) => Math.floor(N / P) + (i < N % P ? 1 : 0));
}

/**
 * Répartit les paires (ordonnées de la plus forte à la plus faible) dans P poules.
 * - SERPENTIN : placement fixe 1 2 3 4 / 8 7 6 5 / 9 10 11 12...
 * - REPARTITION_RANG : chaque rang (paires 1 à P, P+1 à 2P...) est tiré au sort dans les poules.
 */
export function constituerPoules(
  ordre: string[],
  P: number,
  methode: MethodePoules,
  rng: Rng,
  journal: Journal,
  nom: (id: string) => string,
): Poule[] {
  const poules: Poule[] = Array.from({ length: P }, (_, i) => ({ id: `poule-${nomPoule(i)}`, nom: `Poule ${nomPoule(i)}`, paires: [] }));
  const tailles = taillesPoules(ordre.length, P);
  for (let r = 0; r * P < ordre.length; r++) {
    const rang = ordre.slice(r * P, r * P + P);
    // poules qui ont encore de la place à ce rang
    let cibles = poules.map((_, i) => i).filter((i) => poules[i].paires.length < tailles[i]);
    if (methode === 'SERPENTIN') {
      if (r % 2 === 1) cibles = cibles.reverse();
      rang.forEach((id, k) => poules[cibles[k]].paires.push(id));
    } else {
      const tirees = melanger(cibles, rng).slice(0, rang.length);
      rang.forEach((id, k) => poules[tirees[k]].paires.push(id));
      journal.log(`Rang ${r + 1} : ` + rang.map((id, k) => `${nom(id)} → ${poules[tirees[k]].nom}`).join(' ; '));
    }
  }
  if (methode === 'SERPENTIN') journal.log('Méthode du serpentin (placement fixe selon le poids).');
  return poules;
}

/** Ordre des rencontres d'une poule (indices de position). */
export function rencontresPoule(n: number): [number, number][][] {
  if (n === 3) return [[[1, 2]], [[0, 2]], [[0, 1]]];
  if (n === 4) return [[[0, 3], [1, 2]], [[0, 2], [1, 3]], [[0, 1], [2, 3]]];
  // méthode du cercle
  const ids = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i);
  const m = ids.length;
  const tours: [number, number][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const t: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i], b = ids[m - 1 - i];
      if (a < n && b < n) t.push(a < b ? [a, b] : [b, a]);
    }
    tours.push(t);
    ids.splice(1, 0, ids.pop()!);
  }
  return tours;
}

export function genererMatchsPoule(p: Poule, format: FormatCode, ordreBase: number): Match[] {
  const res: Match[] = [];
  rencontresPoule(p.paires.length).forEach((tour, t) =>
    tour.forEach(([i, j], k) => {
      res.push({
        id: `${p.id}-${i + 1}v${j + 1}`,
        libelle: `${p.nom} · ${i + 1} contre ${j + 1}`,
        phase: 'POULE',
        groupeId: p.id,
        ordre: ordreBase + t * 1000 + k,
        a: { k: 'paire', id: p.paires[i] },
        b: { k: 'paire', id: p.paires[j] },
        format,
      });
    }),
  );
  return res;
}

export interface LigneClassement {
  paireId: string;
  joues: number;
  victoires: number;
  points: number;
  setsPour: number;
  setsContre: number;
  jeuxPour: number;
  jeuxContre: number;
  /** Égalité parfaite non départagée : un tirage au sort est nécessaire. */
  egaliteParfaite?: boolean;
}

interface Bilan { sets: [number, number]; jeux: [number, number] }

/** Sets et jeux d'un match du point de vue de A. Un super jeu décisif compte comme 1 jeu. */
function bilanMatch(m: Match): Bilan {
  const r = m.resultat!;
  let sa = 0, sb = 0, ja = 0, jb = 0;
  for (const [a, b] of r.sets) {
    if (a > b) sa++; else if (b > a) sb++;
    if (a >= 10 || b >= 10) {
      // super jeu décisif (ou format E)
      if (a > b) ja++; else jb++;
    } else {
      ja += a; jb += b;
    }
  }
  return { sets: [sa, sb], jeux: [ja, jb] };
}

/**
 * Classement d'une poule : 2 pts victoire, 1 pt défaite, -1 disqualification, -2 WO.
 * Égalité : différence de sets, puis de jeux (tous les matchs), puis les mêmes critères
 * sur les seuls matchs entre paires à égalité, puis tirage au sort (`departage`).
 */
export function classementPoule(p: Poule, matchs: Match[], departage?: string[]): LigneClassement[] {
  const lignes = new Map<string, LigneClassement>();
  p.paires.forEach((id) =>
    lignes.set(id, { paireId: id, joues: 0, victoires: 0, points: 0, setsPour: 0, setsContre: 0, jeuxPour: 0, jeuxContre: 0 }),
  );
  const ms = matchs.filter((m) => m.groupeId === p.id && m.resultat);
  const idA = (m: Match) => (m.a as { id: string }).id;
  const idB = (m: Match) => (m.b as { id: string }).id;
  for (const m of ms) {
    const r = m.resultat!;
    const { sets, jeux } = bilanMatch(m);
    const [la, lb] = [lignes.get(idA(m))!, lignes.get(idB(m))!];
    for (const [l, moi, gagne] of [[la, 0, r.vainqueur === 'A'], [lb, 1, r.vainqueur === 'B']] as const) {
      l.joues++;
      if (gagne) { l.victoires++; l.points += POINTS_POULE.victoire; }
      else l.points += r.issue === 'WO' ? POINTS_POULE.wo : r.issue === 'DISQUALIFICATION' ? POINTS_POULE.disqualification : POINTS_POULE.defaite;
      l.setsPour += sets[moi]; l.setsContre += sets[1 - moi];
      l.jeuxPour += jeux[moi]; l.jeuxContre += jeux[1 - moi];
    }
  }
  const diffs = (ids: string[], seulementEntreEux: boolean) => {
    const d = new Map(ids.map((id) => [id, { s: 0, j: 0 }]));
    for (const m of ms) {
      const [a, b] = [idA(m), idB(m)];
      if (seulementEntreEux && !(d.has(a) && d.has(b))) continue;
      const { sets, jeux } = bilanMatch(m);
      if (d.has(a)) { d.get(a)!.s += sets[0] - sets[1]; d.get(a)!.j += jeux[0] - jeux[1]; }
      if (d.has(b)) { d.get(b)!.s += sets[1] - sets[0]; d.get(b)!.j += jeux[1] - jeux[0]; }
    }
    return d;
  };
  // Départage récursif d'un groupe d'égalité
  const departager = (ids: string[], etape: number): string[][] => {
    if (ids.length <= 1 || etape > 1) return [ids];
    const d = diffs(ids, etape === 1);
    const cle = (id: string) => `${d.get(id)!.s}|${d.get(id)!.j}`;
    const tri = [...ids].sort((x, y) => d.get(y)!.s - d.get(x)!.s || d.get(y)!.j - d.get(x)!.j);
    const groupes: string[][] = [];
    for (const id of tri) {
      const g = groupes[groupes.length - 1];
      if (g && cle(g[0]) === cle(id)) g.push(id); else groupes.push([id]);
    }
    if (groupes.length === 1) return departager(ids, etape + 1);
    return groupes.flatMap((g) => (g.length > 1 ? departager(g, 1) : [g]));
  };
  const parPoints = [...lignes.values()].sort((x, y) => y.points - x.points);
  const res: LigneClassement[] = [];
  let i = 0;
  while (i < parPoints.length) {
    let j = i;
    while (j < parPoints.length && parPoints[j].points === parPoints[i].points) j++;
    const groupe = parPoints.slice(i, j).map((l) => l.paireId);
    for (const g of departager(groupe, 0)) {
      if (g.length > 1) {
        const ordre = departage ? [...g].sort((x, y) => departage.indexOf(x) - departage.indexOf(y)) : g;
        ordre.forEach((id) => res.push({ ...lignes.get(id)!, egaliteParfaite: !departage }));
      } else res.push(lignes.get(g[0])!);
    }
    i = j;
  }
  return res;
}

export const pouleTerminee = (p: Poule, matchs: Match[]) =>
  matchs.filter((m) => m.groupeId === p.id).every((m) => m.resultat);
