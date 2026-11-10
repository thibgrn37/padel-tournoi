import { describe, expect, it } from 'vitest';
import {
  classementRetenu, controleMatchsParJour, controleScore, equivalenceDameEnMessieurs, formatsAutorises, interdictionTop, poidsPaire,
} from './regles';
import { chapeaux, creerTableau, genererMatchsTableau, positionsTetesDeSerie, tirerTableau } from './tableau';
import { classementPoule, constituerPoules, genererMatchsPoule, rencontresPoule, taillesPoules } from './poules';
import { creerRng, Journal } from './tirage';
import {
  classementFinal, genererFormule, matchsMinimumGarantis, nouveauTournoi, propagerSorties, resoudre, saisirResultat, tableauxATirer, tirerTableauxApresPoules,
} from './tournoi';
import { controlesPlanning, debutEnMinutes, planifier } from './planning';
import { controlesFormule, controlesInscrits } from './controles';
import type { Match, Paire, Tournoi } from './types';

const ctxDM = { discipline: 'DM' as const, rangNCMessieurs: 100000, rangNCDames: 9000 };

describe('poids des paires (Chapitre II)', () => {
  it('additionne les deux classements', () => {
    expect(poidsPaire({ j1: { sexe: 'H', classement: 120 }, j2: { sexe: 'H', classement: 300 } }, ctxDM)).toBe(420);
  });
  it('non classé = dernier classé + 1', () => {
    expect(classementRetenu({ sexe: 'H', classement: null }, ctxDM)).toBe(100000);
  });
  it("équivalence d'une joueuse en épreuve messieurs (23e → 1 023)", () => {
    expect(equivalenceDameEnMessieurs(23)).toBe(1023);
    expect(equivalenceDameEnMessieurs(10)).toBe(410);
    expect(equivalenceDameEnMessieurs(12000)).toBe(102000);
    expect(classementRetenu({ sexe: 'F', classement: 23 }, ctxDM)).toBe(1023);
    expect(classementRetenu({ sexe: 'F', classement: null }, ctxDM)).toBe(100000);
  });
  it('mixte : somme des classements respectifs', () => {
    expect(poidsPaire({ j1: { sexe: 'H', classement: 500 }, j2: { sexe: 'F', classement: 50 } }, { ...ctxDM, discipline: 'DX' })).toBe(550);
  });
});

describe('cuts et formats (Chapitre III)', () => {
  it('interdictions de classement', () => {
    expect(interdictionTop('P25', 'DM', 'SENIORS', 'H')).toBe(20000);
    expect(interdictionTop('P100', 'DD', 'SENIORS', 'F')).toBe(300);
    expect(interdictionTop('P250', 'DM', 'PLUS45', 'H')).toBe(750);
    expect(interdictionTop('P250', 'DX', 'SENIORS', 'H')).toBeNull();
    expect(interdictionTop('P500', 'DM', 'SENIORS', 'H')).toBeNull();
  });
  it('formats autorisés', () => {
    expect(formatsAutorises('P25', 'SENIORS', 'TABLEAU')).toEqual(['C1', 'C2', 'D1', 'D2', 'E', 'F']);
    expect(formatsAutorises('P100', 'SENIORS', 'TABLEAU')).not.toContain('E');
    expect(formatsAutorises('P250', 'SENIORS', 'FINALE')).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(formatsAutorises('P1000', 'SENIORS', 'TABLEAU', 8)).toEqual(['A1', 'A2']);
    expect(formatsAutorises('P1000', 'SENIORS', 'TABLEAU', 32)).toContain('B2');
    expect(formatsAutorises('P2000', 'SENIORS', 'CLASSEMENT')).toEqual(['B1']);
    expect(formatsAutorises('P100', 'JEUNES', 'TABLEAU')).toEqual(['A2', 'B2', 'C2', 'D2']);
  });
  it('matchs par jour', () => {
    expect(controleMatchsParJour(['A1', 'A1', 'A1'])).toHaveLength(1);
    expect(controleMatchsParJour(['B1', 'B1', 'C1', 'C1', 'C1'])).toHaveLength(0);
    expect(controleMatchsParJour(['B1', 'C1', 'C1', 'C1', 'C1', 'C1'])).toHaveLength(1);
  });
});

describe('scores', () => {
  it('valide les scores selon le format', () => {
    expect(controleScore('B2', [[6, 4], [3, 6], [10, 8]])).toBeNull();
    expect(controleScore('B2', [[6, 4], [7, 6]])).toBeNull();
    expect(controleScore('B2', [[6, 5], [6, 4]])).not.toBeNull();
    expect(controleScore('C2', [[4, 2], [5, 4]])).toBeNull();
    expect(controleScore('C2', [[4, 3], [4, 1]])).not.toBeNull();
    expect(controleScore('D1', [[9, 8]])).toBeNull();
    expect(controleScore('D1', [[9, 7]])).toBeNull();
    expect(controleScore('D1', [[10, 8]])).not.toBeNull();
    expect(controleScore('F', [[4, 3]])).toBeNull();
    expect(controleScore('E', [[12, 10]])).toBeNull();
    expect(controleScore('E', [[10, 9]])).not.toBeNull();
    expect(controleScore('A1', [[6, 4], [6, 4], [6, 4]])).not.toBeNull();
  });
});

describe('tableaux', () => {
  it('TS1 en bas, TS2 en haut', () => {
    const pos = positionsTetesDeSerie(8);
    expect(pos[0]).toBe(7);
    expect(pos[1]).toBe(0);
    // TS3 et TS4 dans des quarts différents de TS1/TS2
    expect(new Set([pos[0], pos[1], pos[2], pos[3]].map((p) => Math.floor(p / 2))).size).toBe(4);
  });
  it('chapeaux', () => {
    expect(chapeaux(16)).toEqual([[1], [2], [3, 4], [5, 6, 7, 8], [9, 10, 11, 12, 13, 14, 15, 16]]);
    expect(chapeaux(4)).toEqual([[1], [2], [3, 4]]);
  });
  it('TMC 8 : 12 matchs, chaque place attribuée une fois', () => {
    const t = creerTableau('tf', 'T', 8, 1, { type: 'INSCRITS' }, true);
    const ms = genererMatchsTableau(t, { poules: 'C2', tableau: 'C2', finale: 'C2', classement: 'C2' }, 0);
    expect(ms).toHaveLength(12);
    expect(ms.filter((m) => m.places).flatMap((m) => m.places!).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('exempts face aux meilleures têtes de série', () => {
    const t = creerTableau('tf', 'T', 6, 1, { type: 'INSCRITS' }, true);
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const r = tirerTableau(t, ids, creerRng(1), new Journal('x', 1), (x) => x);
    const pos = positionsTetesDeSerie(8);
    const adversaire = (i: number) => r.slots[i % 2 ? i - 1 : i + 1];
    expect(adversaire(pos[0])).toBe('BYE');
    expect(adversaire(pos[1])).toBe('BYE');
    expect(r.slots.filter((s) => s && s !== 'BYE').sort()).toEqual(ids);
  });
});

describe('poules', () => {
  it('tailles et serpentin', () => {
    expect(taillesPoules(10, 3)).toEqual([4, 3, 3]);
    const ordre = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);
    const p = constituerPoules(ordre, 4, 'SERPENTIN', creerRng(1), new Journal('x', 1), (x) => x);
    expect(p[0].paires).toEqual(['p1', 'p8', 'p9', 'p16']);
    expect(p[3].paires).toEqual(['p4', 'p5', 'p12', 'p13']);
  });
  it('répartition par rang : chaque poule reçoit une paire de chaque rang', () => {
    const ordre = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const p = constituerPoules(ordre, 4, 'REPARTITION_RANG', creerRng(7), new Journal('x', 1), (x) => x);
    for (const poule of p) {
      expect(poule.paires).toHaveLength(3);
      poule.paires.forEach((id, rang) => {
        const n = Number(id.slice(1));
        expect(Math.ceil(n / 4)).toBe(rang + 1);
      });
    }
  });
  it('round robin complet', () => {
    for (const n of [3, 4, 5, 6]) expect(rencontresPoule(n).flat()).toHaveLength((n * (n - 1)) / 2);
  });
  it('classement : points puis sets puis jeux puis confrontations', () => {
    const p = { id: 'P', nom: 'P', paires: ['a', 'b', 'c'] };
    const ms = genererMatchsPoule(p, 'C2', 0);
    const set = (a: string, b: string, sets: [number, number][], v: 'A' | 'B'): void => {
      const m = ms.find((x) => (x.a as any).id === a && (x.b as any).id === b)!;
      m.resultat = { sets, vainqueur: v, issue: 'NORMAL' };
    };
    // a bat b, b bat c, c bat a -> 3 paires à 4 points, départage aux sets puis aux jeux
    set('a', 'b', [[4, 0], [4, 0]], 'A');
    set('b', 'c', [[4, 1], [4, 1]], 'A');
    set('a', 'c', [[2, 4], [2, 4]], 'B');
    const cl = classementPoule(p, ms);
    expect(cl.map((l) => l.points)).toEqual([3, 3, 3]);
    // a : +4 jeux ; b et c : -2 jeux, b a battu c
    expect(cl.map((l) => l.paireId)).toEqual(['a', 'b', 'c']);
  });
  it('WO : -2 points', () => {
    const p = { id: 'P', nom: 'P', paires: ['a', 'b', 'c'] };
    const ms = genererMatchsPoule(p, 'C2', 0);
    ms[0].resultat = { sets: [[4, 0], [4, 0]], vainqueur: 'A', issue: 'WO' };
    const cl = classementPoule(p, ms);
    expect(cl.find((l) => l.paireId === (ms[0].b as any).id)!.points).toBe(-2);
  });
});

// --- Simulation d'un tournoi complet ---
function tournoiTest(n: number, type: 'TMC' | 'POULES_TABLEAU', nbPoules = 4): Tournoi {
  const t = nouveauTournoi();
  t.categorie = 'P100';
  t.journees = [{ date: '2026-12-05', debut: '08:00', fin: '23:00' }, { date: '2026-12-06', debut: '09:00', fin: '20:00' }];
  t.terrains = [1, 2, 3, 4].map((i) => ({ id: `t${i}`, nom: `Terrain ${i}` }));
  t.pauses = [{ date: '2026-12-05', debut: '12:30', fin: '13:30' }];
  t.paires = Array.from({ length: n }, (_, i): Paire => ({
    id: `p${i + 1}`,
    j1: { nom: `A${i + 1}`, prenom: '', sexe: 'H', classement: 3000 + i * 100 },
    j2: { nom: `B${i + 1}`, prenom: '', sexe: 'H', classement: 3000 + i * 100 },
    ordreInscription: i + 1,
  }));
  t.formule = { ...t.formule, type, nbPoules, qualifiesParPoule: 2, formats: { poules: 'C2', tableau: 'B2', finale: 'B2', classement: 'C2' } };
  return t;
}

/** Joue tous les matchs prêts : la paire la plus forte (plus petit numéro) gagne. */
function jouer(t: Tournoi): Tournoi {
  for (let k = 0; k < 50; k++) {
    t = propagerSorties(t);
    if (tableauxATirer(t).length) t = tirerTableauxApresPoules(t, 42);
    const pret = t.matchs.find((m) => !m.resultat && (() => {
      const a = resoudre(t, m.a), b = resoudre(t, m.b);
      return a && b && a !== 'BYE' && b !== 'BYE';
    })());
    if (!pret) {
      if (!tableauxATirer(t).length) break;
      continue;
    }
    const a = resoudre(t, pret.a)!, b = resoudre(t, pret.b)!;
    const v = Number(a.slice(1)) < Number(b.slice(1)) ? 'A' : 'B';
    const sets: [number, number][] = pret.format.startsWith('C') ? [[4, 1], [4, 1]] : [[6, 1], [6, 1]];
    t = saisirResultat(t, pret.id, { sets: v === 'A' ? sets : sets.map(([x, y]) => [y, x] as [number, number]), vainqueur: v, issue: 'NORMAL' });
    k = 0;
  }
  return t;
}

describe('tournoi complet', () => {
  it('TMC : tailles qui garantissent 3 matchs', () => {
    const ok = [];
    for (let n = 4; n <= 32; n++) if (matchsMinimumGarantis(genererFormule(tournoiTest(n, 'TMC'), 1)) >= 3) ok.push(n);
    console.log('TMC possibles :', ok.join(', '));
    expect(ok).toContain(8);
  });
  it('TMC 13 paires : moins de 3 matchs garantis, signalé par les contrôles', () => {
    const t = genererFormule(tournoiTest(13, 'TMC'), 123);
    expect(matchsMinimumGarantis(t)).toBeLessThan(3);
    expect(controlesFormule(t).some((p) => p.message.includes('3 matchs minimum'))).toBe(true);
  });
  it('TMC 16 paires : classement final 1 à 16', () => {
    let t = genererFormule(tournoiTest(16, 'TMC'), 123);
    expect(matchsMinimumGarantis(t)).toBeGreaterThanOrEqual(3);
    t = jouer(t);
    const cf = classementFinal(t);
    expect(cf.complet).toBe(true);
    expect(cf.lignes.map((l) => l.place)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(cf.lignes[0].paireId).toBe('p1');
  });
  it('abandon : la paire sort, ses matchs suivants sont gagnés par WO par l\'adversaire', () => {
    let t = genererFormule(tournoiTest(16, 'TMC'), 123);
    const m1 = t.matchs.find((m) => resoudre(t, m.a) === 'p16' || resoudre(t, m.b) === 'p16')!;
    const v = resoudre(t, m1.a) === 'p16' ? 'B' : 'A';
    t = propagerSorties(saisirResultat(t, m1.id, { sets: [[6, 2], [1, 0]].map(([x, y]) => (v === 'A' ? [x, y] : [y, x])) as [number, number][], vainqueur: v, issue: 'ABANDON' }));
    t = jouer(t);
    const deP16 = t.matchs.filter((m) => m.id !== m1.id && (resoudre(t, m.a) === 'p16' || resoudre(t, m.b) === 'p16'));
    expect(deP16.length).toBe(3); // 4 matchs en TMC 16 : les 3 derniers ne sont pas joués
    expect(deP16.every((m) => m.resultat?.auto && !m.debut)).toBe(true);
    expect(t.matchs.filter((m) => m.resultat?.auto).length).toBe(3);
    const cf = classementFinal(t);
    expect(cf.complet).toBe(true);
    expect(cf.lignes.at(-1)!.paireId).toBe('p16');
    // annuler l'abandon remet les matchs suivants à jouer
    const t2 = propagerSorties(saisirResultat(t, m1.id, undefined));
    expect(t2.matchs.some((m) => m.resultat?.auto)).toBe(false);
  });
  it('poules + tableau final, 14 paires en 4 poules', () => {
    let t = genererFormule(tournoiTest(14, 'POULES_TABLEAU', 4), 5);
    expect(t.poules.map((p) => p.paires.length)).toEqual([4, 4, 3, 3]);
    expect(matchsMinimumGarantis(t)).toBeGreaterThanOrEqual(3);
    expect(controlesFormule(t).filter((p) => p.niveau === 'erreur')).toEqual([]);
    const plan = planifier(t);
    expect(plan.nonPlanifies).toEqual([]);
    t = plan.tournoi;
    expect(controlesPlanning(t).filter((p) => p.niveau === 'erreur')).toEqual([]);
    // aucun match pendant la pause
    for (const m of t.matchs.filter((x) => x.debut)) {
      const s = debutEnMinutes(m.debut!);
      const pauseDebut = debutEnMinutes('2026-12-05T12:30'), pauseFin = debutEnMinutes('2026-12-05T13:30');
      expect(s < pauseFin && s + t.reglages.dureeFormat[m.format] > pauseDebut).toBe(false);
    }
    t = jouer(t);
    const cf = classementFinal(t);
    expect(cf.complet).toBe(true);
    expect(cf.lignes).toHaveLength(14);
    expect(new Set(cf.lignes.map((l) => l.paireId)).size).toBe(14);
    expect(cf.lignes[0].paireId).toBe('p1');
    // 1er tour du tableau final : jamais deux paires de la même poule
    const tf = t.tableaux.find((x) => x.id === 'tf')!;
    const pouleDe = (id: string) => t.poules.find((p) => p.paires.includes(id))!.id;
    for (let i = 0; i < tf.taille; i += 2) {
      const [a, b] = [tf.slots[i], tf.slots[i + 1]];
      if (a && b && a !== 'BYE' && b !== 'BYE') expect(pouleDe(a)).not.toBe(pouleDe(b));
    }
  });
  it('repos respecté entre deux matchs d\'une même paire en poule', () => {
    const t = planifier(genererFormule(tournoiTest(12, 'POULES_TABLEAU', 3), 9)).tournoi;
    const poule: Match[] = t.matchs.filter((m) => m.phase === 'POULE');
    for (const id of t.poules[0].paires) {
      const ms = poule.filter((m) => [m.a, m.b].some((r) => r.k === 'paire' && r.id === id))
        .map((m) => debutEnMinutes(m.debut!)).sort((a, b) => a - b);
      for (let i = 1; i < ms.length; i++) expect(ms[i] - ms[i - 1]).toBeGreaterThanOrEqual(t.reglages.dureeFormat.C2 + 30);
    }
  });
  it('contrôles des inscrits : cut P100', () => {
    const t = tournoiTest(8, 'TMC');
    t.paires[0].j1.classement = 1500;
    expect(controlesInscrits(t).some((p) => p.message.includes('TOP 2'))).toBe(true);
  });
});

describe('estimation du temps', () => {
  it('signale quand ça ne tient pas et propose des pistes qui tiennent', async () => {
    const { estimer, suggestions } = await import('./estimation');
    const t = tournoiTest(16, 'POULES_TABLEAU', 4);
    t.terrains = t.terrains.slice(0, 2);
    t.journees = [{ date: '2026-12-05', debut: '09:00', fin: '20:00' }];
    const t0 = performance.now();
    const e = estimer(t);
    expect(e.tient).toBe(false);
    const s = suggestions(t);
    console.log(`estimation + ${s.length} pistes en ${Math.round(performance.now() - t0)} ms :`, s.map((x) => x.libelle).join(' | '));
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.estimation.tient)).toBe(true);
  });
  it('tient sur 2 jours avec 4 terrains', async () => {
    const { estimer } = await import('./estimation');
    const e = estimer(tournoiTest(16, 'POULES_TABLEAU', 4));
    expect(e.tient).toBe(true);
    expect(e.fin).toBeDefined();
  });
  it('P50 : cut TOP 10 000 messieurs', () => {
    expect(interdictionTop('P50', 'DM', 'SENIORS', 'H')).toBe(10000);
    expect(interdictionTop('P50', 'DX', 'SENIORS', 'F')).toBe(1000);
    expect(interdictionTop('P50', 'DM', 'SENIORS', 'F')).toBe(10000);
  });
});

describe('arbres', () => {
  it('TMC 16 : un arbre par bloc de places, chaque match dans un seul arbre', async () => {
    const { arbres } = await import('./arbres');
    const t = genererFormule(tournoiTest(16, 'TMC'), 3);
    const l = arbres(t);
    expect(l[0].principal).toBe(true);
    expect(l[0].profondeur).toBe(4);
    const compte = (n: any): number => (n ? 1 + compte(n.enfants[0]) + compte(n.enfants[1]) : 0);
    expect(l.reduce((s, a) => s + compte(a.racine), 0)).toBe(t.matchs.length);
  });
});
