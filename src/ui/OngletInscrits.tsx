import { useState } from 'react';
import { controlesInscrits } from '../engine/controles';
import { selectionAuClassement } from '../engine/regles';
import { nomPaire, poids, selection, separerDirects } from '../engine/tournoi';
import type { Joueur, Paire, Sexe, Tournoi } from '../engine/types';
import { Problemes } from './commun';
import { CHAMPS_JOUEUR, convertir, devinerMappage, lireFichier, type Mappage, type Tableur } from './importInscrits';
import { avertir, choisirFichier, confirmer } from './stockage';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

const joueurVide = (sexe: Sexe): Joueur => ({ nom: '', prenom: '', licence: '', sexe, classement: null });

export function OngletInscrits({ t, maj }: { t: Tournoi; maj: Maj }) {
  const sexeDefaut: Sexe = t.discipline === 'DD' ? 'F' : 'H';
  const [edition, setEdition] = useState<Paire | null>(null);
  const [imp, setImp] = useState<{ tab: Tableur; map: Mappage } | null>(null);
  const { retenues, attente } = selection(t);
  const qualifTF = t.formule.type === 'QUALIF_TF';
  const avecWC = qualifTF || ['P500', 'P1000', 'P1500', 'P2000'].includes(t.categorie);
  // phase d'entrée prévue (avant tirage : selon le poids ; après : selon le tirage)
  const tf = t.tableaux.find((x) => x.principal);
  const directs = new Set(qualifTF
    ? (tf?.origine.type === 'POULES' && tf.origine.directs) || separerDirects(t, [...retenues].sort((a, b) => poids(t, a) - poids(t, b)).map((p) => p.id)).directs
    : []);
  const statut = (p: Paire) => (p.forfait ? 'Forfait' : attente.includes(p) ? 'Liste d\'attente'
    : qualifTF ? (directs.has(p.id) ? 'Tableau final' : 'Qualifications') : 'Retenue') + (p.luckyLoser ? ' (lucky loser)' : '');
  const setWC = (p: Paire, v: string) => maj((x) => ({ ...x, paires: x.paires.map((y) => (y.id === p.id ? { ...y, wildCard: (v || undefined) as Paire['wildCard'] } : y)) }));
  const formuleCree = t.matchs.length > 0;
  const tri = [...t.paires].sort((a, b) => a.ordreInscription - b.ordreInscription);

  const nouvelle = () => setEdition({
    id: `p${Date.now().toString(36)}`, j1: joueurVide(sexeDefaut), j2: joueurVide(t.discipline === 'DX' ? 'F' : sexeDefaut),
    ordreInscription: Math.max(0, ...t.paires.map((p) => p.ordreInscription)) + 1,
  });
  const enregistrer = (p: Paire) => {
    maj((x) => ({ ...x, paires: x.paires.some((y) => y.id === p.id) ? x.paires.map((y) => (y.id === p.id ? p : y)) : [...x.paires, p] }));
    setEdition(null);
  };
  const importer = async () => {
    const f = await choisirFichier('.xlsx,.csv,.txt');
    if (!f) return;
    try {
      const tab = await lireFichier(f);
      setImp({ tab, map: devinerMappage(tab.entetes, sexeDefaut) });
    } catch (e) {
      avertir(`Lecture impossible : ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="barre">
        <button onClick={nouvelle}>+ Ajouter une paire</button>
        <button className="secondaire" onClick={importer}>Importer un fichier (Excel / CSV)</button>
        {!t.paires.length && <button className="secondaire" onClick={() => maj((x) => ({ ...x, paires: pairesExemple(x.discipline) }))}>Charger 16 paires d'exemple</button>}
        <span className="muted">
          {retenues.length} paire(s) retenue(s){attente.length ? `, ${attente.length} en liste d'attente` : ''} ·
          Sélection {selectionAuClassement(t.categorie) ? 'au classement (poids)' : "par ordre d'inscription"}
        </span>
      </div>
      {formuleCree && <p className="alerte-texte">La formule est déjà tirée : une modification des inscrits nécessitera de refaire le tirage.</p>}
      <Problemes liste={controlesInscrits(t)} okTexte="Inscriptions conformes au règlement" />
      <table className="tableau-simple">
        <thead>
          <tr><th>#</th><th>Joueur 1</th><th>Joueur 2</th><th>Poids</th>{avecWC && <th>Wild card</th>}<th>Statut</th><th></th></tr>
        </thead>
        <tbody>
          {tri.map((p) => (
            <tr key={p.id} className={p.forfait ? 'barre-texte' : ''}>
              <td>{p.ordreInscription}</td>
              <td>{ligneJoueur(p.j1)}</td>
              <td>{ligneJoueur(p.j2)}</td>
              <td><b>{poids(t, p).toLocaleString('fr-FR')}</b></td>
              {avecWC && (
                <td>
                  <select value={p.wildCard ?? ''} onChange={(e) => setWC(p, e.target.value)}>
                    <option value="">—</option>
                    <option value="TF">WC tableau final</option>
                    <option value="Q">WC qualifications</option>
                  </select>
                </td>
              )}
              <td>{statut(p)}</td>
              <td className="actions-ligne">
                <button className="lien" onClick={() => setEdition(p)}>Modifier</button>
                <button className="lien" onClick={() => maj((x) => ({ ...x, paires: x.paires.map((y) => (y.id === p.id ? { ...y, forfait: !y.forfait } : y)) }))}>
                  {p.forfait ? 'Réintégrer' : 'Forfait'}
                </button>
                <button className="lien danger" onClick={async () => (await confirmer(`Supprimer ${nomPaire(p)} ?`)) && maj((x) => ({ ...x, paires: x.paires.filter((y) => y.id !== p.id) }))}>Supprimer</button>
              </td>
            </tr>
          ))}
          {!t.paires.length && <tr><td colSpan={avecWC ? 7 : 6} className="vide">Aucune paire. Ajoute-les à la main ou importe un fichier.</td></tr>}
        </tbody>
      </table>
      {edition && <EditionPaire paire={edition} onValider={enregistrer} onFermer={() => setEdition(null)} />}
      {imp && (
        <ImportModale imp={imp} setImp={setImp} t={t} onValider={(ps) => { maj((x) => ({ ...x, paires: [...x.paires, ...ps] })); setImp(null); }} />
      )}
    </div>
  );
}

const ligneJoueur = (j: Joueur) => (
  <>
    {j.prenom} <b>{j.nom}</b> <span className="muted">({j.sexe}, {j.classement ?? 'NC'}{j.licence ? `, ${j.licence}` : ''})</span>
  </>
);

function EditionPaire({ paire, onValider, onFermer }: { paire: Paire; onValider: (p: Paire) => void; onFermer: () => void }) {
  const [p, setP] = useState(paire);
  const champ = (k: 'j1' | 'j2') => {
    const j = p[k];
    const setJ = (v: Partial<Joueur>) => setP({ ...p, [k]: { ...j, ...v } });
    return (
      <fieldset>
        <legend>{k === 'j1' ? 'Joueur 1' : 'Joueur 2'}</legend>
        <div className="ligne">
          <label>Nom<input value={j.nom} onChange={(e) => setJ({ nom: e.target.value })} autoFocus={k === 'j1'} /></label>
          <label>Prénom<input value={j.prenom} onChange={(e) => setJ({ prenom: e.target.value })} /></label>
        </div>
        <div className="ligne">
          <label>Licence<input value={j.licence ?? ''} onChange={(e) => setJ({ licence: e.target.value })} /></label>
          <label>Sexe
            <select value={j.sexe} onChange={(e) => setJ({ sexe: e.target.value as Sexe })}>
              <option value="H">H</option><option value="F">F</option>
            </select>
          </label>
          <label>Classement (vide = NC)
            <input type="number" min={1} value={j.classement ?? ''} onChange={(e) => setJ({ classement: e.target.value ? +e.target.value : null })} />
          </label>
        </div>
      </fieldset>
    );
  };
  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale" onClick={(e) => e.stopPropagation()}>
        <h3>Paire</h3>
        {champ('j1')}
        {champ('j2')}
        <label>Ordre d'inscription<input type="number" min={1} value={p.ordreInscription} onChange={(e) => setP({ ...p, ordreInscription: +e.target.value })} /></label>
        <div className="actions">
          <button className="secondaire" onClick={onFermer}>Annuler</button>
          <button disabled={!p.j1.nom || !p.j2.nom} onClick={() => onValider(p)}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const LIBELLES: Record<string, string> = { nom: 'Nom', prenom: 'Prénom', licence: 'Licence', sexe: 'Sexe', classement: 'Classement', club: 'Club' };

function ImportModale({ imp, setImp, t, onValider }: {
  imp: { tab: Tableur; map: Mappage }; setImp: (x: { tab: Tableur; map: Mappage } | null) => void; t: Tournoi; onValider: (p: Paire[]) => void;
}) {
  const { tab, map } = imp;
  const setMap = (m: Mappage) => setImp({ tab, map: m });
  const apercu = convertir(tab, map, Math.max(0, ...t.paires.map((p) => p.ordreInscription)) + 1);
  const choix = (j: 'j1' | 'j2', c: (typeof CHAMPS_JOUEUR)[number]) => (
    <select value={map[j][c] ?? ''} onChange={(e) => setMap({ ...map, [j]: { ...map[j], [c]: e.target.value === '' ? undefined : +e.target.value } })}>
      <option value="">—</option>
      {tab.entetes.map((h, i) => <option key={i} value={i}>{h}</option>)}
    </select>
  );
  return (
    <div className="modale-fond">
      <div className="modale large">
        <h3>Importer des inscrits</h3>
        <p className="muted">{tab.lignes.length} ligne(s) lue(s). Indique quelle colonne contient quelle information.</p>
        <label>Organisation du fichier
          <select value={map.mode} onChange={(e) => setMap({ ...map, mode: e.target.value as Mappage['mode'] })}>
            <option value="PAIRE">Une ligne par paire (colonnes joueur 1 et joueur 2)</option>
            <option value="JOUEUR">Une ligne par joueur</option>
          </select>
        </label>
        <table className="tableau-simple">
          <thead><tr><th></th>{CHAMPS_JOUEUR.map((c) => <th key={c}>{LIBELLES[c]}</th>)}</tr></thead>
          <tbody>
            <tr><td>{map.mode === 'PAIRE' ? 'Joueur 1' : 'Joueur'}</td>{CHAMPS_JOUEUR.map((c) => <td key={c}>{choix('j1', c)}</td>)}</tr>
            {map.mode === 'PAIRE' && <tr><td>Joueur 2</td>{CHAMPS_JOUEUR.map((c) => <td key={c}>{choix('j2', c)}</td>)}</tr>}
          </tbody>
        </table>
        {map.mode === 'JOUEUR' && (
          <label>Colonne qui identifie la paire (sinon : 2 lignes consécutives = 1 paire)
            <select value={map.colPaire ?? ''} onChange={(e) => setMap({ ...map, colPaire: e.target.value === '' ? undefined : +e.target.value })}>
              <option value="">—</option>
              {tab.entetes.map((h, i) => <option key={i} value={i}>{h}</option>)}
            </select>
          </label>
        )}
        <label>Sexe si non précisé
          <select value={map.sexeParDefaut} onChange={(e) => setMap({ ...map, sexeParDefaut: e.target.value as Sexe })}>
            <option value="H">H</option><option value="F">F</option>
          </select>
        </label>
        <h4>Aperçu : {apercu.length} paire(s)</h4>
        <ul className="apercu">
          {apercu.slice(0, 8).map((p) => <li key={p.id}>{ligneJoueur(p.j1)} &nbsp;/&nbsp; {ligneJoueur(p.j2)}</li>)}
          {apercu.length > 8 && <li className="muted">…</li>}
        </ul>
        <div className="actions">
          <button className="secondaire" onClick={() => setImp(null)}>Annuler</button>
          <button disabled={!apercu.length} onClick={() => onValider(apercu)}>Importer {apercu.length} paire(s)</button>
        </div>
      </div>
    </div>
  );
}

const NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Lefevre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez', 'Legrand', 'Garnier'];
const PRENOMS_H = ['Lucas', 'Hugo', 'Louis', 'Jules', 'Arthur', 'Adam', 'Paul', 'Tom'];
const PRENOMS_F = ['Emma', 'Jade', 'Louise', 'Alice', 'Chloé', 'Lina', 'Léa', 'Manon'];

/** Paires fictives pour essayer l'application. */
function pairesExemple(d: Tournoi['discipline']): Paire[] {
  return Array.from({ length: 16 }, (_, i) => {
    const s1: Sexe = d === 'DD' ? 'F' : 'H';
    const s2: Sexe = d === 'DM' ? 'H' : 'F';
    const j = (k: number, sexe: Sexe): Joueur => ({
      nom: NOMS[(i * 2 + k) % NOMS.length], prenom: (sexe === 'H' ? PRENOMS_H : PRENOMS_F)[(i + k) % 8], sexe,
      licence: String(1000000 + i * 2 + k), classement: i === 15 && k === 1 ? null : 2500 + ((i * 7919 + k * 104729) % 9000),
    });
    return { id: `ex${i + 1}`, j1: j(0, s1), j2: j(1, s2), ordreInscription: i + 1 };
  });
}
