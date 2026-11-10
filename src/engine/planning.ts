// Programmation automatique des matchs sur les terrains et les créneaux disponibles.
import { controleMatchsParJour, reposApres, REPOS_ENTRE_JOURNEES } from './regles';
import { estExempt, nomPaireId, predecesseurs, resoudre } from './tournoi';
import type { Match, Tournoi } from './types';

export const versMinutes = (date: string, heure: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = heure.split(':').map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + h * 60 + mi;
};
export const debutEnMinutes = (debut: string) => versMinutes(debut.slice(0, 10), debut.slice(11, 16));
export const versTexte = (min: number) => {
  const d = new Date(min * 60000);
  return d.toISOString().slice(0, 16);
};
const jour = (min: number) => Math.floor(min / 1440);

interface Intervalle { debut: number; fin: number }

export interface ResultatPlanning {
  tournoi: Tournoi;
  nonPlanifies: Match[];
}

export function duree(t: Tournoi, m: Match) {
  return t.reglages.dureeFormat[m.format];
}

/**
 * Planifie tous les matchs sans résultat et non verrouillés. Les matchs joués ou verrouillés
 * restent à leur place. Respecte : créneaux des journées, pauses, temps de repos après chaque
 * format, 12 h entre deux journées, aucun match après minuit.
 */
export function planifier(t: Tournoi): ResultatPlanning {
  const fenetres: Intervalle[] = t.journees
    .map((j) => ({ debut: versMinutes(j.date, j.debut), fin: Math.min(versMinutes(j.date, j.fin), versMinutes(j.date, '00:00') + 1440) }))
    .filter((f) => f.fin > f.debut)
    .sort((a, b) => a.debut - b.debut);
  const pauses: Intervalle[] = t.pauses.map((p) => ({ debut: versMinutes(p.date, p.debut), fin: versMinutes(p.date, p.fin) }));
  const occupation = new Map<string, Intervalle[]>(t.terrains.map((c) => [c.id, []]));

  const fixes = new Map<string, Match>();
  const aPlanifier: Match[] = [];
  for (const m of t.matchs) {
    if (estExempt(t, m) || m.resultat?.auto) continue;
    if ((m.resultat || m.verrouille) && m.debut && m.terrainId && occupation.has(m.terrainId)) {
      fixes.set(m.id, m);
      const d = debutEnMinutes(m.debut);
      occupation.get(m.terrainId)!.push({ debut: d, fin: d + duree(t, m) });
    } else aPlanifier.push(m);
  }
  const places = new Map<string, { debut: number; fin: number; terrainId: string }>();
  for (const m of fixes.values()) {
    const d = debutEnMinutes(m.debut!);
    places.set(m.id, { debut: d, fin: d + duree(t, m), terrainId: m.terrainId! });
  }
  const preds = new Map(aPlanifier.map((m) => [m.id, predecesseurs(t, m)]));
  const paires = (m: Match) => [resoudre(t, m.a), resoudre(t, m.b)].filter((x): x is string => !!x && x !== 'BYE');
  const matchsDePaire = new Map<string, Match[]>();
  for (const m of t.matchs) for (const p of paires(m)) matchsDePaire.set(p, [...(matchsDePaire.get(p) ?? []), m]);

  // Contrainte « après un match » : repos selon le format + 12 h si changement de journée
  const apres = (s: number, finPrec: number, formatPrec: Match['format']) => {
    let x = Math.max(s, finPrec + reposApres(formatPrec));
    if (jour(x) !== jour(finPrec) && x < finPrec + REPOS_ENTRE_JOURNEES) x = finPrec + REPOS_ENTRE_JOURNEES;
    return x;
  };

  const plusTot = (m: Match, terrainId: string, plancher = 0): number | null => {
    const d = duree(t, m);
    let s = Math.max(fenetres[0]?.debut ?? 0, plancher);
    for (const p of preds.get(m.id)!) {
      const pl = places.get(p.id);
      if (!pl) return null;
      s = apres(s, pl.fin, p.format);
    }
    const autres = paires(m).flatMap((p) => matchsDePaire.get(p) ?? []).filter((x) => x.id !== m.id);
    for (let iter = 0; iter < 500; iter++) {
      const avant = s;
      // fenêtre de jeu
      const f = fenetres.find((w) => s + d <= w.fin && w.fin > s);
      if (!f) return null;
      if (s < f.debut) s = f.debut;
      if (s + d > f.fin) continue;
      for (const pz of pauses) if (s < pz.fin && s + d > pz.debut) s = pz.fin;
      for (const o of occupation.get(terrainId)!) if (s < o.fin && s + d > o.debut) s = o.fin;
      // matchs déjà placés des mêmes paires
      for (const x of autres) {
        const pl = places.get(x.id);
        if (!pl) continue;
        const avantX = s + d + reposApres(m.format) <= pl.debut && (jour(s) === jour(pl.debut) || s + d + REPOS_ENTRE_JOURNEES <= pl.debut);
        if (!avantX) s = apres(s, pl.fin, x.format);
      }
      if (s === avant) return s;
    }
    return null;
  };

  const restants = new Set(aPlanifier.map((m) => m.id));
  const parId = new Map(aPlanifier.map((m) => [m.id, m]));
  const vague = vagues(t);
  const bloques: Match[] = [];
  while (restants.size) {
    // demi-finales puis finale du tableau principal en dernier
    const v = Math.min(...[...restants].map((id) => vague.get(id) ?? 0));
    const plancher = Math.max(0, ...t.matchs.filter((x) => (vague.get(x.id) ?? 0) < v && places.has(x.id)).map((x) => places.get(x.id)!.debut));
    let meilleur: { m: Match; s: number; terrainId: string } | null = null;
    for (const id of restants) {
      const m = parId.get(id)!;
      if ((vague.get(id) ?? 0) !== v) continue;
      for (const c of t.terrains) {
        const s = plusTot(m, c.id, plancher);
        if (s === null) continue;
        if (!meilleur || s < meilleur.s || (s === meilleur.s && m.ordre < meilleur.m.ordre)) meilleur = { m, s, terrainId: c.id };
      }
    }
    if (!meilleur) {
      // vague impossible à placer : on la laisse de côté pour ne pas bloquer la suite
      for (const id of [...restants]) if ((vague.get(id) ?? 0) === v) { restants.delete(id); bloques.push(parId.get(id)!); }
      continue;
    }
    const { m, s, terrainId } = meilleur;
    places.set(m.id, { debut: s, fin: s + duree(t, m), terrainId });
    occupation.get(terrainId)!.push({ debut: s, fin: s + duree(t, m) });
    restants.delete(m.id);
  }
  const matchs = t.matchs.map((m) => {
    if (fixes.has(m.id)) return m;
    const pl = places.get(m.id);
    if (!pl) return { ...m, debut: undefined, terrainId: undefined };
    return { ...m, debut: versTexte(pl.debut), terrainId: pl.terrainId };
  });
  return { tournoi: { ...t, matchs }, nonPlanifies: [...bloques, ...[...restants].map((id) => parId.get(id)!)] };
}

/**
 * Ordre de programmation : 0 = tous les autres matchs, 1 = demi-finales du tableau principal,
 * 2 = matchs qui en dépendent (3e place…), 3 = finale. Une vague ne commence pas avant
 * le dernier début de la vague précédente : les demies et la finale sont les derniers matchs.
 */
export function vagues(t: Tournoi): Map<string, number> {
  const res = new Map<string, number>();
  const principal = new Set(t.tableaux.filter((x) => x.principal).map((x) => x.id));
  const demis = new Set(t.matchs.filter((m) => principal.has(m.groupeId) && m.phase === 'TABLEAU' && m.tailleTour === 4).map((m) => m.id));
  if (!demis.size) return res;
  const dependDesDemis = (m: Match, vus = new Set<string>()): boolean =>
    [m.a, m.b].some((r) => {
      if (r.k !== 'gagnant' && r.k !== 'perdant') return false;
      if (demis.has(r.matchId)) return true;
      if (vus.has(r.matchId)) return false;
      vus.add(r.matchId);
      const src = t.matchs.find((x) => x.id === r.matchId);
      return !!src && dependDesDemis(src, vus);
    });
  for (const m of t.matchs) {
    if (demis.has(m.id)) res.set(m.id, 1);
    else if (principal.has(m.groupeId) && m.phase === 'TABLEAU' && m.tailleTour === 2) res.set(m.id, 3);
    else if (dependDesDemis(m)) res.set(m.id, 2);
  }
  return res;
}

export interface Probleme { niveau: 'erreur' | 'alerte'; message: string }

/** Vérifie la programmation actuelle (paires connues uniquement). */
export function controlesPlanning(t: Tournoi): Probleme[] {
  const pb: Probleme[] = [];
  const ms = t.matchs.filter((m) => m.debut && !estExempt(t, m));
  // chevauchement sur un terrain
  const parTerrain = new Map<string, Match[]>();
  ms.forEach((m) => parTerrain.set(m.terrainId!, [...(parTerrain.get(m.terrainId!) ?? []), m]));
  for (const [tid, l] of parTerrain) {
    l.sort((a, b) => debutEnMinutes(a.debut!) - debutEnMinutes(b.debut!));
    for (let i = 1; i < l.length; i++) {
      if (debutEnMinutes(l[i].debut!) < debutEnMinutes(l[i - 1].debut!) + duree(t, l[i - 1]))
        pb.push({ niveau: 'erreur', message: `${t.terrains.find((x) => x.id === tid)?.nom} : « ${l[i - 1].libelle} » et « ${l[i].libelle} » se chevauchent` });
    }
  }
  for (const m of ms) {
    const s = debutEnMinutes(m.debut!);
    if (jour(s + duree(t, m) - 1) !== jour(s)) pb.push({ niveau: 'erreur', message: `« ${m.libelle} » se termine après minuit` });
  }
  // repos et matchs par jour, par paire
  const parPaire = new Map<string, Match[]>();
  for (const m of ms) for (const r of [m.a, m.b]) {
    const id = resoudre(t, r);
    if (id && id !== 'BYE') parPaire.set(id, [...(parPaire.get(id) ?? []), m]);
  }
  for (const [id, l] of parPaire) {
    const nom = nomPaireId(t, id);
    l.sort((a, b) => debutEnMinutes(a.debut!) - debutEnMinutes(b.debut!));
    for (let i = 1; i < l.length; i++) {
      const finPrec = debutEnMinutes(l[i - 1].debut!) + duree(t, l[i - 1]);
      const s = debutEnMinutes(l[i].debut!);
      const mini = jour(s) === jour(finPrec) ? reposApres(l[i - 1].format) : REPOS_ENTRE_JOURNEES;
      if (s - finPrec < mini)
        pb.push({ niveau: 'alerte', message: `${nom} : repos insuffisant avant « ${l[i].libelle} » (${Math.max(0, s - finPrec)} min au lieu de ${mini} min ; possible avec l'accord écrit des 4 joueurs et du juge-arbitre)` });
    }
    const parJour = new Map<number, Match[]>();
    l.forEach((m) => { const j = jour(debutEnMinutes(m.debut!)); parJour.set(j, [...(parJour.get(j) ?? []), m]); });
    for (const lj of parJour.values())
      controleMatchsParJour(lj.map((m) => m.format)).forEach((x) => pb.push({ niveau: 'erreur', message: `${nom} : ${x}` }));
  }
  return pb;
}

/**
 * Retard : décale de `minutes` les matchs non joués programmés ce jour-là à partir de `aPartirDe` (HH:mm).
 * Les matchs verrouillés sont décalés aussi (le retard concerne tout le monde).
 */
export function decalerMatchs(t: Tournoi, date: string, minutes: number, aPartirDe = '00:00'): Tournoi {
  const seuil = versMinutes(date, aPartirDe);
  return {
    ...t,
    matchs: t.matchs.map((m) => {
      if (m.resultat || !m.debut || !m.debut.startsWith(date) || debutEnMinutes(m.debut) < seuil) return m;
      return { ...m, debut: versTexte(debutEnMinutes(m.debut) + minutes) };
    }),
  };
}

export interface Convocation {
  paireId: string;
  /** Prochain match programmé et non joué de la paire. */
  match?: Match;
  /** Heure de convocation (AAAA-MM-JJTHH:mm) = début du match moins l'avance demandée. */
  heure?: string;
  adversaire?: string | null;
}

/** Convocation de chaque paire engagée à son prochain match programmé. */
export function convocations(t: Tournoi, avanceMinutes: number): Convocation[] {
  const ids = (t.ordrePaires ?? t.paires.filter((p) => !p.forfait).map((p) => p.id));
  const aVenir = t.matchs
    .filter((m) => !m.resultat && m.debut && !estExempt(t, m))
    .sort((a, b) => a.debut!.localeCompare(b.debut!));
  return ids.map((id) => {
    for (const m of aVenir) {
      const a = resoudre(t, m.a), b = resoudre(t, m.b);
      if (a !== id && b !== id) continue;
      return { paireId: id, match: m, heure: versTexte(debutEnMinutes(m.debut!) - avanceMinutes), adversaire: a === id ? b : a };
    }
    return { paireId: id };
  });
}
