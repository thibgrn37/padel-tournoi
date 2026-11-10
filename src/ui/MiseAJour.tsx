// Vérifie au démarrage (puis toutes les heures) si une nouvelle version est publiée sur GitHub,
// et propose de l'installer en un clic.
import { useCallback, useEffect, useState } from 'react';

const estTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type Etat =
  | { k: 'rien' }
  | { k: 'dispo'; version: string; notes?: string; installer: () => Promise<void> }
  | { k: 'telechargement'; pourcent: number | null }
  | { k: 'erreur'; message: string }
  | { k: 'ajour' };

export function useVersion() {
  const [version, setVersion] = useState<string>('');
  useEffect(() => {
    if (!estTauri()) return;
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setVersion).catch(() => {});
  }, []);
  return version;
}

export function MiseAJour({ verifManuelle }: { verifManuelle: number }) {
  const [etat, setEtat] = useState<Etat>({ k: 'rien' });

  const verifier = useCallback(async (manuel: boolean) => {
    if (!estTauri()) return;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const maj = await check();
      if (!maj) {
        if (manuel) setEtat({ k: 'ajour' });
        return;
      }
      setEtat({
        k: 'dispo',
        version: maj.version,
        notes: maj.body,
        installer: async () => {
          let total = 0, recu = 0;
          setEtat({ k: 'telechargement', pourcent: null });
          await maj.downloadAndInstall((ev) => {
            if (ev.event === 'Started') total = ev.data.contentLength ?? 0;
            if (ev.event === 'Progress') {
              recu += ev.data.chunkLength;
              setEtat({ k: 'telechargement', pourcent: total ? Math.round((recu / total) * 100) : null });
            }
          });
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        },
      });
    } catch (e) {
      if (manuel) setEtat({ k: 'erreur', message: String(e) });
    }
  }, []);

  useEffect(() => {
    verifier(false);
    const id = setInterval(() => verifier(false), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [verifier]);
  useEffect(() => { if (verifManuelle) verifier(true); }, [verifManuelle, verifier]);

  if (etat.k === 'rien') return null;
  return (
    <div className="bandeau maj">
      {etat.k === 'dispo' && (
        <>
          <span>🎉 Nouvelle version <b>{etat.version}</b> disponible.{etat.notes ? ` ${etat.notes}` : ''}</span>
          <button onClick={() => etat.installer().catch((e) => setEtat({ k: 'erreur', message: String(e) }))}>Mettre à jour maintenant</button>
          <button className="secondaire" onClick={() => setEtat({ k: 'rien' })}>Plus tard</button>
        </>
      )}
      {etat.k === 'telechargement' && <span>Téléchargement de la mise à jour… {etat.pourcent != null ? `${etat.pourcent} %` : ''} L'application va redémarrer, ton tournoi est conservé.</span>}
      {etat.k === 'ajour' && <><span>✓ L'application est à jour.</span><button className="secondaire" onClick={() => setEtat({ k: 'rien' })}>OK</button></>}
      {etat.k === 'erreur' && <><span className="erreur-texte">Mise à jour impossible : {etat.message}</span><button className="secondaire" onClick={() => setEtat({ k: 'rien' })}>Fermer</button></>}
    </div>
  );
}
