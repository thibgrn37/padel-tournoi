// Balles neuves : quantité à prévoir et changements selon le cahier des charges (Chapitre III).
import { estExempt } from './tournoi';
import type { Match, Tournoi } from './types';

/** Une boîte = 3 balles. */
export const BALLES_PAR_BOITE = 3;

export interface RegleBalles {
  /** Résumé lisible du cahier des charges. */
  texte: string[];
  /** 3 balles neuves par terrain pour l'épreuve. */
  parPiste: boolean;
  /** 3 balles neuves à chaque match. */
  chaqueMatch: boolean;
  /** 3 balles neuves à partir des 1/2 finales du tableau principal. */
  desDemis: boolean;
  /** 3 balles neuves pour le match des perdants des 1/2 finales (3e place). */
  perdantsDemis: boolean;
  /** Changement de balles au 3e set des matchs au format A1. */
  changement3eSetA1: boolean;
}

export function regleBalles(t: Tournoi): RegleBalles {
  const c = t.categorie;
  if (t.public === 'JEUNES' || c === 'P25' || c === 'P50')
    return {
      texte: ['3 balles neuves par terrain pour le tournoi.', 'Balles neuves non obligatoires pour les matchs de classement.'],
      parPiste: true, chaqueMatch: false, desDemis: false, perdantsDemis: false, changement3eSetA1: false,
    };
  if (c === 'P100' || c === 'P250')
    return {
      texte: [
        '3 balles neuves par terrain pour le tournoi.',
        '3 balles neuves à chaque match à partir des 1/2 finales (1/2 finales et finale).',
        '3 balles neuves pour le match des perdants des 1/2 finales (3e place) ; autres matchs de classement : non obligatoire.',
      ],
      parPiste: true, chaqueMatch: false, desDemis: true, perdantsDemis: true, changement3eSetA1: false,
    };
  if (c === 'P500' || c === 'P1000')
    return {
      texte: ['3 balles neuves à chaque match.', 'Changement de balles en cours de match non obligatoire.'],
      parPiste: false, chaqueMatch: true, desDemis: false, perdantsDemis: false, changement3eSetA1: false,
    };
  return {
    texte: ['3 balles neuves à chaque match.', 'Changement de balles au 3e set pour tous les matchs au format A1.'],
    parPiste: false, chaqueMatch: true, desDemis: false, perdantsDemis: false, changement3eSetA1: true,
  };
}

/** Faut-il ouvrir une boîte neuve pour ce match ? */
export function ballesNeuves(t: Tournoi, m: Match, r = regleBalles(t)): boolean {
  if (estExempt(t, m) || m.resultat?.auto) return false;
  if (r.chaqueMatch) return true;
  const tab = t.tableaux.find((x) => x.id === m.groupeId);
  if (!tab?.principal) return false;
  if (r.desDemis && m.phase === 'TABLEAU' && (m.tailleTour ?? 99) <= 4) return true;
  if (r.perdantsDemis && m.places?.[0] === 3) return true;
  return false;
}

export interface BesoinBalles {
  regle: RegleBalles;
  /** Boîtes pour les terrains (mise en place). */
  boitesTerrains: number;
  /** Boîtes pour les matchs qui demandent des balles neuves. */
  boitesMatchs: number;
  /** Boîtes en plus si tous les matchs A1 vont au 3e set (au plus). */
  boites3eSet: number;
  total: number;
}

export function besoinBalles(t: Tournoi): BesoinBalles {
  const regle = regleBalles(t);
  const boitesTerrains = regle.parPiste ? t.terrains.length : 0;
  const boitesMatchs = t.matchs.filter((m) => ballesNeuves(t, m, regle)).length;
  const boites3eSet = regle.changement3eSetA1
    ? t.matchs.filter((m) => m.format === 'A1' && !estExempt(t, m) && !m.resultat?.auto).length
    : 0;
  return { regle, boitesTerrains, boitesMatchs, boites3eSet, total: boitesTerrains + boitesMatchs + boites3eSet };
}
