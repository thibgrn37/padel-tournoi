import { useState } from 'react';
import { classementFinal, estExempt, nomPaireId, paireParId, poids, resoudre, saisirResultat } from '../engine/tournoi';
import type { Match, Tournoi } from '../engine/types';
import { LigneMatch, SaisieScore } from './commun';
import { enregistrerFichier, nomFichier } from './stockage';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

const parHoraire = (a: Match, b: Match) => (a.debut ?? '9999').localeCompare(b.debut ?? '9999') || a.ordre - b.ordre;

export function OngletResultats({ t, maj }: { t: Tournoi; maj: Maj }) {
  const [saisie, setSaisie] = useState<Match | null>(null);
  const reels = t.matchs.filter((m) => !estExempt(t, m));
  const connus = (m: Match) => { const a = resoudre(t, m.a), b = resoudre(t, m.b); return !!a && !!b && a !== 'BYE' && b !== 'BYE'; };
  const aJouer = reels.filter((m) => !m.resultat && connus(m)).sort(parHoraire);
  const enAttente = reels.filter((m) => !m.resultat && !connus(m)).length;
  const joues = reels.filter((m) => m.resultat).sort((a, b) => parHoraire(b, a));
  if (!t.matchs.length) return <p className="vide">Aucun match : effectue d'abord le tirage.</p>;
  return (
    <div className="grille">
      <section className="carte">
        <h2>À jouer ({aJouer.length})</h2>
        {enAttente > 0 && <p className="muted">{enAttente} autre(s) match(s) en attente des résultats précédents.</p>}
        <div className="liste-matchs">{aJouer.map((m) => <LigneMatch key={m.id} t={t} m={m} onClic={() => setSaisie(m)} />)}</div>
      </section>
      <section className="carte">
        <h2>Joués ({joues.length})</h2>
        <div className="liste-matchs">{joues.map((m) => <LigneMatch key={m.id} t={t} m={m} onClic={() => setSaisie(m)} />)}</div>
      </section>
      {saisie && (
        <SaisieScore t={t} m={saisie} onFermer={() => setSaisie(null)}
          onValider={(r) => { maj((x) => saisirResultat(x, saisie.id, r)); setSaisie(null); }} />
      )}
    </div>
  );
}

export function OngletClassement({ t }: { t: Tournoi }) {
  const { lignes, complet } = classementFinal(t);
  const exporter = () => {
    const csv = ['Place;Joueur 1;Licence 1;Joueur 2;Licence 2;Poids',
      ...lignes.map((l) => {
        const p = paireParId(t, l.paireId)!;
        return [l.place, `${p.j1.prenom} ${p.j1.nom}`, p.j1.licence ?? '', `${p.j2.prenom} ${p.j2.nom}`, p.j2.licence ?? '', poids(t, p)].join(';');
      })].join('\n');
    enregistrerFichier('﻿' + csv, `${nomFichier(t)}-classement.csv`, 'csv');
  };
  return (
    <section className="carte">
      <h2>Classement final {complet ? '' : '(provisoire)'}</h2>
      {!complet && <p className="muted">Le classement sera complet quand tous les matchs de classement auront été joués.</p>}
      <div className="barre"><button className="secondaire" onClick={exporter} disabled={!lignes.length}>Exporter (CSV)</button></div>
      <table className="tableau-simple">
        <thead><tr><th>Place</th><th>Paire</th><th>Poids</th></tr></thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.paireId}><td><b>{l.place}</b></td><td>{nomPaireId(t, l.paireId)}</td><td>{poids(t, paireParId(t, l.paireId)!)}</td></tr>
          ))}
          {!lignes.length && <tr><td colSpan={3} className="vide">Aucun classement pour l'instant.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
