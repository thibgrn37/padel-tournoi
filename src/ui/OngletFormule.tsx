import { useMemo } from 'react';
import { controlesFormule } from '../engine/controles';
import { DEF_FORMATS, formatsAutorises, matchsMinimum, type PhaseFormat } from '../engine/regles';
import { taillesPoules } from '../engine/poules';
import { estExempt, genererFormule, matchsMinimumGarantis, selection } from '../engine/tournoi';
import type { FormatCode, FormatsChoisis, Formule, Tournoi } from '../engine/types';
import { Problemes } from './commun';
import { estimer, suggestions } from '../engine/estimation';
import { besoinBalles, BALLES_PAR_BOITE } from '../engine/balles';
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
  // Qualifications + tableau final (grille des P500 / P1000 : nombre de qualifiés selon la taille du TF)
  if (t.formule.type === 'QUALIF_TF' || ['P500', 'P1000', 'P1500', 'P2000'].includes(t.categorie)) {
    for (const [TF, Q] of [[8, 2], [12, 2], [16, 4], [24, 4], [32, 8]] as const) {
      const nQ = N - (TF - Q);
      if (nQ < 2 * Q) continue;
      const tailles = taillesPoules(nQ, Q);
      if (Math.min(...tailles) < 3 || Math.max(...tailles) > 5) continue;
      essai({ type: 'QUALIF_TF', entreesDirectes: TF - Q, nbPoules: Q, qualifiesParPoule: 1 },
        `Tableau final de ${TF} : ${TF - Q} entrées directes + ${Q} qualifiés (${nQ} paires en ${Q} poules de qualification)`);
    }
  }
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
          <select value={f.type} onChange={(e) => {
            const type = e.target.value as Formule['type'];
            if (type === 'QUALIF_TF' && !f.entreesDirectes) {
              const D = N >= 28 ? 12 : Math.max(2, N - 8);
              setF({ type, entreesDirectes: D, nbPoules: N - D >= 8 ? 4 : 2, qualifiesParPoule: 1 });
            } else setF({ type });
          }}>
            <option value="POULES_TABLEAU">Poules + tableau final (+ matchs de classement)</option>
            <option value="TMC">Tableau multi-chances (TMC)</option>
            <option value="QUALIF_TF">Qualifications (poules) + tableau final</option>
          </select>
        </label>
        {f.type === 'QUALIF_TF' && (
          <>
            <label>Entrées directes dans le tableau final (wild cards TF comprises)<input type="number" min={1} value={f.entreesDirectes ?? 0} onChange={(e) => setF({ entreesDirectes: +e.target.value })} /></label>
            <p className="aide">
              Tableau final de {(f.entreesDirectes ?? 0) + f.nbPoules * f.qualifiesParPoule} paires : {f.entreesDirectes ?? 0} entrées directes (les meilleurs poids)
              + {f.nbPoules * f.qualifiesParPoule} qualifiés. {Math.max(0, N - (f.entreesDirectes ?? 0))} paires en qualifications
              {N - (f.entreesDirectes ?? 0) > 0 && f.nbPoules > 0 ? ` (poules de ${taillesPoules(N - (f.entreesDirectes ?? 0), f.nbPoules).join(', ')})` : ''}.
              Les non-qualifiés jouent leurs matchs de classement ; les lucky losers se gèrent dans l'onglet Poules & tableaux.
            </p>
          </>
        )}
        {(f.type === 'POULES_TABLEAU' || f.type === 'QUALIF_TF') && (
          <>
            <div className="ligne">
              <label>Nombre de poules<input type="number" min={1} value={f.nbPoules} onChange={(e) => setF({ nbPoules: +e.target.value })} /></label>
              <label>Qualifiés par poule<input type="number" min={1} max={4} value={f.qualifiesParPoule} onChange={(e) => setF({ qualifiesParPoule: +e.target.value })} /></label>
            </div>
            {f.type === 'POULES_TABLEAU' && N > 0 && f.nbPoules > 0 && <p className="aide">Poules de {taillesPoules(N, f.nbPoules).join(', ')} paires.</p>}
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
        {f.type !== 'TMC' && <label>{f.type === 'QUALIF_TF' ? 'Qualifications (poules)' : 'Poules'}<ChoixFormat t={t} valeur={f.formats.poules} phase="QUALIF" onChange={(v) => setFormat('poules', v)} /></label>}
        <label>Tableau final (hors finale)<ChoixFormat t={t} valeur={f.formats.tableau} phase="TABLEAU" tailleTour={8} onChange={(v) => setFormat('tableau', v)} /></label>
        <label>Finale<ChoixFormat t={t} valeur={f.formats.finale} phase="FINALE" tailleTour={2} onChange={(v) => setFormat('finale', v)} /></label>
        <label>Matchs de classement<ChoixFormat t={t} valeur={f.formats.classement} phase="CLASSEMENT" onChange={(v) => setFormat('classement', v)} /></label>
        <p className="aide">Le format de chaque match reste modifiable ensuite dans l'onglet Planning.</p>
      </section>

      <Faisabilite t={t} maj={maj} />
      <Balles t={t} />

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

const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;
const finLisible = (d?: string) =>
  d ? `${new Date(d.slice(0, 10) + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.slice(11, 16)}` : '—';

/** La formule tient-elle dans les journées / terrains prévus ? Sinon, pistes qui fonctionnent. */
function Faisabilite({ t, maj }: { t: Tournoi; maj: Maj }) {
  const cle = JSON.stringify([t.paires.length, t.paires.map((p) => p.forfait), t.formule, t.terrains.length, t.journees, t.pauses, t.reglages, t.categorie, t.public]);
  const e = useMemo(() => estimer(t), [cle]);
  const pistes = useMemo(() => (e.possible && !e.tient ? suggestions(t) : []), [cle, e]);
  const taux = e.minutesDisponibles ? Math.round((e.minutesNecessaires / e.minutesDisponibles) * 100) : 0;
  return (
    <section className="carte pleine">
      <h2>Temps disponible</h2>
      {!e.possible ? <p className="muted">{e.erreur}</p> : (
        <>
          <p className={e.tient ? 'ok' : 'erreur-texte'}>
            {e.tient
              ? `✓ Ça tient : ${e.nbMatchs} matchs, fin prévue ${finLisible(e.fin)}.`
              : `⛔ Ça ne tient pas : ${e.nbNonPlanifies} match(s) sur ${e.nbMatchs} ne rentrent pas dans les journées prévues.`}
          </p>
          <p className="aide">
            Temps de jeu nécessaire : {hm(e.minutesNecessaires)} de terrain, pour {hm(e.minutesDisponibles)} disponibles ({taux} % d'occupation, {t.terrains.length} terrain(s)).
            Le calcul respecte les temps de repos, les pauses et l'enchaînement des tours ; il utilise les durées de match de l'onglet Tournoi.
          </p>
          {!e.tient && (
            pistes.length ? (
              <>
                <h4>Ce qui fonctionnerait</h4>
                <ul className="propositions">
                  {pistes.slice(0, 8).map((s, i) => (
                    <li key={i}>
                      <button className="lien" onClick={() => maj((x) => s.appliquer(x))}>{s.libelle}</button>
                      <span className="muted"> · fin {finLisible(s.estimation.fin)} · {s.estimation.nbMatchs} matchs</span>
                    </li>
                  ))}
                </ul>
                <p className="aide">Clique sur une piste pour l'appliquer.</p>
              </>
            ) : <p className="muted">Aucune piste simple ne suffit : ajoute une journée ou plusieurs terrains.</p>
          )}
        </>
      )}
    </section>
  );
}

/** Boîtes de balles à prévoir et moments où ouvrir des balles neuves (cahier des charges). */
function Balles({ t }: { t: Tournoi }) {
  const cle = JSON.stringify([t.paires.length, t.paires.map((p) => p.forfait), t.formule, t.terrains.length, t.categorie, t.public, t.matchs.length]);
  const b = useMemo(() => {
    if (t.matchs.length) return besoinBalles(t);
    try { return besoinBalles(genererFormule({ ...t, tirages: [] }, 1)); } catch { return null; }
  }, [cle]);
  if (!b) return null;
  const pluriel = (n: number) => `${n} boîte${n > 1 ? 's' : ''}`;
  return (
    <section className="carte pleine">
      <h2>Balles</h2>
      <p><b>{pluriel(b.total)}</b> de {BALLES_PAR_BOITE} balles à prévoir{b.boites3eSet ? ' (au maximum, si tous les matchs A1 vont au 3e set)' : ''}{!t.matchs.length ? ', d\'après la formule choisie' : ''}.</p>
      <ul>
        {b.boitesTerrains > 0 && <li>{pluriel(b.boitesTerrains)} pour la mise en place : 1 par terrain ({t.terrains.length} terrain{t.terrains.length > 1 ? 's' : ''}).</li>}
        {b.boitesMatchs > 0 && <li>{pluriel(b.boitesMatchs)} pour les matchs joués avec des balles neuves.</li>}
        {b.boites3eSet > 0 && <li>Jusqu'à {pluriel(b.boites3eSet)} pour les changements au 3e set des matchs A1.</li>}
      </ul>
      <h4>Règle du {t.categorie}{t.public === 'JEUNES' ? ' jeunes' : ''}</h4>
      <ul>{b.regle.texte.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p className="aide">Les matchs qui demandent des balles neuves portent la pastille 🎾 dans le planning, les résultats et les tableaux. Prévois quelques boîtes de réserve (balles abîmées, matchs longs).</p>
    </section>
  );
}
