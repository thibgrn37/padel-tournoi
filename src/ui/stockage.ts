// Sauvegarde automatique (stockage local de l'app) + export / ouverture de fichiers .padel.json
import type { Tournoi } from '../engine/types';

const CLE = 'padel-tournoi:courant';
const CLE_CLUB = 'padel-tournoi:club';
const CLE_HISTO = 'padel-tournoi:historique';

export interface EntreeHistorique { id: string; nom: string; categorie: string; date?: string; nbPaires: number; modifie: string; data: Tournoi }

export function avecId(t: Tournoi): Tournoi {
  return t.id ? t : { ...t, id: `tn${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}` };
}

export function lireHistorique(): EntreeHistorique[] {
  try {
    const s = localStorage.getItem(CLE_HISTO);
    const l = s ? (JSON.parse(s) as EntreeHistorique[]) : [];
    return l.sort((a, b) => b.modifie.localeCompare(a.modifie));
  } catch {
    return [];
  }
}

function ecrireHistorique(l: EntreeHistorique[]) {
  const liste = [...l].sort((a, b) => b.modifie.localeCompare(a.modifie));
  // si la place manque, on retire les plus anciens
  while (liste.length) {
    try { localStorage.setItem(CLE_HISTO, JSON.stringify(liste)); return; } catch { liste.pop(); }
  }
}

/** Range le tournoi dans l'historique (un tournoi vide n'y est pas gardé). */
export function archiver(t: Tournoi) {
  if (!t.id || (!t.paires.length && t.nom === 'Nouveau tournoi')) return;
  const e: EntreeHistorique = {
    id: t.id, nom: t.nom, categorie: t.categorie, date: t.journees[0]?.date, nbPaires: t.paires.filter((p) => !p.forfait).length,
    modifie: new Date().toISOString(), data: t,
  };
  ecrireHistorique([e, ...lireHistorique().filter((x) => x.id !== t.id)]);
}

export function supprimerHistorique(id: string) {
  ecrireHistorique(lireHistorique().filter((x) => x.id !== id));
}

/** Réglages du club repris à chaque nouveau tournoi : terrains, nom de la structure, visuel. */
interface Club { terrains: Tournoi['terrains']; lieu?: string; affichage?: Tournoi['affichage'] }

export function sauverClub(t: Tournoi) {
  // titre et sous-titre de l'écran sont propres à chaque tournoi
  const affichage = t.affichage ? { ...t.affichage, titre: '', sousTitre: '' } : undefined;
  const c: Club = { terrains: t.terrains, lieu: t.lieu, affichage };
  try { localStorage.setItem(CLE_CLUB, JSON.stringify(c)); } catch { /* stockage indisponible */ }
}

export function avecClub(t: Tournoi): Tournoi {
  try {
    const s = localStorage.getItem(CLE_CLUB);
    if (!s) return t;
    const c = JSON.parse(s) as Club;
    return { ...t, terrains: c.terrains?.length ? c.terrains : t.terrains, lieu: c.lieu || t.lieu, affichage: c.affichage ?? t.affichage };
  } catch {
    return t;
  }
}

export function chargerAuto(): Tournoi | null {
  try {
    const s = localStorage.getItem(CLE);
    return s ? (JSON.parse(s) as Tournoi) : null;
  } catch {
    return null;
  }
}

export function sauverAuto(t: Tournoi) {
  try {
    localStorage.setItem(CLE, JSON.stringify(t));
  } catch {
    /* stockage indisponible */
  }
}

const estTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function enregistrerFichier(contenu: string, nomParDefaut: string, extension: string) {
  if (estTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const chemin = await save({ defaultPath: nomParDefaut, filters: [{ name: extension, extensions: [extension] }] });
    if (chemin) await writeTextFile(chemin, contenu);
    return;
  }
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomParDefaut;
  a.click();
  URL.revokeObjectURL(url);
}

export function choisirFichier(accept: string): Promise<File | null> {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => ok(input.files?.[0] ?? null);
    input.click();
  });
}

export const nomFichier = (t: Tournoi) =>
  `${t.nom.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tournoi'}`;

/** Demande de confirmation (boîte native dans l'app Mac). */
export async function confirmer(message: string): Promise<boolean> {
  if (estTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, { title: 'Confirmation', kind: 'warning' });
  }
  return window.confirm(message);
}

export async function avertir(message: string) {
  if (estTauri()) {
    const { message: msg } = await import('@tauri-apps/plugin-dialog');
    await msg(message, { title: 'Padel Tournoi' });
  } else window.alert(message);
}
