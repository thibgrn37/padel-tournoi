// Tableaux à places (TMC / tableau final avec matchs de classement).
// Chaque tour sépare les vainqueurs (places hautes) des perdants (places basses),
// ce qui donne une place distincte à chaque paire.
import type { FormatsChoisis, Match, Ref, Tableau } from './types';
import { Journal, melanger, type Rng } from './tirage';

export const puissance2 = (n: number) => {
  let s = 1;
  while (s < n) s *= 2;
  return Math.max(s, 2);
};

/**
 * Positions (0 = haut du tableau) des têtes de série 1..S.
 * Règle FFT : TS 1 en bas du tableau, TS 2 en haut.
 */
export function positionsTetesDeSerie(S: number): number[] {
  let p = [1, 2];
  while (p.length < S) {
    const n = p.length * 2;
    p = p.flatMap((x, i) => (i % 2 === 0 ? [x, n + 1 - x] : [n + 1 - x, x]));
  }
  // p[i] = numéro de tête de série à la position i (TS1 en haut) ; on inverse pour TS1 en bas
  p.reverse();
  const pos = new Array<number>(S);
  p.forEach((seed, i) => (pos[seed - 1] = i));
  return pos;
}

/** Chapeaux de tirage : [1], [2], [3-4], [5-8], [9-16]... (numéros de TS, base 1). */
export function chapeaux(S: number): number[][] {
  const res: number[][] = [[1], [2]];
  for (let a = 3; a <= S; a = 2 * a - 1) {
    const b = Math.min(2 * a - 2, S);
    res.push(Array.from({ length: b - a + 1 }, (_, i) => a + i));
  }
  return res.filter((ch) => ch[0] <= S);
}

export function creerTableau(
  id: string,
  nom: string,
  nbEntrants: number,
  rangDebut: number,
  origine: Tableau['origine'],
  principal: boolean,
): Tableau {
  const taille = puissance2(nbEntrants);
  const pos = positionsTetesDeSerie(taille);
  const byes: number[] = [];
  for (let s = nbEntrants + 1; s <= taille; s++) byes.push(pos[s - 1]);
  const slots: (string | null)[] = new Array(taille).fill(null);
  byes.forEach((b) => (slots[b] = 'BYE'));
  return { id, nom, taille, rangDebut, slots, byes, origine, principal };
}

const libelleTour = (n: number) => (n === 2 ? 'Finale' : n === 4 ? '1/2 finale' : `1/${n / 2} de finale`);

export function genererMatchsTableau(t: Tableau, formats: FormatsChoisis, ordreBase: number): Match[] {
  const matchs: Match[] = [];
  let c = 0;
  const S = t.taille;
  const tours = Math.log2(S);
  const gen = (refs: Ref[], rang: number, chemPrincipal: boolean, bloc: string) => {
    const n = refs.length;
    const tour = tours - Math.log2(n); // 0 = premier tour
    const gagnants: Ref[] = [];
    const perdants: Ref[] = [];
    for (let i = 0; i < n / 2; i++) {
      const id = `${t.id}-${++c}`;
      const principal = t.principal && chemPrincipal;
      let libelle: string;
      if (principal) libelle = `${t.nom} · ${libelleTour(n)}`;
      else if (n === 2) libelle = `Match pour la ${rang}e place`;
      else libelle = `Places ${rang} à ${rang + n - 1} · ${n === 4 ? '1/2' : `tour à ${n}`}`;
      if (n / 2 > 1) libelle += ` (${i + 1})`;
      const m: Match = {
        id,
        libelle,
        phase: principal ? 'TABLEAU' : 'CLASSEMENT',
        groupeId: t.id,
        bloc,
        ordre: ordreBase + tour * 1000 + (t.principal ? 0 : 500) + i,
        a: refs[2 * i],
        b: refs[2 * i + 1],
        format: principal ? (n === 2 ? formats.finale : formats.tableau) : formats.classement,
      };
      if (principal) m.tailleTour = n;
      if (n === 2) m.places = [rang, rang + 1];
      matchs.push(m);
      gagnants.push({ k: 'gagnant', matchId: id });
      perdants.push({ k: 'perdant', matchId: id });
    }
    if (n > 2) {
      gen(gagnants, rang, chemPrincipal, bloc);
      const blocPerdants = chemPrincipal ? `Places ${rang + n / 2} à ${rang + n - 1}` : bloc;
      gen(perdants, rang + n / 2, false, blocPerdants);
    }
  };
  const refs: Ref[] = Array.from({ length: S }, (_, idx) => ({ k: 'slot', tableauId: t.id, idx }));
  gen(refs, t.rangDebut, true, t.principal ? t.nom : `Places ${t.rangDebut} et suivantes`);
  return matchs;
}

/**
 * Tirage d'un tableau : les entrants sont donnés du plus fort au plus faible.
 * TS1 et TS2 sont placées, puis chaque chapeau (3-4, 5-8, 9-16...) est tiré au sort
 * sur les emplacements qui lui sont réservés. Les exempts (BYE) vont face aux meilleures TS.
 * `memeGroupe` permet d'éviter que deux paires d'une même poule se rencontrent au 1er tour.
 */
export function tirerTableau(
  t: Tableau,
  entrants: string[],
  rng: Rng,
  journal: Journal,
  nom: (id: string) => string,
  memeGroupe?: (a: string, b: string) => boolean,
): Tableau {
  const S = t.taille;
  const pos = positionsTetesDeSerie(S);
  const N = entrants.length;
  const essai = () => {
    const slots: (string | null)[] = new Array(S).fill(null);
    t.byes.forEach((b) => (slots[b] = 'BYE'));
    const traces: string[] = [];
    for (const ch of chapeaux(S)) {
      const reels = ch.filter((s) => s <= N);
      if (!reels.length) continue;
      const positions = reels.map((s) => pos[s - 1]);
      const tirees = reels.length > 1 ? melanger(positions, rng) : positions;
      reels.forEach((s, i) => (slots[tirees[i]] = entrants[s - 1]));
      if (reels.length > 1)
        traces.push(`Chapeau ${reels[0]}-${reels[reels.length - 1]} : ` +
          reels.map((s, i) => `${nom(entrants[s - 1])} → ligne ${tirees[i] + 1}`).join(' ; '));
    }
    return { slots, traces };
  };
  let res = essai();
  if (memeGroupe) {
    const conflit = (slots: (string | null)[]) => {
      for (let i = 0; i < S; i += 2) {
        const [a, b] = [slots[i], slots[i + 1]];
        if (a && b && a !== 'BYE' && b !== 'BYE' && memeGroupe(a, b)) return true;
      }
      return false;
    };
    let n = 0;
    while (conflit(res.slots) && n++ < 500) res = essai();
    if (conflit(res.slots)) journal.log('Impossible d\'éviter toutes les rencontres entre paires d\'une même poule au 1er tour.');
    else if (n > 0) journal.log(`Tirage refait ${n} fois pour éviter les rencontres entre paires d'une même poule au 1er tour.`);
  }
  // Tableau final : autant de TS que la moitié des places du 1er tour (Chapitre I, constitution des tableaux)
  const tetesDeSerie = entrants.slice(0, Math.min(N, S / 2));
  journal.log(`Têtes de série : ` + tetesDeSerie.map((id, i) => `TS${i + 1} ${nom(id)}`).join(' ; '));
  journal.log(`TS 1 : ${nom(entrants[0])} (en bas du tableau)`);
  if (N > 1) journal.log(`TS 2 : ${nom(entrants[1])} (en haut du tableau)`);
  res.traces.forEach((x) => journal.log(x));
  if (t.byes.length) journal.log(`${t.byes.length} exempt(s) placé(s) face aux meilleures têtes de série.`);
  return { ...t, slots: res.slots, tetesDeSerie };
}

/** Numéro de tête de série d'une paire dans un tableau (undefined si non TS). */
export function numeroTS(tab: Tableau, paireId: string, ordrePaires?: string[]): number | undefined {
  const ts = tab.tetesDeSerie ?? (tab.origine.type === 'INSCRITS' && ordrePaires ? ordrePaires.slice(0, tab.taille / 2) : []);
  const i = ts.indexOf(paireId);
  return i >= 0 ? i + 1 : undefined;
}
