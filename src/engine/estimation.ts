// Estimation : la formule choisie tient-elle dans les journées, terrains et pauses prévus ?
import { planifier, versMinutes } from './planning';
import { formatsAutorises, type PhaseFormat } from './regles';
import { taillesPoules } from './poules';
import { estExempt, genererFormule, matchsMinimumGarantis, selection } from './tournoi';
import type { FormatCode, FormatsChoisis, Formule, Tournoi } from './types';

export interface Estimation {
  possible: boolean; // formule générable
  erreur?: string;
  nbMatchs: number;
  nbNonPlanifies: number;
  tient: boolean;
  /** Fin du dernier match (AAAA-MM-JJTHH:mm) */
  fin?: string;
  /** Minutes de terrain nécessaires / disponibles */
  minutesNecessaires: number;
  minutesDisponibles: number;
  matchsMini: number;
}

export function minutesDisponibles(t: Tournoi): number {
  let total = 0;
  for (const j of t.journees) {
    const d = versMinutes(j.date, j.debut), f = versMinutes(j.date, j.fin);
    let dispo = Math.max(0, f - d);
    for (const p of t.pauses.filter((x) => x.date === j.date)) {
      const pd = Math.max(d, versMinutes(p.date, p.debut)), pf = Math.min(f, versMinutes(p.date, p.fin));
      dispo -= Math.max(0, pf - pd);
    }
    total += dispo;
  }
  return total * t.terrains.length;
}

/** Simule le tirage (sans toucher au tournoi) puis le planning complet. */
export function estimer(t: Tournoi): Estimation {
  const base = { nbMatchs: 0, nbNonPlanifies: 0, tient: false, minutesNecessaires: 0, minutesDisponibles: minutesDisponibles(t), matchsMini: 0 };
  let sim: Tournoi;
  try {
    sim = genererFormule({ ...t, tirages: [] }, 1);
  } catch (e) {
    return { ...base, possible: false, erreur: (e as Error).message };
  }
  const reels = sim.matchs.filter((m) => !estExempt(sim, m));
  const { tournoi, nonPlanifies } = planifier(sim);
  const fin = tournoi.matchs
    .filter((m) => m.debut)
    .map((m) => versMinutes(m.debut!.slice(0, 10), m.debut!.slice(11, 16)) + t.reglages.dureeFormat[m.format])
    .reduce((a, b) => Math.max(a, b), 0);
  return {
    ...base,
    possible: true,
    nbMatchs: reels.length,
    nbNonPlanifies: nonPlanifies.length,
    tient: nonPlanifies.length === 0 && t.terrains.length > 0,
    fin: fin ? new Date(fin * 60000).toISOString().slice(0, 16) : undefined,
    minutesNecessaires: reels.reduce((s, m) => s + t.reglages.dureeFormat[m.format], 0),
    matchsMini: matchsMinimumGarantis(sim),
  };
}

export interface Suggestion {
  libelle: string;
  appliquer: (t: Tournoi) => Tournoi;
  estimation: Estimation;
}

/** Format autorisé le plus court (selon les durées réglées) pour une phase. */
function plusCourt(t: Tournoi, phase: PhaseFormat, actuel: FormatCode, tailleTour?: number): FormatCode {
  const ok = formatsAutorises(t.categorie, t.public, phase, tailleTour)
    .filter((f) => f !== 'E' && f !== 'F') // E/F imposent 5 matchs minimum
    .filter((f) => t.reglages.dureeFormat[f] < t.reglages.dureeFormat[actuel])
    .sort((a, b) => t.reglages.dureeFormat[b] - t.reglages.dureeFormat[a]);
  return ok[0] ?? actuel; // le cran juste en dessous
}

interface Variante { libelle: string; cout: number; appliquer: (t: Tournoi) => Tournoi }

/**
 * Pistes pour faire tenir le tournoi : formats plus courts, terrains en plus, horaires élargis,
 * pauses supprimées, autres formules — seules ou combinées. On teste d'abord les changements
 * les plus légers et on ne garde que ce qui tient (3 matchs minimum par paire).
 */
export function suggestions(t: Tournoi, max = 8): Suggestion[] {
  const f = t.formule.formats;
  const unCran: FormatsChoisis = {
    poules: plusCourt(t, 'QUALIF', f.poules),
    tableau: plusCourt(t, 'TABLEAU', f.tableau, 8),
    finale: plusCourt(t, 'FINALE', f.finale, 2),
    classement: plusCourt(t, 'CLASSEMENT', f.classement),
  };
  const plusCourtDe = (phase: PhaseFormat, tailleTour?: number) => {
    const ok = formatsAutorises(t.categorie, t.public, phase, tailleTour).filter((x) => x !== 'E' && x !== 'F');
    return ok.sort((a, b) => t.reglages.dureeFormat[a] - t.reglages.dureeFormat[b])[0];
  };
  const auMin: FormatsChoisis = {
    poules: plusCourtDe('QUALIF'), tableau: plusCourtDe('TABLEAU', 8), finale: plusCourtDe('FINALE', 2), classement: plusCourtDe('CLASSEMENT'),
  };
  const descFormats = (c: FormatsChoisis) => (Object.keys(f) as (keyof FormatsChoisis)[])
    .filter((k) => f[k] !== c[k]).map((k) => `${k} ${f[k]}→${c[k]}`).join(', ');
  const formats: Variante[] = [{ libelle: '', cout: 0, appliquer: (x) => x }];
  for (const c of [unCran, auMin]) {
    const d = descFormats(c);
    if (d && !formats.some((v) => v.libelle.includes(d)))
      formats.push({ libelle: `formats plus courts (${d})`, cout: 1, appliquer: (x) => ({ ...x, formule: { ...x.formule, formats: c } }) });
  }
  const terrains: Variante[] = [0, 1, 2, 3].map((n) => ({
    libelle: n ? `${n} terrain${n > 1 ? 's' : ''} en plus` : '', cout: n,
    appliquer: (x) => (n ? { ...x, terrains: [...x.terrains, ...Array.from({ length: n }, (_, i) => ({ id: `t${Date.now().toString(36)}${i}`, nom: `Terrain ${x.terrains.length + i + 1}` }))] } : x),
  }));
  const decaler = (h: string, m: number) => {
    const [a, b] = h.split(':').map(Number);
    const v = Math.min(23 * 60 + 59, Math.max(0, a * 60 + b + m));
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  };
  const horaires: Variante[] = [
    { libelle: '', cout: 0, appliquer: (x) => x },
    { libelle: 'journées élargies (1 h plus tôt, 2 h plus tard)', cout: 1, appliquer: (x) => ({ ...x, journees: x.journees.map((j) => ({ ...j, debut: decaler(j.debut, -60), fin: decaler(j.fin, 120) })) }) },
  ];
  if (t.pauses.length) horaires.push({ libelle: 'sans les pauses', cout: 1, appliquer: (x) => ({ ...x, pauses: [] }) });
  const N = selection(t).retenues.length;
  const formules: Variante[] = [{ libelle: '', cout: 0, appliquer: (x) => x }];
  for (let P = Math.max(1, Math.floor(N / 5)); P <= Math.floor(N / 3); P++) {
    const tl = taillesPoules(N, P);
    if (Math.min(...tl) < 3 || Math.max(...tl) > 5) continue;
    for (const k of [1, 2]) {
      if (t.formule.type === 'POULES_TABLEAU' && t.formule.nbPoules === P && t.formule.qualifiesParPoule === k) continue;
      const fo: Partial<Formule> = { type: 'POULES_TABLEAU', nbPoules: P, qualifiesParPoule: k };
      formules.push({ libelle: `${P} poules et ${k} qualifié${k > 1 ? 's' : ''} par poule`, cout: 1, appliquer: (x) => ({ ...x, formule: { ...x.formule, ...fo } }) });
    }
  }
  if (t.formule.type !== 'TMC') formules.push({ libelle: `TMC ${N} paires`, cout: 1, appliquer: (x) => ({ ...x, formule: { ...x.formule, type: 'TMC' } }) });

  const combos: { v: Variante[]; cout: number }[] = [];
  for (const a of formats) for (const b of terrains) for (const c of horaires) for (const d of formules) {
    const v = [a, b, c, d].filter((x) => x.cout > 0);
    if (v.length) combos.push({ v, cout: v.length * 10 + v.reduce((s, x) => s + x.cout, 0) });
  }
  combos.sort((x, y) => x.cout - y.cout);
  const res: Suggestion[] = [];
  let coutTrouve = Infinity;
  const trouves: Variante[][] = [];
  for (const c of combos) {
    if (res.length >= max || c.cout > coutTrouve + 12) break;
    // inutile de proposer une combinaison qui contient déjà une piste suffisante
    if (trouves.some((f) => f.every((v) => c.v.includes(v)))) continue;
    const appliquer = (x: Tournoi) => c.v.reduce((acc, v) => v.appliquer(acc), x);
    const e = estimer(appliquer(t));
    if (e.possible && e.tient && e.matchsMini >= 3) {
      const lib = c.v.map((v) => v.libelle).join(' + ');
      res.push({ libelle: lib.charAt(0).toUpperCase() + lib.slice(1), appliquer, estimation: e });
      coutTrouve = Math.min(coutTrouve, c.cout);
      trouves.push(c.v);
    }
  }
  return res;
}
