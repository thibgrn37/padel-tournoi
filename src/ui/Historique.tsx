// Liste des tournois déjà créés sur cet ordinateur (sauvegarde automatique).
import { useState } from 'react';
import type { Tournoi } from '../engine/types';
import { confirmer, lireHistorique, supprimerHistorique } from './stockage';

export function Historique({ courantId, onOuvrir, onFermer }: { courantId?: string; onOuvrir: (t: Tournoi) => void; onFermer: () => void }) {
  const [liste, setListe] = useState(lireHistorique);
  const date = (d?: string) => (d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  return (
    <div className="modale-fond" onClick={onFermer}>
      <div className="modale large" onClick={(e) => e.stopPropagation()}>
        <h3>Historique des tournois</h3>
        {!liste.length && <p className="muted">Aucun tournoi pour l'instant. Chaque tournoi est rangé ici automatiquement dès qu'il a des inscrits.</p>}
        {liste.length > 0 && (
          <table className="tableau-simple">
            <thead><tr><th>Tournoi</th><th>Catégorie</th><th>Date</th><th>Paires</th><th>Modifié</th><th></th></tr></thead>
            <tbody>
              {liste.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.nom}</b>{e.id === courantId && <span className="muted"> (ouvert)</span>}</td>
                  <td>{e.categorie}</td>
                  <td>{date(e.date)}</td>
                  <td>{e.nbPaires}</td>
                  <td className="muted">{new Date(e.modifie).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    {e.id !== courantId && <button className="lien" onClick={() => onOuvrir(e.data)}>Ouvrir</button>}
                    {e.id !== courantId && <button className="lien danger" onClick={async () => {
                      if (!(await confirmer(`Supprimer « ${e.nom} » de l'historique ?`))) return;
                      supprimerHistorique(e.id);
                      setListe(lireHistorique());
                    }}>Supprimer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="aide">L'historique est gardé sur cet ordinateur. Pour changer d'ordinateur ou faire une copie de sécurité, utilise « Enregistrer… ».</p>
        <div className="actions"><button className="secondaire" onClick={onFermer}>Fermer</button></div>
      </div>
    </div>
  );
}
