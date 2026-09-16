# Annuaire des sites publics

Site statique qui liste et catégorise les sites `.gouv.fr` et une sélection de services publics nationaux, avec recherche et filtres par catégorie.

Site personnel non officiel, sans lien avec l'État.

## Données

- **Sites .gouv.fr** : extraits de la [liste des noms de domaine des organismes publics](https://github.com/etalab/noms-de-domaine-organismes-secteur-public) (DINUM).
  Les sous-domaines techniques (staging, api, mail...) sont exclus, chaque site est vérifié en ligne (HTTP 200, page HTML avec un vrai titre) puis catégorisé par mots-clés.
- **Autres services publics** : liste blanche maintenue à la main dans `data/public-sites.json`.
- `data/overrides.json` : domaines à exclure (`exclude`) et catégories forcées (`categories`).
- `data/sites.json` : fichier généré, lu par le front.

La génération échoue sans rien écrire si le nombre de sites `.gouv.fr` baisse de plus de 20 % par rapport au fichier existant.

## Commandes

Node.js 20 ou plus, aucune dépendance.

```bash
npm test                 # tests unitaires
npm run test:coverage    # tests avec couverture
npm run build-data       # regenere data/sites.json (plusieurs minutes)
npm run serve            # http://localhost:8080
```

## Déploiement

Le workflow `.github/workflows/update-and-deploy.yml` :

- lance les tests à chaque push et pull request ;
- régénère les données chaque lundi (ou à la demande) et commite `data/sites.json` s'il a changé ;
- déploie sur GitHub Pages depuis `main`.

À configurer une fois dans le dépôt : **Settings > Pages > Source : GitHub Actions**.
