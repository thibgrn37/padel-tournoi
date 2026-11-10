import { CATEGORIES, DEF_FORMATS, FORMATS, formatsParDefaut, nbMinTerrains, dureeMaxJours, reposApres } from '../engine/regles';
import type { Categorie, Discipline, Public, Tournoi } from '../engine/types';

type Maj = (f: (t: Tournoi) => Tournoi) => void;

export function OngletTournoi({ t, maj }: { t: Tournoi; maj: Maj }) {
  const set = <K extends keyof Tournoi>(k: K, v: Tournoi[K]) => maj((x) => ({ ...x, [k]: v }));
  const changerCategorie = (categorie: Categorie, pub = t.public) =>
    maj((x) => ({ ...x, categorie, public: pub, formule: { ...x.formule, formats: { ...formatsParDefaut(categorie, pub) } } }));
  return (
    <div className="grille">
      <section className="carte">
        <h2>Épreuve</h2>
        <label>Nom du tournoi<input value={t.nom} onChange={(e) => set('nom', e.target.value)} /></label>
        <label>Structure / lieu<input value={t.lieu ?? ''} onChange={(e) => set('lieu', e.target.value)} /></label>
        <div className="ligne">
          <label>Catégorie
            <select value={t.categorie} onChange={(e) => changerCategorie(e.target.value as Categorie)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Épreuve
            <select value={t.discipline} onChange={(e) => set('discipline', e.target.value as Discipline)}>
              <option value="DM">Messieurs</option>
              <option value="DD">Dames</option>
              <option value="DX">Mixte</option>
            </select>
          </label>
          <label>Âge
            <select value={t.public} onChange={(e) => changerCategorie(t.categorie, e.target.value as Public)}>
              <option value="SENIORS">Seniors</option>
              <option value="PLUS45">+45 ans</option>
              <option value="PLUS55">+55 ans</option>
              <option value="JEUNES">Jeunes</option>
            </select>
          </label>
        </div>
        {t.discipline === 'DM' && (
          <label className="case"><input type="checkbox" checked={t.damesAutorisees} onChange={(e) => set('damesAutorisees', e.target.checked)} /> Dames autorisées dans l'épreuve messieurs</label>
        )}
        <div className="ligne">
          <label>Rang d'un non classé (messieurs)
            <input type="number" value={t.reglages.rangNCMessieurs} onChange={(e) => set('reglages', { ...t.reglages, rangNCMessieurs: +e.target.value })} />
          </label>
          <label>Rang d'une non classée (dames)
            <input type="number" value={t.reglages.rangNCDames} onChange={(e) => set('reglages', { ...t.reglages, rangNCDames: +e.target.value })} />
          </label>
        </div>
        <p className="aide">Non classé = dernier classé du classement en vigueur + 1 (valeur affichée dans l'application JA Padel).</p>
        <label>Nombre maximum de paires (0 = pas de limite)
          <input type="number" min={0} value={t.reglages.nbMaxPaires} onChange={(e) => set('reglages', { ...t.reglages, nbMaxPaires: +e.target.value })} />
        </label>
      </section>

      <section className="carte">
        <h2>Journées</h2>
        <p className="aide">Durée maximum pour un {t.categorie} : {dureeMaxJours(t.categorie, t.public)} jour(s). Aucun match après minuit.</p>
        {t.journees.map((j, i) => (
          <div className="ligne" key={i}>
            <input type="date" value={j.date} onChange={(e) => set('journees', t.journees.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)))} />
            <input type="time" value={j.debut} onChange={(e) => set('journees', t.journees.map((x, k) => (k === i ? { ...x, debut: e.target.value } : x)))} />
            <span>à</span>
            <input type="time" value={j.fin} onChange={(e) => set('journees', t.journees.map((x, k) => (k === i ? { ...x, fin: e.target.value } : x)))} />
            <button className="lien" onClick={() => set('journees', t.journees.filter((_, k) => k !== i))}>Retirer</button>
          </div>
        ))}
        <button className="secondaire" onClick={() => {
          const der = t.journees[t.journees.length - 1];
          const d = der ? new Date(der.date + 'T12:00') : new Date();
          if (der) d.setDate(d.getDate() + 1);
          set('journees', [...t.journees, { date: d.toISOString().slice(0, 10), debut: '09:00', fin: '20:00' }]);
        }}>+ Ajouter une journée</button>

        <h2>Pauses</h2>
        <p className="aide">Aucun match ne sera programmé pendant une pause (déjeuner, remise des prix…).</p>
        {t.pauses.map((p, i) => (
          <div className="ligne" key={i}>
            <select value={p.date} onChange={(e) => set('pauses', t.pauses.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)))}>
              {t.journees.map((j) => <option key={j.date} value={j.date}>{j.date}</option>)}
            </select>
            <input type="time" value={p.debut} onChange={(e) => set('pauses', t.pauses.map((x, k) => (k === i ? { ...x, debut: e.target.value } : x)))} />
            <span>à</span>
            <input type="time" value={p.fin} onChange={(e) => set('pauses', t.pauses.map((x, k) => (k === i ? { ...x, fin: e.target.value } : x)))} />
            <input placeholder="Libellé" value={p.libelle ?? ''} onChange={(e) => set('pauses', t.pauses.map((x, k) => (k === i ? { ...x, libelle: e.target.value } : x)))} />
            <button className="lien" onClick={() => set('pauses', t.pauses.filter((_, k) => k !== i))}>Retirer</button>
          </div>
        ))}
        <button className="secondaire" disabled={!t.journees.length} onClick={() => set('pauses', [...t.pauses, { date: t.journees[0].date, debut: '12:30', fin: '13:30', libelle: 'Déjeuner' }])}>+ Ajouter une pause</button>
      </section>

      <section className="carte">
        <h2>Terrains</h2>
        <p className="aide">Minimum pour un {t.categorie} : {nbMinTerrains(t.categorie, t.discipline, t.public)} terrain(s) de même nature.</p>
        {t.terrains.map((c, i) => (
          <div className="ligne" key={c.id}>
            <input value={c.nom} onChange={(e) => set('terrains', t.terrains.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)))} />
            <button className="lien" onClick={() => set('terrains', t.terrains.filter((_, k) => k !== i))}>Retirer</button>
          </div>
        ))}
        <button className="secondaire" onClick={() => set('terrains', [...t.terrains, { id: `t${Date.now().toString(36)}`, nom: `Terrain ${t.terrains.length + 1}` }])}>+ Ajouter un terrain</button>
        <p className="aide">Les terrains, le nom de la structure et le visuel de l'écran de diffusion sont repris automatiquement au prochain « Nouveau tournoi ».</p>
      </section>

      <section className="carte">
        <h2>Durée estimée des matchs</h2>
        <p className="aide">Sert au calcul du planning. Le repos minimum après chaque format est imposé par le règlement.</p>
        <table className="tableau-simple">
          <thead><tr><th>Format</th><th>Description</th><th>Durée (min)</th><th>Repos après</th></tr></thead>
          <tbody>
            {FORMATS.map((f) => (
              <tr key={f}>
                <td><b>{f}</b></td>
                <td className="muted">{DEF_FORMATS[f].libelle}</td>
                <td><input type="number" min={5} className="court" value={t.reglages.dureeFormat[f]}
                  onChange={(e) => set('reglages', { ...t.reglages, dureeFormat: { ...t.reglages.dureeFormat, [f]: +e.target.value } })} /></td>
                <td className="muted">{f === 'E' ? '15 min après 3 parties' : `${reposApres(f)} min`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
