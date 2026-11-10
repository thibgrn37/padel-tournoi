// Découpe des tableaux en arbres (un arbre par « bloc de places ») pour l'affichage.
import type { Match, Ref, Tournoi } from './types';

export interface Noeud {
  match: Match;
  enfants: [Noeud | null, Noeud | null];
}

export interface Arbre {
  id: string;
  titre: string;
  rangDebut: number;
  profondeur: number;
  principal: boolean;
  racine: Noeud;
}

export function arbres(t: Tournoi): Arbre[] {
  const parId = new Map(t.matchs.map((m) => [m.id, m]));
  const noeud = (m: Match): Noeud => {
    const enfant = (r: Ref) => (r.k === 'gagnant' && parId.has(r.matchId) ? noeud(parId.get(r.matchId)!) : null);
    return { match: m, enfants: [enfant(m.a), enfant(m.b)] };
  };
  const prof = (n: Noeud | null): number => (n ? 1 + Math.max(prof(n.enfants[0]), prof(n.enfants[1])) : 0);
  const res: Arbre[] = [];
  for (const m of t.matchs) {
    if (!m.places) continue;
    const racine = noeud(m);
    const p = prof(racine);
    const r = m.places[0];
    const tab = t.tableaux.find((x) => x.id === m.groupeId);
    const principal = !!tab?.principal && r === 1;
    const fin = r + 2 ** p - 1;
    const titre = principal ? tab!.nom : p === 1 ? `Match pour la ${r}e place` : `Places ${r} à ${fin}`;
    res.push({ id: m.id, titre, rangDebut: r, profondeur: p, principal, racine });
  }
  return res.sort((a, b) => a.rangDebut - b.rangDebut);
}

/** Libellé court d'une provenance encore inconnue (« Perdant 1/4 (2) », « 1er poule A »…). */
export function provenance(t: Tournoi, ref: Ref): string {
  if (ref.k === 'perdant' || ref.k === 'gagnant') {
    const m = t.matchs.find((x) => x.id === ref.matchId);
    const lib = (m?.libelle ?? '').replace(/^.* · /, '');
    return `${ref.k === 'perdant' ? 'Perdant' : 'Vainqueur'} ${lib}`;
  }
  if (ref.k === 'slot') return 'Qualifié des poules';
  return '';
}
