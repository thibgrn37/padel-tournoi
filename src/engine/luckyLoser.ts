// Lucky losers (Chapitre I) : une paire du tableau final déclare forfait avant son premier match,
// elle est remplacée par une paire tirée au sort parmi les non-qualifiées du meilleur rang de poule.
import { classementPoule, pouleTerminee } from './poules';
import { creerRng, Journal, nouvelleGraine } from './tirage';
import { nomPaireId, paireParId } from './tournoi';
import type { Tableau, Tournoi } from './types';

/** Tableau final alimenté par des poules (qualifications ou poules + tableau). */
export const tableauFinalQualif = (t: Tournoi): Tableau | undefined =>
  t.tableaux.find((x) => x.principal && x.origine.type === 'POULES');

/** Paires du tableau final : déjà placées, ou qui y entreront au tirage. */
export function pairesDuTableauFinal(t: Tournoi): string[] {
  const tf = tableauFinalQualif(t);
  if (!tf || tf.origine.type !== 'POULES') return [];
  if (!tf.slots.some((s) => s === null)) return tf.slots.filter((s): s is string => !!s && s !== 'BYE');
  const k = Math.max(...tf.origine.rangs);
  const qualifies = t.poules.flatMap((p) => classementPoule(p, t.matchs, p.departage).slice(0, k).map((l) => l.paireId));
  return [...(tf.origine.directs ?? []), ...qualifies, ...(tf.origine.luckyLosers ?? [])].filter((id) => !paireParId(t, id)?.forfait);
}

/** Candidats lucky loser : non-qualifiés du meilleur rang de poule encore disponible. */
export function candidatsLuckyLoser(t: Tournoi): { rang: number; ids: string[] } | null {
  const tf = tableauFinalQualif(t);
  if (!tf || tf.origine.type !== 'POULES' || !t.poules.length) return null;
  if (!t.poules.every((p) => pouleTerminee(p, t.matchs))) return null;
  const dansTF = new Set(pairesDuTableauFinal(t));
  const k = Math.max(...tf.origine.rangs);
  const max = Math.max(...t.poules.map((p) => p.paires.length));
  for (let r = k + 1; r <= max; r++) {
    const ids = t.poules
      .map((p) => classementPoule(p, t.matchs, p.departage)[r - 1]?.paireId)
      .filter((id): id is string => !!id && !dansTF.has(id) && !paireParId(t, id)?.forfait);
    if (ids.length) return { rang: r, ids };
  }
  return null;
}

/** Remplace une paire forfait du tableau final par un lucky loser tiré au sort. */
export function remplacerParLuckyLoser(t: Tournoi, forfaitId: string, graine = nouvelleGraine()): Tournoi {
  const tf = tableauFinalQualif(t);
  if (!tf || tf.origine.type !== 'POULES') throw new Error('Pas de tableau final issu de poules.');
  if (!pairesDuTableauFinal(t).includes(forfaitId)) throw new Error("Cette paire n'est pas dans le tableau final.");
  const c = candidatsLuckyLoser(t);
  if (!c) throw new Error('Les lucky losers se désignent à la fin des poules, parmi les paires non qualifiées.');
  const idx = tf.slots.indexOf(forfaitId);
  if (idx >= 0) {
    const premier = t.matchs.find((m) => m.groupeId === tf.id && ((m.a.k === 'slot' && m.a.idx === idx) || (m.b.k === 'slot' && m.b.idx === idx)));
    if (premier?.resultat) throw new Error('La paire a déjà joué dans le tableau final : saisis plutôt un WO.');
  }
  const rng = creerRng(graine);
  const ll = c.ids[Math.floor(rng() * c.ids.length)];
  const nom = (id: string) => nomPaireId(t, id);
  const j = new Journal('Lucky loser', graine);
  j.log(`Forfait de ${nom(forfaitId)} dans le ${tf.nom}.`);
  j.log(`Tirage au sort parmi les ${c.rang}es de poule non qualifiées : ${c.ids.map(nom).join(', ')}.`);
  j.log(`Lucky loser : ${nom(ll)}${idx >= 0 ? ` (prend la ligne ${idx + 1} du tableau)` : ' (entre au tirage du tableau final)'}.`);
  const tableaux = t.tableaux.map((tab) => {
    if (tab.id === tf.id && tab.origine.type === 'POULES') {
      if (idx >= 0) return { ...tab, slots: tab.slots.map((s, i) => (i === idx ? ll : s)) };
      return {
        ...tab,
        origine: { ...tab.origine, directs: tab.origine.directs?.filter((x) => x !== forfaitId), luckyLosers: [...(tab.origine.luckyLosers ?? []), ll] },
      };
    }
    // le lucky loser quitte son tableau de classement : sa place devient un exempt
    const i = tab.slots.indexOf(ll);
    if (i >= 0) {
      j.log(`${tab.nom} : la place de ${nom(ll)} devient un exempt.`);
      return { ...tab, slots: tab.slots.map((s, k) => (k === i ? 'BYE' : s)), byes: [...tab.byes, i] };
    }
    return tab;
  });
  const paires = t.paires.map((p) => (p.id === forfaitId ? { ...p, forfait: true } : p.id === ll ? { ...p, luckyLoser: true } : p));
  return { ...t, paires, tableaux, tirages: [...t.tirages, j.vers()] };
}
