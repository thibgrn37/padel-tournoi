// Lecture d'un fichier d'inscrits (Excel ou CSV) et conversion en paires selon le mappage choisi.
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import type { Joueur, Paire, Sexe } from '../engine/types';

export type Tableur = { entetes: string[]; lignes: string[][] };

export async function lireFichier(f: File): Promise<Tableur> {
  let rows: string[][];
  if (/\.xlsx$/i.test(f.name)) {
    const r = await readXlsxFile(f);
    rows = r.map((l) => l.map((c) => (c == null ? '' : String(c))));
  } else {
    const texte = await f.text();
    const res = Papa.parse<string[]>(texte, { skipEmptyLines: true });
    rows = res.data.map((l) => l.map((c) => String(c ?? '').trim()));
  }
  const [entetes = [], ...lignes] = rows;
  return { entetes: entetes.map((e, i) => e || `Colonne ${i + 1}`), lignes };
}

export const CHAMPS_JOUEUR = ['nom', 'prenom', 'licence', 'sexe', 'classement', 'club'] as const;
export type ChampJoueur = (typeof CHAMPS_JOUEUR)[number];

export interface Mappage {
  mode: 'PAIRE' | 'JOUEUR';
  /** mode PAIRE : colonnes du joueur 1 et du joueur 2 */
  j1: Partial<Record<ChampJoueur, number>>;
  j2: Partial<Record<ChampJoueur, number>>;
  /** mode JOUEUR : colonne identifiant la paire (n° d'équipe) */
  colPaire?: number;
  sexeParDefaut: Sexe;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Proposition automatique de mappage d'après les entêtes. */
export function devinerMappage(entetes: string[], sexeParDefaut: Sexe): Mappage {
  const h = entetes.map(norm);
  const trouver = (motif: RegExp, num?: 1 | 2) => {
    const idx = h.findIndex((x) => motif.test(x) && (num === undefined || new RegExp(`(j|joueur|joueuse|partenaire)?\\s*${num}|${num}\\s*$`).test(x)));
    return idx >= 0 ? idx : undefined;
  };
  const motifs: Record<ChampJoueur, RegExp> = {
    nom: /^nom|nom( |$)|name/, prenom: /pr[e]?nom|first/, licence: /licen/, sexe: /sexe|genre|civil/, classement: /class|rang|rank/, club: /club/,
  };
  const deuxJoueurs = h.some((x) => /(2|joueur 2|j2)/.test(x) && /nom/.test(x));
  if (deuxJoueurs) {
    const j1: Mappage['j1'] = {}, j2: Mappage['j2'] = {};
    for (const c of CHAMPS_JOUEUR) { j1[c] = trouver(motifs[c], 1); j2[c] = trouver(motifs[c], 2); }
    return { mode: 'PAIRE', j1, j2, sexeParDefaut };
  }
  const j1: Mappage['j1'] = {};
  for (const c of CHAMPS_JOUEUR) j1[c] = trouver(motifs[c]);
  const colPaire = h.findIndex((x) => /paire|equipe|binome|team|n° ?insc/.test(x));
  return { mode: 'JOUEUR', j1, j2: {}, colPaire: colPaire >= 0 ? colPaire : undefined, sexeParDefaut };
}

function lireJoueur(l: string[], m: Partial<Record<ChampJoueur, number>>, sexeParDefaut: Sexe): Joueur {
  const v = (c: ChampJoueur) => (m[c] === undefined ? '' : (l[m[c]!] ?? '').trim());
  const s = norm(v('sexe'));
  const sexe: Sexe = /^(f|d|mme|madame|femme|dame)/.test(s) ? 'F' : /^(h|m|mr|monsieur|homme)/.test(s) ? 'H' : sexeParDefaut;
  const cl = parseInt(v('classement').replace(/[^\d]/g, ''), 10);
  return { nom: v('nom'), prenom: v('prenom'), licence: v('licence') || undefined, sexe, classement: Number.isFinite(cl) && cl > 0 ? cl : null, club: v('club') || undefined };
}

export function convertir(t: Tableur, m: Mappage, premierOrdre: number): Paire[] {
  const res: Paire[] = [];
  const id = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  if (m.mode === 'PAIRE') {
    for (const l of t.lignes) {
      const j1 = lireJoueur(l, m.j1, m.sexeParDefaut), j2 = lireJoueur(l, m.j2, m.sexeParDefaut);
      if (!j1.nom && !j2.nom) continue;
      res.push({ id: id(), j1, j2, ordreInscription: premierOrdre + res.length });
    }
  } else {
    const joueurs = t.lignes.map((l) => ({ l, j: lireJoueur(l, m.j1, m.sexeParDefaut) })).filter((x) => x.j.nom || x.j.prenom);
    if (m.colPaire !== undefined) {
      const groupes = new Map<string, Joueur[]>();
      for (const { l, j } of joueurs) {
        const k = (l[m.colPaire] ?? '').trim();
        groupes.set(k, [...(groupes.get(k) ?? []), j]);
      }
      for (const g of groupes.values()) for (let i = 0; i + 1 < g.length; i += 2)
        res.push({ id: id(), j1: g[i], j2: g[i + 1], ordreInscription: premierOrdre + res.length });
    } else {
      for (let i = 0; i + 1 < joueurs.length; i += 2)
        res.push({ id: id(), j1: joueurs[i].j, j2: joueurs[i + 1].j, ordreInscription: premierOrdre + res.length });
    }
  }
  return res;
}
