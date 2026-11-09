import { useMemo } from 'react';
import { controlesFormule } from '../engine/controles';
import { DEF_FORMATS, formatsAutorises, matchsMinimum, type PhaseFormat } from '../engine/regles';
import { taillesPoules } from '../engine/poules';
import { estExempt, genererFormule, matchsMinimumGarantis, selection } from '../engine/tournoi';
import type { FormatCode, FormatsChoisis, Formule, Tournoi } from '../engine/types';
import { Problemes } from './commun';
import { avertir, confirmer } from './stockage';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

interface Proposition { libelle: string; formule: Partial<Formule>; matchsMini: number; nbMatchs: number }

/** Formules possibles pour le nombre de paires, avec le nombre de matchs garantis. */
function propositions(t: Tournoi): Proposition[] {
  const N = selection(t).retenues.length;
  if (N < 4) return [];
  const res: Proposition[] = [];
  const essai = (f: Partial<Formule>, libelle: string) => {
    try {
      const g = genererFormule({ ...t, formule: { ...t.formule, ...f } }, 1);
      res.push({ libelle, formule: f, matchsMini: matchsMinimumGarantis(g), nbMatchs: g.matchs.filter((m) => !estExempt(g, m)).length });
    } catch { /* formule impossible */ }
  };
  for (let P = Math.max(1, Math.floor(N / 5)); P <= Math.floor(N / 3); P++) {
    const tailles = taillesPoules(N, P);
    if (Math.min(...tailles) < 3 || Math.max(...tailles) > 5) continue;
    const desc = [...new Set(tailles)].map((s) => `${tailles.filter((x) => x === s).length}×${s}`).join(' + ');
    for (const k of [1, 2]) essai({ type: 'POULES_TABLEAU', nbPoules: P, qualifiesParPoule: k }, `${P} poules (${desc}), ${k} qualifié${k > 1 ? 's' : ''} par poule`);
  }
  essai({ type: 'TMC' }, `TMC ${N} paires (tableau multi-chances)`);
  return res;
}

function ChoixFormat({ t, valeur, phase, tailleTour, onChange }: {
  t: Tournoi; valeur: FormatCode; phase: PhaseFormat; tailleTour?: number; onChange: (f: FormatCode) => void;
}) {
  const ok = formatsAutorises(t.categorie, t.public, phase, tailleTour);
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value as FormatCode)} className={ok.includes(valeur) ? '' : 'invalide'}>
      {ok.map((f) => <option key={f} value={f}>{f} — {DEF_FORMATS[f].libelle}</option>)}
      {!ok.includes(valeur) && <option value={valeur}>{valeur} (interdit)</option>}
    </select>
  );
}

export function OngletFormule({ t, maj, allerA }: { t: Tournoi; maj: Maj; allerA: (o: string) => void }) {
  const f = t.formule;
  const setF = (v: Partial<Formule>) => maj((x) => ({ ...x, formule: { ...x.formule, ...v } }));
  // Changer un format met aussi à jour les matchs déjà créés et non joués
  const setFormat = (k: keyof FormatsChoisis, v: FormatCode) =>
    maj((x) => ({
      ...x,
      formule: { ...x.formule, formats: { ...x.formule.formats, [k]: v } },
      matchs: x.matchs.map((m) => {
        if (m.resultat) return m;
        const cle: keyof FormatsChoisis = m.phase === 'POULE' ? 'poules' : m.phase === 'CLASSEMENT' ? 'classement' : m.tailleTour === 2 ? 'finale' : 'tableau';
        return cle === k ? { ...m, format: v } : m;
      }),
    }));
  const props = useMemo(() => propositions(t), [t.paires, t.categorie, t.reglages, t.formule.formats, t.formule.methodePoules]);
  const N = selection(t).retenues.length;
  const minRequis = matchsMinimum(Object.values(f.formats));
  const dejaJoue = t.matchs.some((m) => m.resultat);

  const tirer = async () => {
    if (t.matchs.length && !(await confirmer(dejaJoue ? 'Des résultats sont déjà saisis. Refaire le tirage efface tous les matchs et résultats. Continuer ?' : 'Refaire le tirage remplace les poules et tableaux actuels. Continuer ?'))) return;
    try {
      maj((x) => genererFormule(x));
      allerA('tableaux');
    } catch (e) {
      avertir((e as Error).message);
    }
  };

  return (
    <div className="grille">
      <section className="carte">
        <h2>Formule sportive</h2>
        <p className="aide">{N} paires retenues. Le règlement impose {minRequis} matchs minimum par paire et un classement distinct pour chaque paire (matchs de classement obligatoires).</p>
        {props.length > 0 && (
          <>
            <h4>Formules possibles</h4>
            <ul className="propositions">
              {props.map((p, i) => (
                <li key={i} className={p.matchsMini < minRequis ? 'non-conforme' : ''}>
                  <button className="lien" disabled={p.matchsMini < minRequis} onClick={() => setF(p.formule)}>{p.libelle}</button>
                  <span className="muted"> · {p.nbMatchs} matchs · {p.matchsMini} matchs minimum par paire{p.matchsMini < minRequis ? ' (non conforme)' : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <label>Type
          <select value={f.type} onChange={(e) => setF({ type: e.target.value as Formule['type'] })}>
            <option value="POULES_TABLEAU">Poules + tableau final (+ matchs de classement)</option>
            <option value="TMC">Tableau multi-chances (TMC)</option>
          </select>
        </label>
        {f.type === 'POULES_TABLEAU' && (
          <>
            <div className="ligne">
              <label>Nombre de poules<input type="number" min={1} value={f.nbPoules} onChange={(e) => setF({ nbPoules: +e.target.value })} /></label>
              <label>Qualifiés par poule<input type="number" min={1} max={4} value={f.qualifiesParPoule} onChange={(e) => setF({ qualifiesParPoule: +e.target.value })} /></label>
            </div>
            {N > 0 && f.nbPoules > 0 && <p className="aide">Poules de {taillesPoules(N, f.nbPoules).join(', ')} paires.</p>}
            <label>Constitution des poules
              <select value={f.methodePoules} onChange={(e) => setF({ methodePoules: e.target.value as Formule['methodePoules'] })}>
                <option value="SERPENTIN">Serpentin (placement fixe selon le poids)</option>
                <option value="REPARTITION_RANG">Répartition par rang (tirage au sort dans chaque rang)</option>
              </select>
            </label>
          </>
        )}
      </section>

      <section className="carte">
        <h2>Formats de jeu</h2>
        <p className="aide">Seuls les formats autorisés pour un {t.categorie} sont proposés.</p>
        {f.type === 'POULES_TABLEAU' && <label>Poules<ChoixFormat t={t} valeur={f.formats.poules} phase="QUALIF" onChange={(v) => setFormat('poules', v)} /></label>}
        <label>Tableau final (hors finale)<ChoixFormat t={t} valeur={f.formats.tableau} phase="TABLEAU" tailleTour={8} onChange={(v) => setFormat('tableau', v)} /></label>
        <label>Finale<ChoixFormat t={t} valeur={f.formats.finale} phase="FINALE" tailleTour={2} onChange={(v) => setFormat('finale', v)} /></label>
        <label>Matchs de classement<ChoixFormat t={t} valeur={f.formats.classement} phase="CLASSEMENT" onChange={(v) => setFormat('classement', v)} /></label>
        <p className="aide">Le format de chaque match reste modifiable ensuite dans l'onglet Planning.</p>
      </section>

      <section className="carte pleine">
        <h2>Conformité</h2>
        <Problemes liste={controlesFormule(t)} okTexte="Formule conforme au règlement" />
        <div className="barre">
          <button onClick={tirer} disabled={N < 2}>{t.matchs.length ? 'Refaire le tirage au sort' : 'Effectuer le tirage au sort'}</button>
          <span className="muted">Le tirage doit être réalisé devant témoins. Il est enregistré dans le journal ci-dessous.</span>
        </div>
      </section>

      <section className="carte pleine">
        <h2>Journal des tirages</h2>
        {!t.tirages.length && <p className="muted">Aucun tirage effectué.</p>}
        {[...t.tirages].reverse().map((j, i) => (
          <details key={i} open={i === 0}>
            <summary><b>{j.libelle}</b> — {new Date(j.date).toLocaleString('fr-FR')} <span className="muted">(graine {j.graine})</span></summary>
            <ul>{j.details.map((d, k) => <li key={k}>{d}</li>)}</ul>
          </details>
        ))}
      </section>
    </div>
  );
}
