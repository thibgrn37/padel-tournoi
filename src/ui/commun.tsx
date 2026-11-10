import { useState } from 'react';
import type { Probleme } from '../engine/planning';
import { ballesNeuves, regleBalles } from '../engine/balles';
import { controleScore, DEF_FORMATS } from '../engine/regles';
import { dependantsJoues, nomPaireId, resoudre, scoreForfait } from '../engine/tournoi';
import type { Issue, Match, Resultat, Tournoi } from '../engine/types';

export function Problemes({ liste, okTexte }: { liste: Probleme[]; okTexte?: string }) {
  if (!liste.length) return okTexte ? <p className="ok">✓ {okTexte}</p> : null;
  return (
    <ul className="problemes">
      {liste.map((p, i) => (
        <li key={i} className={p.niveau}>{p.niveau === 'erreur' ? '⛔' : '⚠️'} {p.message}</li>
      ))}
    </ul>
  );
}

export const texteScore = (r?: Resultat) => {
  if (!r) return '';
  const s = r.sets.map(([a, b]) => `${a}-${b}`).join(' ');
  if (r.auto) return 'WO (paire sortie)';
  return r.issue === 'WO' ? 'WO' : r.issue === 'ABANDON' ? `${s} ab.` : r.issue === 'DISQUALIFICATION' ? `${s} disq.` : s;
};

/** Pastille « balles neuves » (et changement au 3e set en A1 si le cahier des charges l'impose). */
export function PastilleBalles({ t, m }: { t: Tournoi; m: Match }) {
  if (m.resultat || !ballesNeuves(t, m)) return null;
  const r = regleBalles(t);
  const titre = 'Balles neuves pour ce match' + (r.changement3eSetA1 && m.format === 'A1' ? ' + changement au 3e set' : '');
  return <span className="balles" title={titre}>🎾 neuves{r.changement3eSetA1 && m.format === 'A1' ? ' (+3e set)' : ''}</span>;
}

export const heure = (debut?: string) => (debut ? debut.slice(11, 16) : '');
export const dateCourte = (debut?: string) =>
  debut ? new Date(debut.slice(0, 10) + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

export function LigneMatch({ t, m, onClic }: { t: Tournoi; m: Match; onClic?: () => void }) {
  const a = resoudre(t, m.a), b = resoudre(t, m.b);
  const r = m.resultat;
  const terrain = t.terrains.find((x) => x.id === m.terrainId)?.nom;
  return (
    <div className={`match ${r ? 'joue' : ''} ${onClic && a && b ? 'cliquable' : ''}`} onClick={a && b ? onClic : undefined}>
      <div className="match-entete">
        <span>{m.libelle}</span>
        <span className="muted"><PastilleBalles t={t} m={m} /> {m.format}{m.debut ? ` · ${dateCourte(m.debut)} ${heure(m.debut)}` : ''}{terrain ? ` · ${terrain}` : ''}</span>
      </div>
      <div className={`equipe ${r?.vainqueur === 'A' ? 'gagnant' : ''}`}>{r?.auto && r.vainqueur === 'B' ? <i className="muted">Forfait</i> : nomPaireId(t, a)}</div>
      <div className={`equipe ${r?.vainqueur === 'B' ? 'gagnant' : ''}`}>{r?.auto && r.vainqueur === 'A' ? <i className="muted">Forfait</i> : nomPaireId(t, b)}</div>
      {r && <div className="score">{texteScore(r)}</div>}
    </div>
  );
}

/** Lecture d'un score saisi : "6-4 3-6 10-8" */
export function lireScore(s: string): [number, number][] | null {
  const sets = s.trim().split(/[\s,;/]+/).filter(Boolean).map((x) => x.split(/[-–:]/).map((n) => parseInt(n, 10)));
  if (!sets.length || sets.some((x) => x.length !== 2 || x.some((n) => !Number.isFinite(n)))) return null;
  return sets as [number, number][];
}

export function SaisieScore({ t, m, onValider, onFermer }: {
  t: Tournoi; m: Match; onValider: (r: Resultat | undefined) => void; onFermer: () => void;
}) {
  const a = resoudre(t, m.a)!, b = resoudre(t, m.b)!;
  const [texte, setTexte] = useState(m.resultat && m.resultat.issue !== 'WO' ? m.resultat.sets.map(([x, y]) => `${x}-${y}`).join(' ') : '');
  const [issue, setIssue] = useState<Issue>(m.resultat?.issue ?? 'NORMAL');
  const [vainqueurForce, setVainqueurForce] = useState<'A' | 'B'>(m.resultat?.vainqueur ?? 'A');
  const dependants = dependantsJoues(t, m.id);
  const sets = lireScore(texte);
  let erreur: string | null = null;
  let vainqueur: 'A' | 'B' = vainqueurForce;
  if (issue === 'NORMAL') {
    if (!sets) erreur = 'Saisis le score, par exemple 6-4 3-6 10-8';
    else {
      erreur = controleScore(m.format, sets);
      const ga = sets.filter(([x, y]) => x > y).length, gb = sets.filter(([x, y]) => y > x).length;
      vainqueur = ga > gb ? 'A' : 'B';
    }
  }
  const valider = () => {
    if (issue === 'WO') onValider({ sets: scoreForfait(m.format, vainqueur), vainqueur, issue });
    else onValider({ sets: sets ?? [], vainqueur, issue });
  };
  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale" onClick={(e) => e.stopPropagation()}>
        <h3>{m.libelle}</h3>
        <p className="muted">Format {m.format} : {DEF_FORMATS[m.format].libelle}</p>
        <p><b>A</b> {nomPaireId(t, a)}<br /><b>B</b> {nomPaireId(t, b)}</p>
        <label>Issue
          <select value={issue} onChange={(e) => setIssue(e.target.value as Issue)}>
            <option value="NORMAL">Match joué</option>
            <option value="WO">Forfait (WO)</option>
            <option value="ABANDON">Abandon</option>
            <option value="DISQUALIFICATION">Disqualification</option>
          </select>
        </label>
        {issue !== 'WO' && (
          <label>Score (du point de vue de A)
            <input autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="6-4 3-6 10-8"
              onKeyDown={(e) => e.key === 'Enter' && !erreur && valider()} />
          </label>
        )}
        {issue !== 'NORMAL' && (
          <label>Vainqueur
            <select value={vainqueurForce} onChange={(e) => setVainqueurForce(e.target.value as 'A' | 'B')}>
              <option value="A">A — {nomPaireId(t, a)}</option>
              <option value="B">B — {nomPaireId(t, b)}</option>
            </select>
          </label>
        )}
        {issue === 'NORMAL' && sets && !erreur && <p className="ok">Vainqueur : {nomPaireId(t, vainqueur === 'A' ? a : b)}</p>}
        {erreur && <p className="erreur-texte">{erreur}</p>}
        {dependants.length > 0 && (
          <p className="erreur-texte">⚠️ Des matchs suivants ont déjà été joués ({dependants.map((x) => x.libelle).join(', ')}). Modifier ce résultat peut changer leurs adversaires.</p>
        )}
        <div className="actions">
          {m.resultat && <button className="secondaire" onClick={() => onValider(undefined)}>Effacer le résultat</button>}
          <button className="secondaire" onClick={onFermer}>Annuler</button>
          <button disabled={!!erreur} onClick={valider}>Valider</button>
        </div>
      </div>
    </div>
  );
}
