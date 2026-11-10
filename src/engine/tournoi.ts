// Orchestration : paires engagées, ordre officiel, création de la formule, tirages, résultats.
import {
  DUREES_PAR_DEFAUT, formatsParDefaut, poidsPaire, selectionAuClassement, DEF_FORMATS,
} from './regles';
import { classementPoule, constituerPoules, genererMatchsPoule, pouleTerminee } from './poules';
import { creerTableau, genererMatchsTableau, tirerTableau } from './tableau';
import { creerRng, Journal, nouvelleGraine, trierAvecTirage } from './tirage';
import type { Match, Paire, Ref, Resultat, Tableau, Tournoi } from './types';

export function nouveauTournoi(): Tournoi {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return {
    version: 1,
    nom: 'Nouveau tournoi',
    categorie: 'P100',
    discipline: 'DM',
    public: 'SENIORS',
    damesAutorisees: true,
    journees: [{ date: aujourdhui, debut: '09:00', fin: '22:00' }],
    pauses: [],
    terrains: [{ id: 't1', nom: 'Terrain 1' }, { id: 't2', nom: 'Terrain 2' }],
    reglages: { rangNCMessieurs: 150000, rangNCDames: 20000, dureeFormat: { ...DUREES_PAR_DEFAUT }, nbMaxPaires: 0 },
    paires: [],
    formule: {
      type: 'POULES_TABLEAU', nbPoules: 4, methodePoules: 'SERPENTIN', qualifiesParPoule: 2,
      formats: { ...formatsParDefaut('P100', 'SENIORS') },
    },
    poules: [],
    tableaux: [],
    matchs: [],
    tirages: [],
  };
}

export const nomJoueur = (j: Paire['j1']) => `${j.prenom} ${j.nom}`.trim();
export const nomPaire = (p: Paire) => `${p.j1.nom || p.j1.prenom} / ${p.j2.nom || p.j2.prenom}`;

export function poids(t: Tournoi, p: Paire): number {
  return poidsPaire(p, { discipline: t.discipline, rangNCMessieurs: t.reglages.rangNCMessieurs, rangNCDames: t.reglages.rangNCDames });
}

/** Paires retenues et liste d'attente, selon la règle de sélection de la catégorie. */
export function selection(t: Tournoi): { retenues: Paire[]; attente: Paire[] } {
  const actives = t.paires.filter((p) => !p.forfait);
  const tri = selectionAuClassement(t.categorie)
    ? [...actives].sort((a, b) => poids(t, a) - poids(t, b) || a.ordreInscription - b.ordreInscription)
    : [...actives].sort((a, b) => a.ordreInscription - b.ordreInscription);
  const max = t.reglages.nbMaxPaires;
  if (!max || tri.length <= max) return { retenues: tri, attente: [] };
  return { retenues: tri.slice(0, max), attente: tri.slice(max) };
}

export const paireParId = (t: Tournoi, id: string) => t.paires.find((p) => p.id === id);
export const nomPaireId = (t: Tournoi, id: string | null | undefined) => {
  if (!id) return '—';
  if (id === 'BYE') return 'Exempt';
  const p = paireParId(t, id);
  return p ? nomPaire(p) : '?';
};

/** Supprime la formule (poules, tableaux, matchs, ordre). Le journal des tirages est conservé. */
export function reinitialiserFormule(t: Tournoi): Tournoi {
  return { ...t, ordrePaires: undefined, poules: [], tableaux: [], matchs: [] };
}

/**
 * Étape « tirage » : ordre officiel des paires (poids croissant, égalités tirées au sort),
 * constitution des poules ou du TMC, création de tous les matchs.
 */
export function genererFormule(t0: Tournoi, graine = nouvelleGraine()): Tournoi {
  const t = reinitialiserFormule(t0);
  const rng = creerRng(graine);
  const nom = (id: string) => nomPaireId(t, id);
  const { retenues } = selection(t);
  if (retenues.length < 2) throw new Error('Il faut au moins 2 paires.');
  const j = new Journal(`Ordre des paires et tirage — ${t.formule.type === 'TMC' ? 'TMC' : 'poules'}`, graine);
  const ordre = trierAvecTirage(retenues, (p) => poids(t, p), nomPaire, rng, j).map((p) => p.id);
  j.log('Ordre officiel : ' + ordre.map((id, i) => `${i + 1}. ${nom(id)} (${poids(t, paireParId(t, id)!)})`).join(' ; '));
  const f = t.formule;
  let poules = [] as Tournoi['poules'];
  let tableaux: Tableau[] = [];
  let matchs: Match[] = [];
  if (f.type === 'TMC') {
    let tab = creerTableau('tf', 'Tableau', ordre.length, 1, { type: 'INSCRITS' }, true);
    tab = tirerTableau(tab, ordre, rng, j, nom);
    tableaux = [tab];
    matchs = genererMatchsTableau(tab, f.formats, 0);
  } else {
    const P = f.nbPoules;
    if (P < 1 || ordre.length < 2 * P) throw new Error('Il faut au moins 2 paires par poule (2 têtes de série par poule).');
    poules = constituerPoules(ordre, P, f.methodePoules, rng, j, nom);
    poules.forEach((p, i) => matchs.push(...genererMatchsPoule(p, f.formats.poules, i)));
    const k = Math.max(1, f.qualifiesParPoule);
    const Q = poules.reduce((s, p) => s + Math.min(k, p.paires.length), 0);
    const R = ordre.length - Q;
    const rangsQ = Array.from({ length: k }, (_, i) => i + 1);
    const tf = creerTableau('tf', 'Tableau final', Q, 1, { type: 'POULES', rangs: rangsQ }, true);
    tableaux.push(tf);
    matchs.push(...genererMatchsTableau(tf, f.formats, 10000));
    if (R >= 2) {
      const maxTaille = Math.max(...poules.map((p) => p.paires.length));
      const rangsC = Array.from({ length: maxTaille - k }, (_, i) => k + i + 1);
      const tc = creerTableau('tc', 'Classement', R, Q + 1, { type: 'POULES', rangs: rangsC }, false);
      tableaux.push(tc);
      matchs.push(...genererMatchsTableau(tc, f.formats, 10000));
    }
  }
  return { ...t, ordrePaires: ordre, poules, tableaux, matchs, tirages: [...t.tirages, j.vers()] };
}

/** Résout une référence : id de paire, 'BYE', ou null si pas encore connue. */
export function resoudre(t: Tournoi, ref: Ref): string | null {
  switch (ref.k) {
    case 'paire': return ref.id;
    case 'slot': return t.tableaux.find((x) => x.id === ref.tableauId)?.slots[ref.idx] ?? null;
    case 'gagnant':
    case 'perdant': {
      const m = t.matchs.find((x) => x.id === ref.matchId);
      if (!m) return null;
      const a = resoudre(t, m.a), b = resoudre(t, m.b);
      if (a === 'BYE' && b === 'BYE') return 'BYE';
      if (a === 'BYE' || b === 'BYE') {
        const reel = a === 'BYE' ? b : a;
        return ref.k === 'gagnant' ? reel : 'BYE';
      }
      if (!m.resultat) return null;
      const g = m.resultat.vainqueur === 'A' ? a : b;
      const p = m.resultat.vainqueur === 'A' ? b : a;
      return ref.k === 'gagnant' ? g : p;
    }
  }
}

/** Le match oppose-t-il un exempt (connu dès la création de la formule) ? */
export function estExempt(t: Tournoi, m: Match): boolean {
  const struct = (ref: Ref): 'BYE' | 'X' => {
    if (ref.k === 'paire') return 'X';
    if (ref.k === 'slot') return t.tableaux.find((x) => x.id === ref.tableauId)?.byes.includes(ref.idx) ? 'BYE' : 'X';
    const src = t.matchs.find((x) => x.id === ref.matchId)!;
    const a = struct(src.a), b = struct(src.b);
    if (a === 'BYE' && b === 'BYE') return 'BYE';
    if (a === 'BYE' || b === 'BYE') return ref.k === 'gagnant' ? 'X' : 'BYE';
    return 'X';
  };
  return struct(m.a) === 'BYE' || struct(m.b) === 'BYE';
}

/** Matchs dont dépend ce match (hors exempts, en remontant à travers eux). */
export function predecesseurs(t: Tournoi, m: Match): Match[] {
  const res: Match[] = [];
  const visiter = (ref: Ref) => {
    if (ref.k === 'gagnant' || ref.k === 'perdant') {
      const src = t.matchs.find((x) => x.id === ref.matchId)!;
      if (estExempt(t, src)) { visiter(src.a); visiter(src.b); } else res.push(src);
    } else if (ref.k === 'slot') {
      const tab = t.tableaux.find((x) => x.id === ref.tableauId)!;
      if (tab.origine.type === 'POULES' && !tab.byes.includes(ref.idx)) res.push(...t.matchs.filter((x) => x.phase === 'POULE'));
    }
  };
  visiter(m.a);
  visiter(m.b);
  return [...new Set(res)];
}

/** Les poules sont toutes terminées et les tableaux qui en dépendent pas encore tirés. */
export function tableauxATirer(t: Tournoi): Tableau[] {
  if (!t.poules.length || !t.poules.every((p) => pouleTerminee(p, t.matchs))) return [];
  return t.tableaux.filter((x) => x.origine.type === 'POULES' && x.slots.some((s) => s === null));
}

/**
 * Tirage des tableaux issus des poules : les égalités parfaites de poule sont tirées au sort,
 * puis les paires sont ordonnées par rang de poule puis par poids, et placées par chapeaux
 * en évitant deux paires de la même poule au 1er tour.
 */
export function tirerTableauxApresPoules(t: Tournoi, graine = nouvelleGraine()): Tournoi {
  const rng = creerRng(graine);
  const j = new Journal('Tirage des tableaux après les poules', graine);
  const nom = (id: string) => nomPaireId(t, id);
  const ordre = t.ordrePaires ?? [];
  const rangs = new Map<string, number>();
  const pouleDe = new Map<string, string>();
  const poules = t.poules.map((p) => {
    let cl = classementPoule(p, t.matchs);
    let departage = p.departage;
    if (cl.some((l) => l.egaliteParfaite)) {
      const ids = cl.filter((l) => l.egaliteParfaite).map((l) => l.paireId);
      departage = trierAvecTirage(ids, () => 0, nom, rng);
      j.log(`${p.nom} : égalité parfaite entre ${ids.map(nom).join(', ')} → ordre tiré : ${departage.map(nom).join(', ')}`);
      cl = classementPoule(p, t.matchs, departage);
    }
    cl.forEach((l, i) => { rangs.set(l.paireId, i + 1); pouleDe.set(l.paireId, p.id); });
    return { ...p, departage };
  });
  const tableaux = t.tableaux.map((tab) => {
    if (tab.origine.type !== 'POULES' || !tab.slots.some((s) => s === null)) return tab;
    const rs = tab.origine.rangs;
    const entrants = [...rangs.keys()]
      .filter((id) => rs.includes(rangs.get(id)!))
      .sort((a, b) => rangs.get(a)! - rangs.get(b)! || ordre.indexOf(a) - ordre.indexOf(b));
    j.log(`${tab.nom} — ordre des paires : ` + entrants.map((id, i) => `${i + 1}. ${nom(id)} (${rangs.get(id)}e ${pouleDe.get(id)!.replace('poule-', 'poule ')})`).join(' ; '));
    return tirerTableau(tab, entrants, rng, j, nom, (a, b) => pouleDe.get(a) === pouleDe.get(b));
  });
  return { ...t, poules, tableaux, tirages: [...t.tirages, j.vers()] };
}

/** Score forfaitaire selon le format (WO). */
export function scoreForfait(format: Match['format'], vainqueur: 'A' | 'B'): [number, number][] {
  const d = DEF_FORMATS[format];
  const set = (g: number): [number, number] => (vainqueur === 'A' ? [g, 0] : [0, g]);
  if (d.jeux === 0) return [set(10)];
  return Array.from({ length: d.setsGagnants }, () => set(d.jeux));
}

/** Matchs déjà joués qui dépendent de ce match (le résultat ne peut plus être modifié librement). */
export function dependantsJoues(t: Tournoi, matchId: string): Match[] {
  const res: Match[] = [];
  const suivre = (id: string) => {
    for (const m of t.matchs) {
      const refs = [m.a, m.b];
      if (refs.some((r) => (r.k === 'gagnant' || r.k === 'perdant') && r.matchId === id)) {
        if (m.resultat) res.push(m);
        suivre(m.id);
      }
    }
  };
  suivre(matchId);
  return res;
}

/** Paires sorties du tournoi : perdantes d'un match sur WO, abandon ou disqualification. */
export function pairesSorties(t: Tournoi): Set<string> {
  const res = new Set<string>();
  for (const m of t.matchs) {
    if (!m.resultat || m.resultat.issue === 'NORMAL') continue;
    const p = resoudre(t, { k: 'perdant', matchId: m.id });
    if (p && p !== 'BYE') res.add(p);
  }
  return res;
}

/**
 * Une paire sortie (abandon, WO, disqualification) ne joue plus : chacun de ses matchs suivants
 * est donné gagné par WO à l'adversaire et retiré du planning. Recalculé à chaque modification,
 * donc annuler le WO d'origine remet les matchs suivants à jouer.
 */
export function propagerSorties(t: Tournoi): Tournoi {
  let matchs = t.matchs.map((m) => (m.resultat?.auto ? { ...m, resultat: undefined } : m));
  for (let tour = 0; tour <= matchs.length; tour++) {
    const x = { ...t, matchs };
    const sorties = pairesSorties(x);
    let change = false;
    matchs = matchs.map((m) => {
      if (m.resultat || !sorties.size) return m;
      const a = resoudre(x, m.a), b = resoudre(x, m.b);
      if (!a || !b || a === 'BYE' || b === 'BYE' || (!sorties.has(a) && !sorties.has(b))) return m;
      change = true;
      const vainqueur = sorties.has(a) && !sorties.has(b) ? 'B' : 'A';
      return { ...m, debut: undefined, terrainId: undefined, verrouille: undefined, resultat: { sets: scoreForfait(m.format, vainqueur), vainqueur, issue: 'WO' as const, auto: true } };
    });
    if (!change) break;
  }
  const inchange = matchs.every((m, i) => JSON.stringify(m) === JSON.stringify(t.matchs[i]));
  return inchange ? t : { ...t, matchs };
}

export function saisirResultat(t: Tournoi, matchId: string, r: Resultat | undefined): Tournoi {
  return { ...t, matchs: t.matchs.map((m) => (m.id === matchId ? { ...m, resultat: r } : m)) };
}

export interface LigneFinale { place: number; paireId: string }

/** Classement final (places distinctes). Les exempts sont retirés et les places resserrées. */
export function classementFinal(t: Tournoi): { lignes: LigneFinale[]; complet: boolean } {
  const brut: LigneFinale[] = [];
  let complet = true;
  for (const m of t.matchs) {
    if (!m.places) continue;
    const a = resoudre(t, m.a), b = resoudre(t, m.b);
    const exempt = a === 'BYE' || b === 'BYE';
    if (!exempt && !m.resultat) { complet = false; continue; }
    const g = resoudre(t, { k: 'gagnant', matchId: m.id });
    const p = resoudre(t, { k: 'perdant', matchId: m.id });
    if (g && g !== 'BYE') brut.push({ place: m.places[0], paireId: g });
    if (p && p !== 'BYE') brut.push({ place: m.places[1], paireId: p });
  }
  brut.sort((x, y) => x.place - y.place);
  // paire restée seule hors tableau (ex. une seule paire classée après les qualifiés)
  if (complet && t.ordrePaires && t.poules.every((p) => pouleTerminee(p, t.matchs))) {
    const places = new Set(brut.map((l) => l.paireId));
    const restes = t.ordrePaires.filter((id) => !places.has(id));
    restes.forEach((id) => brut.push({ place: Infinity, paireId: id }));
  }
  return { lignes: brut.map((l, i) => ({ ...l, place: i + 1 })), complet: complet && brut.length > 0 };
}

/** Nombre de matchs joués ou à jouer par paire pour la vérification des 3 matchs minimum. */
export function matchsMinimumGarantis(t: Tournoi): number {
  let min = Infinity;
  const pouleMin = t.poules.length ? Math.min(...t.poules.map((p) => p.paires.length - 1)) : 0;
  for (const tab of t.tableaux) {
    const ms = t.matchs.filter((m) => m.groupeId === tab.id);
    for (let idx = 0; idx < tab.taille; idx++) {
      if (tab.byes.includes(idx)) continue;
      // parcours de tous les chemins possibles
      const explorer = (ref: Ref, n: number): number => {
        const m = ms.find((x) => sameRef(x.a, ref) || sameRef(x.b, ref));
        if (!m) return n;
        if (estExempt(t, m)) return explorer({ k: 'gagnant', matchId: m.id }, n);
        return Math.min(explorer({ k: 'gagnant', matchId: m.id }, n + 1), explorer({ k: 'perdant', matchId: m.id }, n + 1));
      };
      min = Math.min(min, explorer({ k: 'slot', tableauId: tab.id, idx }, 0) + (tab.origine.type === 'POULES' ? pouleMin : 0));
    }
  }
  return min === Infinity ? pouleMin : min;
}

const sameRef = (a: Ref, b: Ref) => JSON.stringify(a) === JSON.stringify(b);
