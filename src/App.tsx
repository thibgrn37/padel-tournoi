import { useCallback, useEffect, useRef, useState } from 'react';
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
import { avertir, chargerAuto, choisirFichier, confirmer, enregistrerFichier, nomFichier, sauverAuto, avecClub, sauverClub, archiver, avecId } from './ui/stockage';
import { Historique } from './ui/Historique';

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
  const [t, setTEtat] = useState<Tournoi>(() => avecId(propagerSorties(chargerAuto() ?? avecClub(nouveauTournoi()))));
  const courant = useRef(t);
  // Annuler / rétablir : pile des états précédents (les modifications rapprochées, comme la frappe, sont regroupées)
  const passe = useRef<Tournoi[]>([]);
  const futur = useRef<Tournoi[]>([]);
  const dernierAjout = useRef(0);
  const [, rafraichir] = useState(0);
  const remplacer = (n: Tournoi, garderHistorique = false) => {
    if (!garderHistorique) { passe.current = []; futur.current = []; }
    courant.current = n;
    setTEtat(n);
  };
  const setT = (n: Tournoi) => { archiver(courant.current); remplacer(avecId(n)); };
  const [onglet, setOnglet] = useState<Onglet>('tournoi');
  const version = useVersion();
  const [verifMaj, setVerifMaj] = useState(0);
  const maj = useCallback((f: (t: Tournoi) => Tournoi) => {
    const x = courant.current;
    const n = propagerSorties(f(x));
    if (n === x) return;
    const maintenant = Date.now();
    // la frappe dans un champ est regroupée en une seule étape ; chaque clic compte pour une étape
    const frappe = !!document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=color]), textarea');
    if (!frappe || maintenant - dernierAjout.current > 1000) {
      passe.current = [...passe.current.slice(-49), x];
      dernierAjout.current = maintenant;
    }
    futur.current = [];
    courant.current = n;
    setTEtat(n);
  }, []);
  const annuler = useCallback(() => {
    const p = passe.current.pop();
    if (!p) return;
    futur.current.push(courant.current);
    dernierAjout.current = 0;
    remplacer(p, true);
    rafraichir((k) => k + 1);
  }, []);
  const retablir = useCallback(() => {
    const f = futur.current.pop();
    if (!f) return;
    passe.current.push(courant.current);
    dernierAjout.current = 0;
    remplacer(f, true);
    rafraichir((k) => k + 1);
  }, []);
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const cible = e.target as HTMLElement;
      if (cible.closest('input, textarea, select, [contenteditable]')) return; // annulation native du champ
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); retablir(); }
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [annuler, retablir]);
  useEffect(() => sauverAuto(t), [t]);
  // historique des tournois (enregistré une seconde après la dernière modification)
  useEffect(() => { const id = setTimeout(() => archiver(t), 1000); return () => clearTimeout(id); }, [t]);
  const [histo, setHisto] = useState(false);
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
    if (await confirmer('Créer un nouveau tournoi ? Le tournoi actuel reste disponible dans l\'Historique.')) { setT(avecClub(nouveauTournoi())); setOnglet('tournoi'); }
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
          <button className="secondaire" onClick={annuler} disabled={!passe.current.length} title="Annuler (⌘Z)">↶</button>
          <button className="secondaire" onClick={retablir} disabled={!futur.current.length} title="Rétablir (⇧⌘Z)">↷</button>
          <button className="secondaire" onClick={nouveau}>Nouveau</button>
          <button className="secondaire" onClick={() => setHisto(true)}>Historique</button>
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
      {histo && <Historique courantId={t.id} onFermer={() => setHisto(false)} onOuvrir={(x) => { setT(propagerSorties(x)); setHisto(false); setOnglet('tournoi'); }} />}
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
