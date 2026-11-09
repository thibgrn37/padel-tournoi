// Contrôles de conformité au règlement FFT 2026.
import {
  classementRetenu, dureeMaxJours, formatsAutorises, interdictionTop, matchsMinimum, nbMinPaires, nbMinTerrains,
} from './regles';
import type { Probleme } from './planning';
import { matchsMinimumGarantis, nomJoueur, nomPaire, selection } from './tournoi';
import type { FormatCode, Tournoi } from './types';

export function controlesInscrits(t: Tournoi): Probleme[] {
  const pb: Probleme[] = [];
  const ctx = { discipline: t.discipline, rangNCMessieurs: t.reglages.rangNCMessieurs, rangNCDames: t.reglages.rangNCDames };
  const { retenues } = selection(t);
  const min = nbMinPaires(t.categorie, t.discipline, t.public);
  if (retenues.length < 4)
    pb.push({ niveau: 'erreur', message: `Moins de 4 paires : l'épreuve peut avoir lieu mais ne sera pas homologuée.` });
  else if (retenues.length < min)
    pb.push({ niveau: 'alerte', message: `${retenues.length} paires pour un ${t.categorie} (minimum ${min}) : l'épreuve sera rétrogradée dans la catégorie correspondant au nombre de paires.` });
  for (const p of t.paires.filter((x) => !x.forfait)) {
    for (const j of [p.j1, p.j2]) {
      if (t.discipline === 'DD' && j.sexe === 'H')
        pb.push({ niveau: 'erreur', message: `${nomJoueur(j)} : joueur dans une épreuve Dames` });
      if (t.discipline === 'DM' && j.sexe === 'F' && !t.damesAutorisees)
        pb.push({ niveau: 'erreur', message: `${nomJoueur(j)} : les dames ne sont pas autorisées dans cette épreuve` });
      const top = interdictionTop(t.categorie, t.discipline, t.public, j.sexe);
      const rang = j.classement == null ? null : t.discipline === 'DM' ? classementRetenu(j, ctx) : j.classement;
      if (top && rang != null && rang <= top)
        pb.push({ niveau: 'erreur', message: `${nomJoueur(j)} (classé${j.sexe === 'F' ? 'e' : ''} ${rang}) : interdit au TOP ${top.toLocaleString('fr-FR')} en ${t.categorie}` });
    }
    if (t.discipline === 'DX' && p.j1.sexe === p.j2.sexe)
      pb.push({ niveau: 'erreur', message: `${nomPaire(p)} : une paire mixte doit être composée d'une joueuse et d'un joueur` });
  }
  return pb;
}

export function controlesFormule(t: Tournoi): Probleme[] {
  const pb: Probleme[] = [];
  const f = t.formule;
  const N = selection(t).retenues.length;
  const verif = (format: FormatCode, phase: Parameters<typeof formatsAutorises>[2], libelle: string, tailleTour?: number) => {
    const ok = formatsAutorises(t.categorie, t.public, phase, tailleTour);
    if (!ok.includes(format)) pb.push({ niveau: 'erreur', message: `Format ${format} interdit pour ${libelle} en ${t.categorie} (autorisés : ${ok.join(', ')})` });
  };
  if (f.type === 'POULES_TABLEAU') {
    verif(f.formats.poules, 'QUALIF', 'les poules');
    if (N < 2 * f.nbPoules) pb.push({ niveau: 'erreur', message: `${f.nbPoules} poules pour ${N} paires : il faut 2 têtes de série par poule.` });
    if (f.qualifiesParPoule < 1) pb.push({ niveau: 'erreur', message: 'Au moins 1 qualifié par poule.' });
  }
  // formats du tableau, tour par tour quand les matchs existent
  if (t.matchs.length) {
    for (const m of t.matchs.filter((x) => x.phase === 'TABLEAU'))
      verif(m.format, m.tailleTour === 2 ? 'FINALE' : 'TABLEAU', m.libelle, m.tailleTour);
  } else {
    verif(f.formats.tableau, 'TABLEAU', 'le tableau final', 8);
    verif(f.formats.finale, 'FINALE', 'la finale', 2);
  }
  verif(f.formats.classement, 'CLASSEMENT', 'les matchs de classement');
  // TF ≥ 1/2 finale pour les P250 messieurs et mixtes
  if (t.categorie === 'P250' && t.discipline !== 'DD' && t.public !== 'JEUNES') {
    const tf = f.type === 'TMC' ? N : f.nbPoules * f.qualifiesParPoule;
    if (tf < 4) pb.push({ niveau: 'erreur', message: 'P250 Messieurs/Mixtes : le tableau final doit commencer au moins en 1/2 finale (4 paires).' });
  }
  const formatsUtilises = Object.values(f.formats);
  const min = matchsMinimum(formatsUtilises);
  if (t.matchs.length) {
    const g = matchsMinimumGarantis(t);
    if (g < min) pb.push({ niveau: 'erreur', message: `Certaines paires ne joueraient que ${g} match(s) : ${min} matchs minimum doivent être proposés à chaque paire.` });
  }
  if (t.terrains.length < nbMinTerrains(t.categorie, t.discipline, t.public))
    pb.push({ niveau: 'alerte', message: `${t.categorie} : ${nbMinTerrains(t.categorie, t.discipline, t.public)} terrains minimum de même nature.` });
  const jours = new Set(t.journees.map((j) => j.date)).size;
  if (jours > dureeMaxJours(t.categorie, t.public))
    pb.push({ niveau: 'erreur', message: `${t.categorie} : durée maximum ${dureeMaxJours(t.categorie, t.public)} jour(s).` });
  return pb;
}
