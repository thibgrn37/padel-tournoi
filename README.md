# Padel Tournoi

Application Mac pour gérer un tournoi de padel selon le règlement FFT 2026 :
inscrits et poids des paires, formule (poules + tableau final ou TMC), tirages au sort,
planning des terrains, saisie des résultats, matchs de classement et classement final.

## Installer l'application
1. Ouvrir l'onglet **Releases** du dépôt GitHub et télécharger le fichier `.dmg` le plus récent.
2. Ouvrir le `.dmg` et glisser **Padel Tournoi** dans **Applications**.
3. Premier lancement : l'app n'est pas signée par Apple. Faire **clic droit → Ouvrir**, puis confirmer.
   Si macOS refuse encore : Réglages Système → Confidentialité et sécurité → « Ouvrir quand même ».

Ensuite, l'application **se met à jour toute seule** : au démarrage (puis toutes les heures), elle vérifie
si une nouvelle version est publiée et propose « Mettre à jour maintenant ». Le numéro de version est affiché
en haut à droite ; cliquer dessus lance une vérification.

Chaque modification poussée sur `main` reconstruit l'application (GitHub Actions) et publie une nouvelle version
`0.2.<numéro de build>`. Les mises à jour sont signées avec la clé stockée dans le secret GitHub
`TAURI_SIGNING_PRIVATE_KEY` (la clé publique est dans `src-tauri/tauri.conf.json`).

## Utilisation
1. **Tournoi** : catégorie (P25, P50…P2000), épreuve, journées, pauses, terrains, durée des matchs.
2. **Inscrits** : saisie à la main ou import Excel/CSV (tu choisis les colonnes).
3. **Formule & tirage** : formules possibles calculées pour ton nombre de paires, formats autorisés, tirage au sort enregistré. Le bloc **Temps disponible** indique si tout tient dans les journées prévues et propose des pistes (formats, terrains, horaires, pauses, formule) à appliquer d'un clic.
4. **Poules & tableaux** : classements des poules, tableaux en arbre, tirage des tableaux à la fin des poules.
5. **Planning** : calcul automatique (repos, pauses, 12 h entre journées), modification à la main.
6. **Résultats** : saisie des scores (ex. `6-4 3-6 10-8`), WO, abandons.
7. **Classement** : classement final, export CSV.
8. **Visualisation** : affichage sur TV ou vidéoprojecteur (programme, poules, arbres, classement) qui défile toutes les X secondes ; logo, titre et couleurs personnalisables. « Diffuser sur un écran » ouvre une fenêtre à glisser sur l'écran, double-clic pour le plein écran.

Le tournoi est sauvegardé automatiquement. **Enregistrer…** crée un fichier `.padel.json` (sauvegarde ou transfert vers un autre ordinateur).

Les règles appliquées et les choix d'interprétation sont décrits dans [docs/regles-fft-2026.md](docs/regles-fft-2026.md).

## Développement
```bash
npm install
npm test            # tests du moteur de règles
npm run dev         # interface dans le navigateur (http://localhost:1420)
npm run tauri dev   # application de bureau
npm run tauri build # construire l'application
```
