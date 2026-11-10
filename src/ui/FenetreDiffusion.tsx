// Fenêtre de diffusion séparée : relit le tournoi sauvegardé toutes les 2 secondes.
import { useEffect, useState } from 'react';
import { nouveauTournoi } from '../engine/tournoi';
import type { Tournoi } from '../engine/types';
import { Diffusion } from './Diffusion';
import { chargerAuto } from './stockage';

const estTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function basculerPleinEcran() {
  if (estTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    await w.setFullscreen(!(await w.isFullscreen()));
  } else if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

export function FenetreDiffusion() {
  const [t, setT] = useState<Tournoi>(() => chargerAuto() ?? nouveauTournoi());
  useEffect(() => {
    let dernier = '';
    const id = setInterval(() => {
      const s = localStorage.getItem('padel-tournoi:courant') ?? '';
      if (s && s !== dernier) {
        dernier = s;
        const n = chargerAuto();
        if (n) setT(n);
      }
    }, 2000);
    document.title = 'Padel Tournoi — Diffusion';
    return () => clearInterval(id);
  }, []);
  const quitter = async () => {
    if (estTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const w = getCurrentWindow();
      if (await w.isFullscreen()) await w.setFullscreen(false);
      else await w.close();
    } else if (document.fullscreenElement) document.exitFullscreen();
  };
  return (
    <div onDoubleClick={basculerPleinEcran} style={{ cursor: 'default' }}>
      <Diffusion t={t} ecran onFermer={quitter} />
    </div>
  );
}
