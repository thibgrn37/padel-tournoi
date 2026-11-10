// Affichage d'un tableau sous forme d'arbre (traits de liaison entre les tours).
import { provenance, type Arbre as ArbreT, type Noeud } from '../engine/arbres';
import { nomPaireId, resoudre } from '../engine/tournoi';
import type { Match, Tournoi } from '../engine/types';
import { dateCourte, heure, texteScore } from './commun';

function Equipe({ t, m, cote }: { t: Tournoi; m: Match; cote: 'A' | 'B' }) {
  const ref = cote === 'A' ? m.a : m.b;
  const id = resoudre(t, ref);
  const gagne = m.resultat?.vainqueur === cote;
  const perd = m.resultat && !gagne;
  const sets = m.resultat?.sets.map(([a, b]) => (cote === 'A' ? a : b)) ?? [];
  return (
    <div className={`a-equipe ${gagne ? 'a-gagnant' : ''} ${perd ? 'a-perdant' : ''}`}>
      <span className="a-nom">{m.resultat?.auto && perd ? <i className="a-attente">Forfait</i> : id ? nomPaireId(t, id) : <i className="a-attente">{provenance(t, ref)}</i>}</span>
      {m.resultat && m.resultat.issue !== 'WO' && <span className="a-sets">{sets.map((s, i) => <b key={i}>{s}</b>)}</span>}
      {m.resultat?.issue === 'WO' && gagne && <span className="a-sets">WO</span>}
    </div>
  );
}

function Boite({ t, m, onClic, details }: { t: Tournoi; m: Match; onClic?: (m: Match) => void; details: boolean }) {
  const a = resoudre(t, m.a), b = resoudre(t, m.b);
  if (a === 'BYE' || b === 'BYE') {
    const reel = a === 'BYE' ? b : a;
    return (
      <div className="a-boite a-exempt">
        <div className="a-equipe"><span className="a-nom">{reel && reel !== 'BYE' ? nomPaireId(t, reel) : <i className="a-attente">{provenance(t, a === 'BYE' ? m.b : m.a)}</i>}</span></div>
        <div className="a-info">exempt</div>
      </div>
    );
  }
  const terrain = t.terrains.find((x) => x.id === m.terrainId)?.nom;
  const cliquable = onClic && a && b;
  return (
    <div className={`a-boite ${m.resultat ? 'a-joue' : ''} ${cliquable ? 'a-clic' : ''}`} onClick={cliquable ? () => onClic!(m) : undefined}
      title={m.resultat ? texteScore(m.resultat) : m.libelle}>
      <Equipe t={t} m={m} cote="A" />
      <Equipe t={t} m={m} cote="B" />
      {details && !m.resultat && m.debut && <div className="a-info">{dateCourte(m.debut)} {heure(m.debut)}{terrain ? ` · ${terrain}` : ''}</div>}
    </div>
  );
}

function NoeudVue({ t, n, onClic, details }: { t: Tournoi; n: Noeud; onClic?: (m: Match) => void; details: boolean }) {
  const [g, d] = n.enfants;
  return (
    <div className="a-noeud">
      {(g || d) && (
        <>
          <div className="a-enfants">
            {g ? <NoeudVue t={t} n={g} onClic={onClic} details={details} /> : <div className="a-noeud a-vide" />}
            {d ? <NoeudVue t={t} n={d} onClic={onClic} details={details} /> : <div className="a-noeud a-vide" />}
          </div>
          <div className="a-lien" />
        </>
      )}
      <Boite t={t} m={n.match} onClic={onClic} details={details} />
    </div>
  );
}

const nomTour = (p: number) => (p === 1 ? 'Finale' : p === 2 ? '1/2' : `1/${2 ** (p - 1)}`);

export function Arbre({ t, arbre, onClic, details = true, tours = true }: {
  t: Tournoi; arbre: ArbreT; onClic?: (m: Match) => void; details?: boolean; tours?: boolean;
}) {
  return (
    <div className="arbre-v">
      {tours && arbre.principal && arbre.profondeur > 1 && (
        <div className="a-tours">
          {Array.from({ length: arbre.profondeur }, (_, i) => <span key={i}>{nomTour(arbre.profondeur - i)}</span>)}
        </div>
      )}
      <NoeudVue t={t} n={arbre.racine} onClic={onClic} details={details} />
    </div>
  );
}
