// Modèle de données d'un tournoi. Tout est sérialisable en JSON.

export type Sexe = 'H' | 'F';
export type Categorie = 'P25' | 'P50' | 'P100' | 'P250' | 'P500' | 'P1000' | 'P1500' | 'P2000';
export type Discipline = 'DM' | 'DD' | 'DX'; // Messieurs, Dames, Mixte
export type Public = 'SENIORS' | 'PLUS45' | 'PLUS55' | 'JEUNES';
export type FormatCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'D1' | 'D2' | 'E' | 'F';

export interface Joueur {
  nom: string;
  prenom: string;
  licence?: string;
  sexe: Sexe;
  /** Rang au classement FFT (H ou F selon le sexe). null = non classé. */
  classement: number | null;
  club?: string;
}

export interface Paire {
  id: string;
  j1: Joueur;
  j2: Joueur;
  /** Ordre d'inscription (1 = première inscrite). */
  ordreInscription: number;
  forfait?: boolean;
}

export interface Journee {
  date: string; // AAAA-MM-JJ
  debut: string; // HH:mm
  fin: string; // HH:mm (max 24:00)
}

export interface Pause {
  date: string;
  debut: string;
  fin: string;
  libelle?: string;
}

export interface Terrain {
  id: string;
  nom: string;
}

export type FormuleType = 'POULES_TABLEAU' | 'TMC';
export type MethodePoules = 'SERPENTIN' | 'REPARTITION_RANG';

export interface FormatsChoisis {
  poules: FormatCode;
  tableau: FormatCode; // tableau final (hors finale)
  finale: FormatCode;
  classement: FormatCode; // matchs de classement
}

export interface Formule {
  type: FormuleType;
  /** Poules + tableau : nombre de poules. */
  nbPoules: number;
  methodePoules: MethodePoules;
  /** Nombre de paires qualifiées par poule pour le tableau final. */
  qualifiesParPoule: number;
  formats: FormatsChoisis;
}

export interface Reglages {
  /** Rang attribué à un joueur non classé (= dernier classé + 1). */
  rangNCMessieurs: number;
  rangNCDames: number;
  /** Durée estimée d'un match par format, en minutes. */
  dureeFormat: Record<FormatCode, number>;
  /** Nombre maximum de paires (P25 à P250, fixé par le comité). 0 = illimité. */
  nbMaxPaires: number;
}

export type Issue = 'NORMAL' | 'WO' | 'ABANDON' | 'DISQUALIFICATION';

export interface Resultat {
  /** Jeux par set, du point de vue de A puis B, ex. [[6,4],[3,6],[10,8]]. */
  sets: [number, number][];
  vainqueur: 'A' | 'B';
  issue: Issue;
  /** WO posé automatiquement : l'adversaire était déjà sorti (abandon, WO ou disqualification). */
  auto?: boolean;
}

export type Ref =
  | { k: 'paire'; id: string }
  | { k: 'slot'; tableauId: string; idx: number }
  | { k: 'gagnant'; matchId: string }
  | { k: 'perdant'; matchId: string };

export type Phase = 'POULE' | 'TABLEAU' | 'CLASSEMENT';

export interface Match {
  id: string;
  libelle: string;
  phase: Phase;
  /** Poule ou tableau d'appartenance. */
  groupeId: string;
  /** Sous-ensemble d'affichage (ex. « Places 5 à 8 »). */
  bloc?: string;
  /** Priorité de programmation (plus petit = plus tôt). */
  ordre: number;
  a: Ref;
  b: Ref;
  format: FormatCode;
  /** Si ce match attribue des places finales : [place du vainqueur, place du perdant]. */
  places?: [number, number];
  /** Nombre de paires dans le tour (pour le tableau principal : 2 = finale, 4 = 1/2, ...). */
  tailleTour?: number;
  resultat?: Resultat;
  terrainId?: string;
  debut?: string; // AAAA-MM-JJTHH:mm
  verrouille?: boolean;
}

export interface Poule {
  id: string;
  nom: string;
  paires: string[]; // ids, dans l'ordre des positions
  /** Ordre tiré au sort pour départager une égalité parfaite. */
  departage?: string[];
}

export interface Tableau {
  id: string;
  nom: string;
  taille: number; // puissance de 2
  rangDebut: number; // première place attribuée
  /** Contenu des emplacements : id de paire, 'BYE', ou null (pas encore tiré). */
  slots: (string | null)[];
  /** Emplacements structurellement vides (exempts). */
  byes: number[];
  /** Origine des paires : inscrits (TMC) ou rangs de poules. */
  origine: { type: 'INSCRITS' } | { type: 'POULES'; rangs: number[] };
  principal: boolean;
  /** Têtes de série (ids de paires), TS1 en premier. Fixées au tirage. */
  tetesDeSerie?: string[];
}

export interface Tirage {
  date: string;
  libelle: string;
  graine: number;
  details: string[];
}

export interface CouleursAffichage {
  fond: string;
  texte: string;
  accent: string; // titres
  carte: string; // fond des matchs
  gagnant: string;
  traits: string; // lignes de l'arbre
}

export interface Affichage {
  titre: string;
  sousTitre: string;
  /** Logo en data URL (image redimensionnée). */
  logo?: string;
  couleurs: CouleursAffichage;
  rotationSecondes: number;
  pages: { programme: boolean; poules: boolean; tableaux: boolean; classement: boolean };
}

export interface Tournoi {
  version: 1;
  /** Identifiant stable (historique des tournois). */
  id?: string;
  nom: string;
  lieu?: string;
  categorie: Categorie;
  discipline: Discipline;
  public: Public;
  /** Épreuve messieurs ouverte aux dames. */
  damesAutorisees: boolean;
  journees: Journee[];
  pauses: Pause[];
  terrains: Terrain[];
  reglages: Reglages;
  paires: Paire[];
  formule: Formule;
  /** Ordre officiel des paires (ids), du plus fort au plus faible, fixé au tirage. */
  ordrePaires?: string[];
  poules: Poule[];
  tableaux: Tableau[];
  matchs: Match[];
  tirages: Tirage[];
  /** Réglages de l'écran de diffusion. */
  affichage?: Affichage;
}
