// Règles issues du Guide de la Compétition Padel FFT 2026 (publication juillet 2025).
// Les numéros de page renvoient au PDF « guide-de-la-competition-PADEL-2026 ».
import type { Categorie, Discipline, FormatCode, Public, Sexe } from './types';

// P50 (saison 2026-2027) : cuts confirmés ; formats, minimum de paires et durée encore provisoires (calqués sur le P25)
export const CATEGORIES: Categorie[] = ['P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P1500', 'P2000'];
export const FORMATS: FormatCode[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E', 'F'];

export interface DefFormat {
  libelle: string;
  /** Nombre de sets (ou manches) à gagner. */
  setsGagnants: number;
  /** Jeux pour gagner un set classique (0 si uniquement super jeu décisif). */
  jeux: number;
  /** Score (par paire) auquel se joue le jeu décisif. */
  jeuDecisifA: number;
  /** Le set décisif est un super jeu décisif à 10 points. */
  dernierSetSuperJD: boolean;
  pointDecisif: boolean;
}

// Chapitre I, « Les formats de jeu »
export const DEF_FORMATS: Record<FormatCode, DefFormat> = {
  A1: { libelle: '3 sets à 6 jeux, jeu décisif à 6-6', setsGagnants: 2, jeux: 6, jeuDecisifA: 6, dernierSetSuperJD: false, pointDecisif: false },
  A2: { libelle: '3 sets à 6 jeux, jeu décisif à 6-6, point décisif', setsGagnants: 2, jeux: 6, jeuDecisifA: 6, dernierSetSuperJD: false, pointDecisif: true },
  B1: { libelle: '2 sets à 6 jeux, jeu décisif à 6-6, 3e set = super jeu décisif', setsGagnants: 2, jeux: 6, jeuDecisifA: 6, dernierSetSuperJD: true, pointDecisif: false },
  B2: { libelle: '2 sets à 6 jeux, jeu décisif à 6-6, 3e set = super jeu décisif, point décisif', setsGagnants: 2, jeux: 6, jeuDecisifA: 6, dernierSetSuperJD: true, pointDecisif: true },
  C1: { libelle: '2 sets à 4 jeux, jeu décisif à 4-4, 3e set = super jeu décisif', setsGagnants: 2, jeux: 4, jeuDecisifA: 4, dernierSetSuperJD: true, pointDecisif: false },
  C2: { libelle: '2 sets à 4 jeux, jeu décisif à 4-4, 3e set = super jeu décisif, point décisif', setsGagnants: 2, jeux: 4, jeuDecisifA: 4, dernierSetSuperJD: true, pointDecisif: true },
  D1: { libelle: '1 set à 9 jeux, jeu décisif à 8-8', setsGagnants: 1, jeux: 9, jeuDecisifA: 8, dernierSetSuperJD: false, pointDecisif: false },
  D2: { libelle: '1 set à 9 jeux, jeu décisif à 8-8, point décisif', setsGagnants: 1, jeux: 9, jeuDecisifA: 8, dernierSetSuperJD: false, pointDecisif: true },
  E: { libelle: '1 super jeu décisif à 10 points', setsGagnants: 1, jeux: 0, jeuDecisifA: 0, dernierSetSuperJD: true, pointDecisif: true },
  F: { libelle: '1 set à 4 jeux, point décisif, jeu décisif à 3-3', setsGagnants: 1, jeux: 4, jeuDecisifA: 3, dernierSetSuperJD: false, pointDecisif: true },
};

/** Famille d'un format (A, B, C, D, E, F). */
export const famille = (f: FormatCode) => f[0] as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// Chapitre I, « Temps de repos minimum » (en minutes)
export function reposApres(f: FormatCode): number {
  switch (famille(f)) {
    case 'A': return 90;
    case 'B': return 60;
    case 'C':
    case 'D': return 30;
    case 'F': return 15;
    case 'E': return 0; // 15 min après 3 parties consécutives au format E (géré par le planning)
  }
}
export const REPOS_APRES_3_E = 15;
/** Repos minimum entre deux matchs joués sur deux journées différentes. */
export const REPOS_ENTRE_JOURNEES = 12 * 60;

export const DUREES_PAR_DEFAUT: Record<FormatCode, number> = {
  A1: 120, A2: 110, B1: 90, B2: 80, C1: 50, C2: 45, D1: 60, D2: 55, E: 15, F: 25,
};

/**
 * Chapitre I, « Nombre de matchs par jour » : renvoie les problèmes pour la liste
 * des formats joués par un joueur sur une journée.
 */
export function controleMatchsParJour(formats: FormatCode[]): string[] {
  const n = formats.length;
  const nb = (fam: string) => formats.filter((f) => famille(f) === fam).length;
  const A = nb('A'), B = nb('B'), CD = nb('C') + nb('D');
  const pb: string[] = [];
  if (n === 3 && A > 2) pb.push('3 matchs dans la journée : 2 matchs maximum au format A');
  if (n === 4) {
    if (A > 2) pb.push('4 matchs dans la journée : 2 matchs maximum au format A');
    if (B > 3) pb.push('4 matchs dans la journée : 3 matchs maximum au format B');
  }
  if (n === 5) {
    if (A > 0) pb.push('5 matchs dans la journée : aucun match au format A');
    if (B > 3) pb.push('5 matchs dans la journée : 3 matchs maximum au format B');
  }
  if (n === 6 && formats.some((f) => !['C', 'D'].includes(famille(f))))
    pb.push('6 matchs dans la journée : uniquement des formats C ou D');
  if (n >= 7) {
    if (A + B > 0) pb.push('7 matchs ou plus dans la journée : formats E/F (et 2 matchs C/D maximum) uniquement');
    if (CD > 2) pb.push('7 matchs ou plus dans la journée : 2 matchs maximum au format C ou D');
  }
  return pb;
}

// Chapitre II, « Règles d'équivalence » : classement Dames -> équivalence Messieurs
const EQUIVALENCES: [number, number][] = [
  [10, 400], [30, 1000], [60, 2000], [100, 3500], [200, 10000], [500, 15000],
  [1000, 25000], [2000, 35000], [3000, 45000], [5000, 55000], [10000, 70000],
];
export function equivalenceDameEnMessieurs(rangDame: number): number {
  for (const [max, ajout] of EQUIVALENCES) if (rangDame <= max) return rangDame + ajout;
  return rangDame + 90000;
}

export interface ContexteClassement {
  discipline: Discipline;
  rangNCMessieurs: number;
  rangNCDames: number;
}

/**
 * Classement retenu pour le poids d'une paire (Chapitre II) :
 * - épreuve mixte ou dames : classement du joueur dans son propre classement ;
 * - épreuve messieurs : une joueuse prend son équivalence Messieurs ;
 * - non classé(e) = dernier classé + 1 ; une joueuse NC en épreuve messieurs est NC Messieurs.
 */
export function classementRetenu(
  j: { sexe: Sexe; classement: number | null },
  ctx: ContexteClassement,
): number {
  if (j.sexe === 'H') return j.classement ?? ctx.rangNCMessieurs;
  if (ctx.discipline === 'DM') {
    return j.classement == null ? ctx.rangNCMessieurs : equivalenceDameEnMessieurs(j.classement);
  }
  return j.classement ?? ctx.rangNCDames;
}

/** Plus le poids est faible, plus la paire est forte. */
export function poidsPaire(
  p: { j1: { sexe: Sexe; classement: number | null }; j2: { sexe: Sexe; classement: number | null } },
  ctx: ContexteClassement,
): number {
  return classementRetenu(p.j1, ctx) + classementRetenu(p.j2, ctx);
}

// Chapitre II / III : « CUT » — les N meilleurs n'ont pas le droit de participer.
export function interdictionTop(cat: Categorie, discipline: Discipline, pub: Public, sexe: Sexe): number | null {
  // P50 (saison 2026-2027) : messieurs et hommes en mixte TOP 10 000, dames et femmes en mixte TOP 1 000
  if (cat === 'P50' && pub !== 'JEUNES') return sexe === 'H' || discipline === 'DM' ? 10000 : 1000;
  if (discipline === 'DX' || pub === 'JEUNES') return null;
  const dames = sexe === 'F' && discipline === 'DD';
  const seniorsPlus = pub === 'PLUS45' || pub === 'PLUS55';
  const table: Partial<Record<Categorie, [number, number, number, number]>> = {
    // [Messieurs seniors, Dames seniors, Messieurs +45/+55, Dames +45/+55]
    P25: [20000, 1000, 30000, 3000],
    P100: [2000, 300, 3000, 300],
    P250: [500, 100, 750, 100],
  };
  const t = table[cat];
  if (!t) return null;
  return dames ? (seniorsPlus ? t[3] : t[1]) : seniorsPlus ? t[2] : t[0];
}

// Chapitre III : nombre minimum de paires (seniors et seniors plus)
export function nbMinPaires(cat: Categorie, discipline: Discipline, pub: Public): number {
  if (pub === 'JEUNES') {
    if (discipline === 'DD') return 4;
    return cat === 'P250' ? 8 : 4;
  }
  const dames = discipline === 'DD';
  switch (cat) {
    case 'P25':
    case 'P50': return 4; // P50 provisoire
    case 'P100': return dames ? 4 : 8;
    case 'P250': return dames ? 4 : 12;
    case 'P500': return dames ? 8 : 16;
    case 'P1000': return dames ? 16 : 24;
    case 'P1500':
    case 'P2000': return dames ? 36 : 44;
  }
}

/** Nombre minimum de terrains (Chapitre III). */
export function nbMinTerrains(cat: Categorie, discipline: Discipline, pub: Public): number {
  if (pub === 'JEUNES') return cat === 'P250' ? 2 : 1;
  if (cat === 'P25' || cat === 'P50') return 1;
  if (cat === 'P100' || cat === 'P250') return 2;
  if (cat === 'P500' || cat === 'P1000') return discipline === 'DD' ? 2 : 3;
  return 4;
}

/** Durée maximum en jours (Chapitre III). */
export function dureeMaxJours(cat: Categorie, pub: Public): number {
  if (cat === 'P25' || cat === 'P50') return 1;
  if (pub === 'JEUNES') return 3;
  if (cat === 'P1500' || cat === 'P2000') return 3; // 2,5 jours
  return 3;
}

export type PhaseFormat = 'QUALIF' | 'TABLEAU' | 'FINALE' | 'CLASSEMENT';

const TOUS = FORMATS;
const SAUF_EF = FORMATS.filter((f) => f !== 'E' && f !== 'F');
const AB = ['A1', 'A2', 'B1', 'B2'] as FormatCode[];

/**
 * Formats autorisés (Chapitre III, cahiers des charges).
 * `tailleTour` = nombre de paires du tour dans le tableau principal (2 = finale, 4 = 1/2, 8 = 1/4...).
 * Les poules sont traitées comme des qualifications.
 */
export function formatsAutorises(cat: Categorie, pub: Public, phase: PhaseFormat, tailleTour?: number): FormatCode[] {
  if (pub === 'JEUNES') {
    const avecPD: FormatCode[] = ['A2', 'B2', 'C2', 'D2'];
    if (cat === 'P25' || cat === 'P50') return [...avecPD, 'E', 'F'];
    if (cat === 'P250' && phase === 'FINALE') return ['A2', 'B2'];
    return avecPD;
  }
  switch (cat) {
    case 'P25':
    case 'P50':
      return ['C1', 'C2', 'D1', 'D2', 'E', 'F'];
    case 'P100':
      return SAUF_EF;
    case 'P250':
      return phase === 'FINALE' ? AB : SAUF_EF;
    case 'P500':
      if (phase === 'CLASSEMENT' || phase === 'QUALIF') return SAUF_EF;
      if (phase === 'FINALE' || (tailleTour ?? 99) <= 4) return AB;
      return SAUF_EF;
    case 'P1000':
      if (phase === 'CLASSEMENT') return SAUF_EF;
      if (phase === 'QUALIF') return AB;
      if (phase === 'FINALE' || (tailleTour ?? 99) <= 16) return ['A1', 'A2'];
      return AB;
    case 'P1500':
    case 'P2000':
      if (phase === 'CLASSEMENT' || phase === 'QUALIF') return ['B1'];
      if (phase === 'FINALE' || (tailleTour ?? 99) <= 16) return ['A1', 'A2'];
      return ['B1'];
  }
  return TOUS;
}

/** Formats conseillés par défaut pour une catégorie. */
export function formatsParDefaut(cat: Categorie, pub: Public) {
  if (pub === 'JEUNES') return { poules: 'C2', tableau: 'C2', finale: cat === 'P250' ? 'B2' : 'C2', classement: 'C2' } as const;
  switch (cat) {
    case 'P25':
    case 'P50': return { poules: 'C2', tableau: 'C2', finale: 'C2', classement: 'C2' } as const;
    case 'P100': return { poules: 'C2', tableau: 'B2', finale: 'B2', classement: 'C2' } as const;
    case 'P250': return { poules: 'B2', tableau: 'B2', finale: 'B2', classement: 'C2' } as const;
    case 'P500': return { poules: 'B2', tableau: 'B2', finale: 'B2', classement: 'C2' } as const;
    case 'P1000': return { poules: 'B2', tableau: 'A2', finale: 'A2', classement: 'B2' } as const;
    default: return { poules: 'B1', tableau: 'A1', finale: 'A1', classement: 'B1' } as const;
  }
}

/** Sélection des paires (Chapitre I) : par ordre d'inscription jusqu'au P250, au classement au-delà. */
export const selectionAuClassement = (cat: Categorie) => !['P25', 'P50', 'P100', 'P250'].includes(cat);

/** Matchs minimum proposés par paire (Chapitre I). */
export const matchsMinimum = (formatsUtilises: FormatCode[]) =>
  formatsUtilises.some((f) => f === 'E' || f === 'F') ? 5 : 3;

// Chapitre I, « Etats des résultats et classement des poules »
export const POINTS_POULE = { victoire: 2, defaite: 1, disqualification: -1, wo: -2 };

/** Contrôle d'un score par rapport au format. Renvoie un message d'erreur ou null. */
export function controleScore(format: FormatCode, sets: [number, number][]): string | null {
  const d = DEF_FORMATS[format];
  if (sets.length === 0) return 'Aucun set saisi';
  const maxSets = d.setsGagnants * 2 - 1;
  if (sets.length > maxSets) return `Trop de sets pour le format ${format}`;
  let ga = 0, gb = 0;
  for (let i = 0; i < sets.length; i++) {
    if (ga === d.setsGagnants || gb === d.setsGagnants) return 'Set joué après la fin du match';
    const [a, b] = sets[i];
    const superJD = (d.jeux === 0) || (d.dernierSetSuperJD && i === maxSets - 1);
    const err = superJD ? controleSuperJD(a, b) : controleSet(d, a, b);
    if (err) return `Set ${i + 1} : ${err}`;
    if (a > b) ga++; else gb++;
  }
  if (ga !== d.setsGagnants && gb !== d.setsGagnants) return 'Match incomplet';
  return null;
}

function controleSuperJD(a: number, b: number): string | null {
  const [w, l] = a > b ? [a, b] : [b, a];
  if (w < 10) return 'un super jeu décisif se joue en 10 points';
  if (w - l < 2) return '2 points d\'écart nécessaires';
  if (w > 10 && w - l !== 2) return 'score de super jeu décisif impossible';
  return null;
}

function controleSet(d: DefFormat, a: number, b: number): string | null {
  const [w, l] = a > b ? [a, b] : [b, a];
  const g = d.jeux;
  if (a === b) return 'égalité impossible';
  if (w === g && l <= g - 2) return null;
  if (d.jeuDecisifA === g) {
    if (w === g + 1 && (l === g - 1 || l === g)) return null;
  } else if (w === g && l === g - 1) {
    return null; // jeu décisif à (g-1)-(g-1)
  }
  return `score ${a}-${b} impossible en ${g} jeux`;
}
