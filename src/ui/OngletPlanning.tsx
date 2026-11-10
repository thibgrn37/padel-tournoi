import { useState } from 'react';
import { controlesPlanning, debutEnMinutes, duree, planifier } from '../engine/planning';
import { DEF_FORMATS, FORMATS } from '../engine/regles';
import { estExempt, nomPaireId, resoudre } from '../engine/tournoi';
import type { FormatCode, Match, Tournoi } from '../engine/types';
import { heure, PastilleBalles, Problemes, texteScore } from './commun';
import { confirmer } from './stockage';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

const finTexte = (t: Tournoi, m: Match) => {
  const fin = debutEnMinutes(m.debut!) + duree(t, m);
  return `${String(Math.floor((fin % 1440) / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
};

export function OngletPlanning({ t, maj }: { t: Tournoi; maj: Maj }) {
  const [edition, setEdition] = useState<Match | null>(null);
  const [message, setMessage] = useState('');
  const [glisse, setGlisse] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  /** Dépose le match glissé sur un créneau : échange avec le match qui s'y trouve, s'il y en a un. */
  const deposer = (debut: string, terrainId: string) => {
    const id = glisse;
    setGlisse(null);
    setSurvol(null);
    if (!id) return;
    maj((x) => {
      const m = x.matchs.find((y) => y.id === id);
      if (!m || (m.debut === debut && m.terrainId === terrainId)) return x;
      const occupant = x.matchs.find((y) => y.id !== id && y.debut === debut && y.terrainId === terrainId);
      if (occupant?.resultat) return x;
      return {
        ...x,
        matchs: x.matchs.map((y) => {
          if (y.id === id) return { ...y, debut, terrainId, verrouille: true };
          if (occupant && y.id === occupant.id) return { ...y, debut: m.debut, terrainId: m.terrainId, verrouille: !!m.debut };
          return y;
        }),
      };
    });
    setMessage('Match déplacé et verrouillé 🔒. Vérifie les alertes de repos ci-dessus.');
  };
  const cible = (debut: string, terrainId: string, occupe?: Match) => ({
    onDragOver: (e: React.DragEvent) => { if (glisse && !occupe?.resultat) { e.preventDefault(); setSurvol(`${debut}|${terrainId}`); } },
    onDragLeave: () => setSurvol((s) => (s === `${debut}|${terrainId}` ? null : s)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); deposer(debut, terrainId); },
  });
  const source = (m: Match) => ({
    draggable: !m.resultat,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; setGlisse(m.id); },
    onDragEnd: () => { setGlisse(null); setSurvol(null); },
  });
  const classeSurvol = (debut: string, terrainId: string) => (survol === `${debut}|${terrainId}` ? ' cible' : '');
  const aJouer = t.matchs.filter((m) => !estExempt(t, m) && !m.resultat?.auto);
  const planifies = aJouer.filter((m) => m.debut);
  const nonPlanifies = aJouer.filter((m) => !m.debut);

  const calculer = async () => {
    if (planifies.some((m) => !m.resultat && !m.verrouille) && !(await confirmer('Recalculer le planning ? Les matchs joués et les matchs verrouillés 🔒 gardent leur horaire.'))) return;
    const r = planifier(t);
    maj(() => r.tournoi);
    setMessage(r.nonPlanifies.length ? `${r.nonPlanifies.length} match(s) n'ont pas pu être placés : ajoute une journée, des terrains ou élargis les horaires.` : 'Planning calculé.');
  };

  const jours = [...new Set(planifies.map((m) => m.debut!.slice(0, 10)))].sort();
  return (
    <div>
      <div className="barre">
        <button onClick={calculer} disabled={!t.matchs.length}>{planifies.length ? 'Recalculer le planning' : 'Calculer le planning'}</button>
        <span className="muted">{planifies.length} match(s) programmé(s){nonPlanifies.length ? `, ${nonPlanifies.length} non programmé(s)` : ''}. Glisse un match sur un autre créneau pour le déplacer (sur un match : ils s'échangent), ou clique dessus pour choisir l'heure exacte.</span>
      </div>
      {message && <p className="info">{message}</p>}
      <Problemes liste={controlesPlanning(t)} okTexte={planifies.length ? 'Temps de repos, nombre de matchs par jour et terrains respectés' : undefined} />
      {jours.map((j) => {
        const ms = planifies.filter((m) => m.debut!.startsWith(j)).sort((a, b) => a.debut!.localeCompare(b.debut!) || (a.terrainId ?? '').localeCompare(b.terrainId ?? ''));
        const heures = [...new Set(ms.map((m) => m.debut!))];
        return (
          <section key={j} className="carte">
            <h2>{new Date(j + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <table className="tableau-simple planning">
              <thead><tr><th>Heure</th>{t.terrains.map((c) => <th key={c.id}>{c.nom}</th>)}</tr></thead>
              <tbody>
                {heures.map((h) => (
                  <tr key={h}>
                    <td className="heure">{heure(h)}</td>
                    {t.terrains.map((c) => {
                      const m = ms.find((x) => x.debut === h && x.terrainId === c.id);
                      if (!m) return <td key={c.id} className={`case-vide${classeSurvol(h, c.id)}`} {...cible(h, c.id)}></td>;
                      const a = resoudre(t, m.a), b = resoudre(t, m.b);
                      return (
                        <td key={c.id} className={`case-match ${m.resultat ? 'joue' : ''}${glisse === m.id ? ' glisse' : ''}${classeSurvol(h, c.id)}`} onClick={() => setEdition(m)} {...source(m)} {...cible(h, c.id, m)}>
                          <div className="muted">{m.verrouille ? '🔒 ' : ''}{m.libelle} · {m.format} · fin {finTexte(t, m)} <PastilleBalles t={t} m={m} /></div>
                          <div>{a ? nomPaireId(t, a) : '…'}</div>
                          <div>{b ? nomPaireId(t, b) : '…'}</div>
                          {m.resultat && <div className="score">{texteScore(m.resultat)}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {nonPlanifies.length > 0 && planifies.length > 0 && (
        <section className="carte">
          <h3>Matchs non programmés</h3>
          <ul>{nonPlanifies.map((m) => <li key={m.id} {...source(m)} className="glissable"><button className="lien" onClick={() => setEdition(m)}>{m.libelle}</button></li>)}</ul>
        </section>
      )}
      {edition && <EditionMatch t={t} m={edition} onFermer={() => setEdition(null)} onValider={(m) => { maj((x) => ({ ...x, matchs: x.matchs.map((y) => (y.id === m.id ? m : y)) })); setEdition(null); }} />}
    </div>
  );
}

function EditionMatch({ t, m, onValider, onFermer }: { t: Tournoi; m: Match; onValider: (m: Match) => void; onFermer: () => void }) {
  const [date, setDate] = useState(m.debut?.slice(0, 10) ?? t.journees[0]?.date ?? '');
  const [h, setH] = useState(m.debut?.slice(11, 16) ?? '09:00');
  const [terrainId, setTerrainId] = useState(m.terrainId ?? t.terrains[0]?.id);
  const [format, setFormat] = useState<FormatCode>(m.format);
  const [verrouille, setVerrouille] = useState(m.verrouille ?? true);
  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale" onClick={(e) => e.stopPropagation()}>
        <h3>{m.libelle}</h3>
        <div className="ligne">
          <label>Jour
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {t.journees.map((j) => <option key={j.date} value={j.date}>{j.date}</option>)}
            </select>
          </label>
          <label>Heure<input type="time" value={h} onChange={(e) => setH(e.target.value)} /></label>
          <label>Terrain
            <select value={terrainId} onChange={(e) => setTerrainId(e.target.value)}>
              {t.terrains.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </label>
        </div>
        <label>Format
          <select value={format} onChange={(e) => setFormat(e.target.value as FormatCode)} disabled={!!m.resultat}>
            {FORMATS.map((f) => <option key={f} value={f}>{f} — {DEF_FORMATS[f].libelle}</option>)}
          </select>
        </label>
        <label className="case"><input type="checkbox" checked={verrouille} onChange={(e) => setVerrouille(e.target.checked)} /> Verrouiller (le recalcul du planning ne le déplace pas)</label>
        <div className="actions">
          {m.debut && !m.resultat && <button className="secondaire" onClick={() => onValider({ ...m, debut: undefined, terrainId: undefined, verrouille: false })}>Retirer du planning</button>}
          <button className="secondaire" onClick={onFermer}>Annuler</button>
          <button onClick={() => onValider({ ...m, debut: `${date}T${h}`, terrainId, format, verrouille })}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
