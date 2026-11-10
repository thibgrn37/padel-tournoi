// Écran de diffusion (TV / vidéoprojecteur) : pages qui défilent automatiquement.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { arbres, type Arbre as ArbreT } from '../engine/arbres';
import { classementPoule } from '../engine/poules';
import { classementFinal, estExempt, nomPaireId, resoudre } from '../engine/tournoi';
import type { Affichage, Poule, Tournoi } from '../engine/types';
import { Arbre } from './Arbre';
import { heure, dateCourte } from './commun';

export const AFFICHAGE_DEFAUT: Affichage = {
  titre: '',
  sousTitre: '',
  couleurs: { fond: '#0d1b2a', texte: '#f1f5f9', accent: '#ffd23f', carte: '#1b2d45', gagnant: '#5ee0a0', traits: '#3d5a80' },
  rotationSecondes: 15,
  pages: { programme: true, poules: true, tableaux: true, classement: true },
};

export const affichageDe = (t: Tournoi): Affichage => ({
  ...AFFICHAGE_DEFAUT, ...t.affichage,
  couleurs: { ...AFFICHAGE_DEFAUT.couleurs, ...t.affichage?.couleurs },
  pages: { ...AFFICHAGE_DEFAUT.pages, ...t.affichage?.pages },
});

export type Page =
  | { k: 'programme'; titre: string }
  | { k: 'poules'; titre: string; poules: Poule[] }
  | { k: 'arbres'; titre: string; arbres: ArbreT[] }
  | { k: 'classement'; titre: string };

const morceaux = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));

export function construirePages(t: Tournoi, a: Affichage): Page[] {
  const pages: Page[] = [];
  const restants = t.matchs.filter((m) => !m.resultat && m.debut && !estExempt(t, m));
  if (a.pages.programme && restants.length) pages.push({ k: 'programme', titre: 'Prochains matchs' });
  if (a.pages.poules && t.poules.length) {
    const ch = morceaux(t.poules, t.poules.length <= 6 ? 6 : 4);
    ch.forEach((p, i) => pages.push({ k: 'poules', titre: ch.length > 1 ? `Poules (${i + 1}/${ch.length})` : 'Poules', poules: p }));
  }
  if (a.pages.tableaux) {
    const tous = arbres(t);
    for (const tab of t.tableaux) {
      const l = tous.filter((x) => x.racine.match.groupeId === tab.id);
      const grands = l.filter((x) => x.principal || x.profondeur >= 3);
      const petits = l.filter((x) => !grands.includes(x));
      grands.forEach((g) => pages.push({ k: 'arbres', titre: g.titre, arbres: [g] }));
      morceaux(petits, 4).forEach((p) => pages.push({ k: 'arbres', titre: tab.principal ? 'Matchs de classement' : `Classement — places ${tab.rangDebut} et suivantes`, arbres: p }));
    }
  }
  if (a.pages.classement && classementFinal(t).lignes.length) pages.push({ k: 'classement', titre: 'Classement' });
  return pages;
}

/** Met le contenu à l'échelle pour qu'il remplisse l'espace sans déborder. */
function Ajuste({ children, cle }: { children: ReactNode; cle: string }) {
  const cadre = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  useLayoutEffect(() => {
    const calc = () => {
      const c = cadre.current, k = contenu.current;
      if (!c || !k) return;
      const s = Math.min(c.clientWidth / k.scrollWidth, c.clientHeight / k.scrollHeight, 2.2);
      setEchelle(Number.isFinite(s) && s > 0 ? s : 1);
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (cadre.current) ro.observe(cadre.current);
    return () => ro.disconnect();
  }, [cle]);
  return (
    <div ref={cadre} className="d-cadre">
      <div ref={contenu} className="d-contenu" style={{ transform: `scale(${echelle})` }}>{children}</div>
    </div>
  );
}

function ContenuPage({ t, p }: { t: Tournoi; p: Page }) {
  if (p.k === 'programme') {
    const ms = t.matchs.filter((m) => !m.resultat && m.debut && !estExempt(t, m)).sort((x, y) => x.debut!.localeCompare(y.debut!)).slice(0, 12);
    return (
      <table className="d-programme">
        <tbody>
          {ms.map((m) => {
            const a = resoudre(t, m.a), b = resoudre(t, m.b);
            return (
              <tr key={m.id}>
                <td className="d-heure">{heure(m.debut)}<div className="d-petit">{dateCourte(m.debut)}</div></td>
                <td className="d-terrain">{t.terrains.find((x) => x.id === m.terrainId)?.nom}</td>
                <td><div className="d-petit">{m.libelle}</div>{a ? nomPaireId(t, a) : 'à déterminer'} <span className="d-contre">contre</span> {b ? nomPaireId(t, b) : 'à déterminer'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  if (p.k === 'poules') {
    return (
      <div className="d-poules">
        {p.poules.map((po) => (
          <div key={po.id} className="d-poule">
            <h3>{po.nom}</h3>
            <table>
              <thead><tr><th></th><th></th><th>Pts</th><th>Sets</th><th>Jeux</th></tr></thead>
              <tbody>
                {classementPoule(po, t.matchs, po.departage).map((l, i) => (
                  <tr key={l.paireId}>
                    <td className="d-rang">{i + 1}</td>
                    <td>{nomPaireId(t, l.paireId)}</td>
                    <td><b>{l.points}</b></td>
                    <td>{l.setsPour - l.setsContre > 0 ? '+' : ''}{l.setsPour - l.setsContre}</td>
                    <td>{l.jeuxPour - l.jeuxContre > 0 ? '+' : ''}{l.jeuxPour - l.jeuxContre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }
  if (p.k === 'arbres') {
    return (
      <div className={p.arbres.length > 1 ? 'd-arbres-multi' : ''}>
        {p.arbres.map((a) => (
          <div key={a.id} className="d-arbre">
            {p.arbres.length > 1 && <h3>{a.titre}</h3>}
            <Arbre t={t} arbre={a} />
          </div>
        ))}
      </div>
    );
  }
  const { lignes } = classementFinal(t);
  const cols = morceaux(lignes, Math.ceil(lignes.length / (lignes.length > 12 ? 2 : 1)));
  return (
    <div className="d-classement">
      {cols.map((c, i) => (
        <table key={i}><tbody>
          {c.map((l) => <tr key={l.paireId}><td className="d-rang">{l.place}</td><td>{nomPaireId(t, l.paireId)}</td></tr>)}
        </tbody></table>
      ))}
    </div>
  );
}

export function Diffusion({ t, ecran, pageForcee, onFermer }: {
  t: Tournoi; ecran: boolean; pageForcee?: number; onFermer?: () => void;
}) {
  const a = affichageDe(t);
  const pages = construirePages(t, a);
  const [i, setI] = useState(0);
  const idx = pageForcee ?? (pages.length ? i % pages.length : 0);
  useEffect(() => {
    if (!ecran || pages.length < 2) return;
    const id = setInterval(() => setI((x) => x + 1), Math.max(3, a.rotationSecondes) * 1000);
    return () => clearInterval(id);
  }, [ecran, pages.length, a.rotationSecondes]);
  useEffect(() => {
    if (!ecran) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => x + 1);
      if (e.key === 'ArrowLeft') setI((x) => x - 1 + pages.length);
      if (e.key === 'Escape') onFermer?.();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [ecran, pages.length, onFermer]);
  const c = a.couleurs;
  const style = {
    '--d-fond': c.fond, '--d-texte': c.texte, '--d-accent': c.accent, '--d-carte': c.carte, '--d-gagnant': c.gagnant, '--d-traits': c.traits,
  } as React.CSSProperties;
  const p = pages[idx];
  return (
    <div className={`diffusion ${ecran ? 'd-ecran' : 'd-apercu'}`} style={style}>
      <div className="d-entete">
        {a.logo && <img src={a.logo} alt="" className="d-logo" />}
        <div className="d-titres">
          <div className="d-titre">{a.titre || t.nom}</div>
          {(a.sousTitre || t.lieu) && <div className="d-sous-titre">{a.sousTitre || t.lieu}</div>}
        </div>
        <div className="d-page-titre">{p?.titre}</div>
      </div>
      <div className="d-corps">
        {p ? <Ajuste cle={`${idx}-${p.titre}`}><ContenuPage t={t} p={p} /></Ajuste> : <div className="d-vide">Rien à afficher pour l'instant.</div>}
      </div>
      {pages.length > 1 && (
        <div className="d-points">{pages.map((_, k) => <span key={k} className={k === idx ? 'actif' : ''} />)}</div>
      )}
    </div>
  );
}
