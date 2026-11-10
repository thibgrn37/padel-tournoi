import { useState } from 'react';
import { classementPoule, pouleTerminee } from '../engine/poules';
import { nomPaireId, saisirResultat, tableauxATirer, tirerTableauxApresPoules } from '../engine/tournoi';
import type { Match, Tournoi } from '../engine/types';
import { LigneMatch, SaisieScore } from './commun';
import { Arbre } from './Arbre';
import { arbres } from '../engine/arbres';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

export function OngletTableaux({ t, maj }: { t: Tournoi; maj: Maj }) {
  const [saisie, setSaisie] = useState<Match | null>(null);
  const aTirer = tableauxATirer(t);
  if (!t.matchs.length) return <p className="vide">Aucun tirage pour l'instant. Choisis la formule puis effectue le tirage dans l'onglet Formule.</p>;
  return (
    <div>
      {aTirer.length > 0 && (
        <div className="bandeau">
          Toutes les poules sont terminées.
          <button onClick={() => maj((x) => tirerTableauxApresPoules(x))}>Tirer au sort les tableaux ({aTirer.map((x) => x.nom).join(', ')})</button>
        </div>
      )}
      {t.poules.length > 0 && (
        <>
          <h2>Poules</h2>
          <div className="poules">
            {t.poules.map((p) => {
              const cl = classementPoule(p, t.matchs, p.departage);
              const fini = pouleTerminee(p, t.matchs);
              return (
                <section className="carte" key={p.id}>
                  <h3>{p.nom} {fini && <span className="pastille">terminée</span>}</h3>
                  <table className="tableau-simple compact">
                    <thead><tr><th>#</th><th>Paire</th><th>J</th><th>Pts</th><th>Sets</th><th>Jeux</th></tr></thead>
                    <tbody>
                      {cl.map((l, i) => (
                        <tr key={l.paireId}>
                          <td>{i + 1}</td>
                          <td>{nomPaireId(t, l.paireId)}{l.egaliteParfaite && fini && <span title="Égalité parfaite : tirage au sort au moment du tirage des tableaux"> 🎲</span>}</td>
                          <td>{l.joues}</td>
                          <td><b>{l.points}</b></td>
                          <td>{l.setsPour - l.setsContre > 0 ? '+' : ''}{l.setsPour - l.setsContre}</td>
                          <td>{l.jeuxPour - l.jeuxContre > 0 ? '+' : ''}{l.jeuxPour - l.jeuxContre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="liste-matchs">
                    {t.matchs.filter((m) => m.groupeId === p.id).map((m) => <LigneMatch key={m.id} t={t} m={m} onClic={() => setSaisie(m)} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      {t.tableaux.map((tab) => {
        const liste = arbres(t).filter((a) => a.racine.match.groupeId === tab.id);
        const [premier, ...autres] = liste;
        return (
          <section key={tab.id} className="carte">
            <h2>{tab.principal ? tab.nom : `Matchs de classement (places ${tab.rangDebut} et suivantes)`}</h2>
            {tab.slots.some((s) => s === null) && <p className="muted">Les paires seront placées par tirage au sort à la fin des poules.</p>}
            {premier && (
              <div className="bloc">
                {!premier.principal && <h4>{premier.titre}</h4>}
                <Arbre t={t} arbre={premier} onClic={setSaisie} />
              </div>
            )}
            <div className="arbres-grille">
              {autres.map((a) => (
                <div key={a.id}>
                  <h4>{a.titre}</h4>
                  <Arbre t={t} arbre={a} onClic={setSaisie} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {saisie && (
        <SaisieScore t={t} m={saisie} onFermer={() => setSaisie(null)}
          onValider={(r) => { maj((x) => saisirResultat(x, saisie.id, r)); setSaisie(null); }} />
      )}
    </div>
  );
}
