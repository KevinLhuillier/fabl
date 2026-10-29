# Fiche Google Play

Textes et images de la fiche Play Store de Taleway, une langue par dossier de `listing/`.

| Fichier                         | Champ de la Play Console                    |
| ------------------------------- | ------------------------------------------- |
| `listing/<langue>/short.txt`    | Brève description (80 caractères max)       |
| `listing/<langue>/full.txt`     | Description complète (4 000 caractères max) |
| `listing/<langue>/feature.json` | Textes de l'image de présentation           |

Pas de fiche en anglais : l'interface de l'appli n'existe pas en anglais.

Les images sont générées dans `out/` (non versionné) :

```bash
npm run store-graphics                 # out/icon-512.png + out/<langue>/feature-graphic.png
npm run store-screenshots -- --login   # une fois : se connecter dans la fenêtre Chrome, puis la fermer
npm run store-screenshots              # out/<langue>/1-translate.png … 5-review.png (1080 × 1920)
npm run store-screenshots -- de it     # seulement certaines langues
```

## Captures d'écran

Elles sont prises dans la version web de l'appli, à servir avant de lancer le script :

```bash
cd apps/mobile && npx expo start --web --no-dev
```

- Le compte connecté doit être **Premium** (sinon les chapitres Premium sont verrouillés) et avoir
  « Max Level » en cours de lecture, sur une page qui contient le mot « squashed », ainsi que des mots
  à réviser. Ces valeurs sont en tête de `src/screenshots.mjs`.
- La langue est changée depuis le Profil, donc enregistrée sur le compte ; elle est remise en
  français à la fin (`--final=es` pour une autre).
- Toucher le mot l'ajoute à « Mes mots » du compte.
- La session Chrome est gardée dans `out/.chrome-profile` : `--login` n'est à refaire que si elle expire.

## Ajouter une langue

1. Ajouter la langue dans l'appli (`apps/mobile/src/i18n`).
2. Créer `listing/<code>/` avec `short.txt`, `full.txt` et `feature.json` (traduire ceux de `fr`).
3. `npm run store-graphics -- <code>` puis `npm run store-screenshots -- <code>`.
