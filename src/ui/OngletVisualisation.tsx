import { useState } from 'react';
import type { Affichage, CouleursAffichage, Tournoi } from '../engine/types';
import { affichageDe, AFFICHAGE_DEFAUT, construirePages, Diffusion } from './Diffusion';
import { avertir, choisirFichier } from './stockage';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

const estTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Ouvre la fenêtre de diffusion (à glisser sur l'écran TV puis passer en plein écran). */
export async function ouvrirDiffusion() {
  if (estTauri()) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existante = await WebviewWindow.getByLabel('diffusion');
    if (existante) { await existante.setFocus(); return; }
    new WebviewWindow('diffusion', { url: 'index.html#diffusion', title: 'Padel Tournoi — Diffusion', width: 1280, height: 720 });
  } else {
    window.open(`${location.pathname}#diffusion`, 'diffusion', 'width=1280,height=720');
  }
}

/** Réduit l'image du logo pour ne pas alourdir le fichier du tournoi. */
async function lireLogo(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
    const max = 400;
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const COULEURS: [keyof CouleursAffichage, string][] = [
  ['fond', 'Fond'], ['texte', 'Texte'], ['accent', 'Titres et heures'], ['carte', 'Fond des matchs'], ['gagnant', 'Vainqueurs'], ['traits', "Traits de l'arbre"],
];

const THEMES: [string, CouleursAffichage][] = [
  ['Nuit', AFFICHAGE_DEFAUT.couleurs],
  ['Clair', { fond: '#f5f7fa', texte: '#1c2430', accent: '#1f6feb', carte: '#ffffff', gagnant: '#1a7f37', traits: '#c9d1db' }],
  ['Terre battue', { fond: '#2b1810', texte: '#fdf2e9', accent: '#f39c4a', carte: '#4a2a1a', gagnant: '#ffd166', traits: '#8c5a3c' }],
  ['Gazon', { fond: '#0f2e1d', texte: '#eefbf1', accent: '#c6f432', carte: '#1d4a30', gagnant: '#ffffff', traits: '#3e7a55' }],
];

export function OngletVisualisation({ t, maj }: { t: Tournoi; maj: Maj }) {
  const a = affichageDe(t);
  const set = (v: Partial<Affichage>) => maj((x) => ({ ...x, affichage: { ...affichageDe(x), ...v } }));
  const pages = construirePages(t, a);
  const [page, setPage] = useState(0);
  const [pleinEcran, setPleinEcran] = useState(false);
  const idx = pages.length ? Math.min(page, pages.length - 1) : 0;

  return (
    <div className="grille visu">
      <section className="carte">
        <h2>Personnalisation</h2>
        <label>Titre affiché<input value={a.titre} placeholder={t.nom} onChange={(e) => set({ titre: e.target.value })} /></label>
        <label>Sous-titre<input value={a.sousTitre} placeholder={t.lieu ?? 'Lieu, dates, partenaires…'} onChange={(e) => set({ sousTitre: e.target.value })} /></label>
        <div className="ligne">
          {a.logo && <img src={a.logo} alt="logo" style={{ height: 48, maxWidth: 160, objectFit: 'contain' }} />}
          <button className="secondaire" onClick={async () => {
            const f = await choisirFichier('image/*');
            if (!f) return;
            try { set({ logo: await lireLogo(f) }); } catch { avertir('Image illisible.'); }
          }}>{a.logo ? 'Changer le logo' : 'Ajouter un logo'}</button>
          {a.logo && <button className="lien danger" onClick={() => set({ logo: undefined })}>Retirer</button>}
        </div>
        <h4>Couleurs</h4>
        <div className="ligne">
          {THEMES.map(([nom, c]) => <button key={nom} className="secondaire" onClick={() => set({ couleurs: c })}>{nom}</button>)}
        </div>
        <div className="couleurs">
          {COULEURS.map(([k, lib]) => (
            <label key={k} className="case">
              <input type="color" value={a.couleurs[k]} onChange={(e) => set({ couleurs: { ...a.couleurs, [k]: e.target.value } })} /> {lib}
            </label>
          ))}
        </div>
        <h4>Pages diffusées</h4>
        {([['programme', 'Prochains matchs'], ['poules', 'Poules'], ['tableaux', 'Tableaux (arbres)'], ['classement', 'Classement final']] as const).map(([k, lib]) => (
          <label key={k} className="case"><input type="checkbox" checked={a.pages[k]} onChange={(e) => set({ pages: { ...a.pages, [k]: e.target.checked } })} /> {lib}</label>
        ))}
        <label>Changement de page toutes les (secondes)
          <input type="number" min={3} max={300} value={a.rotationSecondes} onChange={(e) => set({ rotationSecondes: Math.max(3, +e.target.value) })} />
        </label>
      </section>

      <section className="carte">
        <h2>Aperçu</h2>
        <div className="barre">
          <button onClick={ouvrirDiffusion}>Diffuser sur un écran</button>
          <button className="secondaire" onClick={() => setPleinEcran(true)}>Plein écran ici</button>
        </div>
        <p className="aide">« Diffuser sur un écran » ouvre une fenêtre à part : glisse-la sur la TV ou le vidéoprojecteur puis double-clique dedans pour la passer en plein écran. Elle se met à jour toute seule à chaque résultat saisi. Flèches ← → pour changer de page, Échap pour quitter.</p>
        {pages.length > 0 && (
          <div className="barre">
            <button className="secondaire" onClick={() => setPage((idx - 1 + pages.length) % pages.length)}>←</button>
            <span>{idx + 1} / {pages.length} · {pages[idx]?.titre}</span>
            <button className="secondaire" onClick={() => setPage((idx + 1) % pages.length)}>→</button>
          </div>
        )}
        <Diffusion t={t} ecran={false} pageForcee={idx} />
      </section>
      {pleinEcran && <Diffusion t={t} ecran onFermer={() => setPleinEcran(false)} />}
    </div>
  );
}
