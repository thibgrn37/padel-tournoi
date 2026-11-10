import { useCallback, useEffect, useState } from 'react';
import { nouveauTournoi, propagerSorties } from './engine/tournoi';
import type { Tournoi } from './engine/types';
import { OngletFormule } from './ui/OngletFormule';
import { OngletInscrits } from './ui/OngletInscrits';
import { OngletPlanning } from './ui/OngletPlanning';
import { OngletClassement, OngletResultats } from './ui/OngletResultats';
import { OngletTableaux } from './ui/OngletTableaux';
import { OngletTournoi } from './ui/OngletTournoi';
import { OngletVisualisation } from './ui/OngletVisualisation';
import { MiseAJour, useVersion } from './ui/MiseAJour';
import { avertir, chargerAuto, choisirFichier, confirmer, enregistrerFichier, nomFichier, sauverAuto, avecClub, sauverClub } from './ui/stockage';

const ONGLETS = [
  ['tournoi', '1. Tournoi'],
  ['inscrits', '2. Inscrits'],
  ['formule', '3. Formule & tirage'],
  ['tableaux', '4. Poules & tableaux'],
  ['planning', '5. Planning'],
  ['resultats', '6. Résultats'],
  ['classement', '7. Classement'],
  ['visualisation', '8. Visualisation'],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

export default function App() {
  const [t, setT] = useState<Tournoi>(() => propagerSorties(chargerAuto() ?? avecClub(nouveauTournoi())));
  const [onglet, setOnglet] = useState<Onglet>('tournoi');
  const version = useVersion();
  const [verifMaj, setVerifMaj] = useState(0);
  const maj = useCallback((f: (t: Tournoi) => Tournoi) => setT((x) => propagerSorties(f(x))), []);
  useEffect(() => sauverAuto(t), [t]);
  // terrains, structure et visuel deviennent les réglages par défaut des prochains tournois
  useEffect(() => sauverClub(t), [t.terrains, t.lieu, t.affichage]);

  const ouvrir = async () => {
    const f = await choisirFichier('.json');
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Tournoi;
      if (data.version !== 1 || !Array.isArray(data.paires)) throw new Error('fichier non reconnu');
      setT(propagerSorties(data));
      setOnglet('tournoi');
    } catch (e) {
      avertir(`Impossible d'ouvrir ce fichier : ${(e as Error).message}`);
    }
  };
  const enregistrer = () => enregistrerFichier(JSON.stringify(t, null, 2), `${nomFichier(t)}.padel.json`, 'json');
  const nouveau = async () => {
    if (await confirmer('Créer un nouveau tournoi ? Pense à enregistrer le tournoi actuel avant.')) { setT(avecClub(nouveauTournoi())); setOnglet('tournoi'); }
  };

  return (
    <div className="app">
      <header>
        <div className="titre">
          <span className="logo">🎾</span>
          <div>
            <h1>{t.nom}</h1>
            <span className="muted">{t.categorie} · {t.discipline === 'DM' ? 'Messieurs' : t.discipline === 'DD' ? 'Dames' : 'Mixte'} · {t.paires.filter((p) => !p.forfait).length} paires</span>
          </div>
        </div>
        <div className="actions-entete">
          <button className="secondaire" onClick={nouveau}>Nouveau</button>
          <button className="secondaire" onClick={ouvrir}>Ouvrir…</button>
          <button className="secondaire" onClick={enregistrer}>Enregistrer…</button>
          <button className="secondaire" onClick={() => window.print()}>Imprimer</button>
          {version && <button className="lien version" title="Vérifier les mises à jour" onClick={() => setVerifMaj((n) => n + 1)}>v{version}</button>}
        </div>
      </header>
      <nav>
        {ONGLETS.map(([id, nom]) => (
          <button key={id} className={onglet === id ? 'actif' : ''} onClick={() => setOnglet(id)}>{nom}</button>
        ))}
      </nav>
      <MiseAJour verifManuelle={verifMaj} />
      <main>
        {onglet === 'tournoi' && <OngletTournoi t={t} maj={maj} />}
        {onglet === 'inscrits' && <OngletInscrits t={t} maj={maj} />}
        {onglet === 'formule' && <OngletFormule t={t} maj={maj} allerA={(o) => setOnglet(o as Onglet)} />}
        {onglet === 'tableaux' && <OngletTableaux t={t} maj={maj} />}
        {onglet === 'planning' && <OngletPlanning t={t} maj={maj} />}
        {onglet === 'resultats' && <OngletResultats t={t} maj={maj} />}
        {onglet === 'classement' && <OngletClassement t={t} />}
        {onglet === 'visualisation' && <OngletVisualisation t={t} maj={maj} />}
      </main>
    </div>
  );
}
