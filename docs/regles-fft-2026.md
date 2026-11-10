# Règles FFT 2026 appliquées par l'application

Source : *Guide de la compétition Padel 2026* (FFT, publication juillet 2025), chapitres I à III.
Le code correspondant est dans `src/engine/regles.ts` (règles), `poules.ts`, `tableau.ts`, `planning.ts` et `controles.ts`.

## Inscrits et poids des paires (chapitre II)
- Poids d'une paire = somme des classements des deux joueurs. Plus le poids est faible, plus la paire est forte.
- Non classé = dernier classé + 1 (valeur à saisir dans l'onglet Tournoi, donnée par l'application JA Padel).
- Joueuse en épreuve messieurs : équivalence (1-10 : +400, 11-30 : +1 000, 31-60 : +2 000, 61-100 : +3 500, 101-200 : +10 000, 201-500 : +15 000, 501-1 000 : +25 000, 1 001-2 000 : +35 000, 2 001-3 000 : +45 000, 3 001-5 000 : +55 000, 5 001-10 000 : +70 000, au-delà : +90 000). Non classée = non classé messieurs.
- Épreuve mixte : somme des classements respectifs, sans équivalence.
- Égalité de poids : tirage au sort (enregistré dans le journal).
- Cuts (P25 / P100 / P250) : messieurs TOP 20 000 / 2 000 / 500 ; dames TOP 1 000 / 300 / 100 ; +45/+55 messieurs TOP 30 000 / 3 000 / 750, dames TOP 3 000 / 300 / 100 ; pas de limite en mixte ni en jeunes.
- P50 (règles données par l'organisateur) : 50 points par joueur de la paire gagnante, licence FFT dès 11 ans, interdit au TOP 10 000 en messieurs / mixte (hommes) et au TOP 1 000 en dames / mixte (femmes). Formats autorisés, nombre minimum de paires, terrains et durée : repris du P25 en attendant confirmation.
- Sélection : ordre d'inscription jusqu'au P250, poids de paire à partir du P500.
- Minimum de paires : moins de 4 = non homologuée ; sous le minimum du cahier des charges = rétrogradation (alerte).

## Formules et formats (chapitre I et III)
- Formats A1 à F, contrôle des scores saisis selon le format.
- Formats autorisés selon la catégorie et la phase (poules, tableau, finale, matchs de classement), y compris les tours du tableau pour P500 à P2000.
- 3 matchs minimum par paire (5 si formats E ou F) et classement distinct pour chaque paire : l'app calcule le minimum garanti pour la formule choisie et bloque si ce n'est pas respecté.
- P250 messieurs / mixtes : tableau final d'au moins une 1/2 finale.

## Poules
- 2 têtes de série par poule ; constitution par serpentin ou par répartition par rang (tirage au sort dans chaque rang).
- Classement : 2 pts victoire, 1 pt défaite, -1 disqualification, -2 WO ; puis différence de sets, de jeux, mêmes critères sur les seuls matchs entre paires à égalité, puis tirage au sort.

## Tableaux
- TS 1 en bas, TS 2 en haut, puis tirage par chapeaux 3-4, 5-8, 9-16…
- Exempts placés face aux meilleures têtes de série.
- Chaque tour sépare vainqueurs et perdants (matchs de classement pour toutes les places).

## Planning
- Repos minimum : 1 h 30 après A, 1 h après B, 30 min après C/D, 15 min après F ; 12 h entre deux journées ; aucun match après minuit.
- Nombre de matchs par jour et par paire contrôlé selon les formats.
- Pauses et horaires des journées respectés ; matchs joués ou verrouillés jamais déplacés.

## Choix d'interprétation à valider
1. **Tableau final après poules** : les qualifiés sont ordonnés par rang de poule (tous les 1ers puis tous les 2es), puis par poids. Deux paires de la même poule ne se rencontrent pas au 1er tour.
2. **Paires non qualifiées** : elles sont toutes regroupées dans un tableau de classement (places Q+1 et suivantes), joué en multi-chances.
3. **Super jeu décisif** : compte comme un set et comme un jeu (1-0) dans les départages de poule.
4. **Cut d'une joueuse en épreuve messieurs** : contrôlé sur son classement d'équivalence messieurs.
5. **Format E** : la règle des 15 min après 3 parties consécutives n'est pas encore appliquée par le planning.
6. **TMC** : avec un nombre de paires qui n'est pas une puissance de 2, certaines tailles ne garantissent pas 3 matchs ; l'app le signale et propose les poules.

## Pas encore géré
Qualifications + tableau final avec entrées échelonnées (P500 et plus), wild cards, lucky losers, prize money, barèmes de points, championnats par paires / par équipes.
