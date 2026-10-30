# Pub vidéo Taleway

Vidéos publicitaires de l'appli (YouTube / Google Ads, public francophone), filmées dans la
version web de l'appli puis montées avec Remotion.

| Sortie (`out/`)                    | Format                                   |
| ---------------------------------- | ---------------------------------------- |
| `taleway-pub-<n>s-1920x1080.mp4`   | paysage, 60 i/s, H.264 + AAC, -14 LUFS   |
| `taleway-pub-<n>s-1080x1920.mp4`   | vertical (Shorts), gros sous-titres      |

## Refaire la pub de bout en bout

```bash
# 1. L'appli web SANS le mode dev (sinon un toast d'erreur rouge « BackHandler… » est filmé)
cd apps/mobile && npx expo start --web --no-dev --port 8082

# 2. Une fois : se connecter avec le compte de démo (crée auth-state.json, non versionné)
cd pub-taleway && node explore.mjs          # se connecte, parcourt l'appli, captures dans explore/

# 3. Filmer les scènes (toutes, ou seulement certaines)
node record.mjs                             # library reader listen review
node record.mjs reader                      # une seule
DEBUG=1 SKIP_TF=1 node record.mjs review    # journal des exercices ; ne refilme pas le Vrai/Faux

# 4. Sons : accroche ElevenLabs, narration de la page, musique, tick
node audio.mjs                              # hook.mp3 n'est généré qu'une fois (--no-tts pour l'éviter)

# 5. Copier les clips pour Remotion, rendre, normaliser le volume
cp clips/*.mp4 clips/*.json public/clips/
npx remotion render src/index.ts TalewayAd out/taleway-pub-50s-1920x1080.mp4 --codec=h264 --audio-codec=aac --crf=16
npx remotion render src/index.ts TalewayAdVertical out/taleway-pub-38s-1080x1920.mp4 --codec=h264 --audio-codec=aac --crf=16
node loudnorm.mjs out/*.mp4                 # -14 LUFS (le rendu brut sort vers -24 LUFS)
```

Aperçu interactif du montage : `npx remotion studio src/index.ts`.

## Fichiers

| Fichier            | Rôle                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `explore.mjs`      | Étape de repérage : connexion, captures d'écran et textes de chaque écran (`explore/`) |
| `record.mjs`       | Tournage : un clip par scène dans `clips/` + `clips/<clip>.json` (taps, début audio)   |
| `audio.mjs`        | `public/hook.mp3`, `narration.mp3`, `music.wav`, `tick.wav`                            |
| `src/Ad.tsx`       | Montage : plans, textes, timing, sons. Paysage (`LANDSCAPE`) et vertical (`VERTICAL`)  |
| `loudnorm.mjs`     | Normalisation du volume en deux passes, sans réencoder la vidéo                        |
| `check/`           | Planches de contrôle (non versionné)                                                   |

## Tournage (`record.mjs`)

- Viewport 390×844, deviceScaleFactor 3, Chrome installé (`channel: 'chrome'`), locale fr-FR.
- **Capture** : CDP `Page.startScreencast` (JPEG), pas l'enregistrement vidéo de Playwright
  (flou et 25 i/s). Les images ont l'horodatage réel ; ffmpeg les assemble à 60 i/s constants.
  On mesure ~59 images distinctes par seconde pendant un défilement.
- **Main blanche** et **défilements** animés DANS la page (`window.__hand`, requestAnimationFrame) :
  piloter la souris pas à pas depuis Playwright ne donne que ~30 mouvements/s et des gestes
  2× plus lents que prévu. Les taps restent de vrais clics souris (`page.mouse`) : sur le web,
  les boutons React Native ignorent les clics synthétiques.
- Cercle violet à chaque `pointerdown` ; l'instant est noté dans le JSON du clip → « tick » au montage.
- **Synchro narration** : `HTMLMediaElement.play` est espionné ; l'instant réel de `playing` est
  écrit dans le JSON (`audio[0].t`). Le montage cale `narration.mp3` dessus : le surlignage
  colle à la voix (vérifié à moins d'un mot près avec `content/alignments/`).
- Marge de 1,5 à 2 s au début et à la fin de chaque clip ; le montage choisit le point de départ.

## Pièges de l'appli rencontrés

- **Visite guidée** (« Passer / Suivant ») sur l'accueil et la page d'une histoire : `skipTour()`
  la passe après chaque navigation.
- **Couvertures** chargées au défilement : précharger (défiler en bas puis remonter) avant de filmer.
- **Carte « Continuer la lecture »** chargée après l'accueil : attendre ~5 s avant de filmer.
- **Compte gratuit** : à 30 mots, la fiche de traduction affiche « Passer à Premium » et Mes mots
  une carte rouge « Version gratuite 30/30 ». Le compte de démo a un Premium « promotional » à vie
  (RevenueCat) : à garder, sinon ces encarts apparaissent dans la pub.
- **Chapitres Premium** : seuls les 2 premiers sont ouverts aux comptes gratuits.
- **Le lecteur reprend à la page enregistrée** : `openReader()` navigue jusqu'à la page 2 du
  chapitre 1 de The Quiet Signal (« when someone told a **lie**, Tom heard it »).
- **Toucher un mot l'ajoute à Mes mots** du compte de démo (« lie » y est déjà).
- **Il n'y a pas de choix narratifs** dans les histoires : ne jamais écrire « tu décides de la
  suite » (pub trompeuse, refusée par Google Ads).
- **Pas d'XP** dans l'appli ; la série 🔥 n'est que sur l'accueil.
- **Révision** : exercices tirés au hasard ; le Vrai/Faux arrive vers les 2/3 de la séance, après
  une manche de paires. `record.mjs review` intercepte les écritures Supabase (réponse 200 simulée)
  pour ne rien changer aux révisions du compte, passe les exercices (« Je ne sais pas »), résout
  les paires et lit les bonnes réponses dans l'état React (`__reactFiber$…` → `props.ex`).
  Le Vrai/Faux a un chrono de 6 s : la 1re affirmation est répondue hors caméra et on filme la 2e.
- **Phrase à trous** (« Complète la phrase de l’histoire », type `cloze`) : n'existe que si la RPC
  `vocabulary_occurrences` (un POST de LECTURE) passe. Ne simuler que les vraies écritures,
  sinon l'appli ne propose jamais cet exercice. Il est tiré au hasard : le script recharge une
  séance toutes les 15 étapes. À ne pas confondre avec « Complète l’expression » (« house ____ »).

## Montage (`src/Ad.tsx`)

- 60 i/s. Les durées d'animation sont écrites « en images à 30 i/s » et passées par `k()`.
- `plan()` enchaîne les plans après l'accroche (3 s) ; chaque plan est positionné d'après les
  repères du JSON (`tap(clip) - x`) : un nouveau tournage n'oblige pas à recaler à la main.
  Plusieurs plans peuvent partager un texte (révision = Vrai/Faux + phrase à trous).
- Couleurs de l'appli (`apps/mobile/src/theme/colors.ts`) : violet `#6C4BF4`, encre `#25223A` ;
  police Nunito (copiée dans `public/fonts`). Mot clé du texte entre `*astérisques*` → vert menthe.
- Espaces insécables automatiques devant `?` `:` `!` (sinon « ? » seul en début de ligne).
- Musique baissée à 20 % sous la narration et à ~55 % sous l'accroche ; fondu d'entrée et de sortie.
- Aucun prix affiché.

## Sons

- **Voix** : ElevenLabs, voix `ELEVENLABS_VOICE_ID` du `.env` (39BbQfJTexvpWtOQZ4Xr), modèle
  `eleven_v4`, mêmes réglages que `scripts/publish`. Pour la scène d'écoute, on prend l'audio RÉEL
  de la page (même voix) : une narration régénérée ne collerait pas au surlignage de l'appli.
- **Musique** : synthétisée note par note par `audio.mjs` (aucun échantillon) → libre de droits.
- **Volume** : viser -14 LUFS (YouTube). Le rendu Remotion sort à ~-24 LUFS.

## Vérification avant livraison

```bash
F=node_modules/ffmpeg-static/ffmpeg.exe
$F -i out/<video>.mp4 -vf fps=1 check/frames/%02d.png      # 1 image/s : textes coupés ? taps visibles ?
$F -i out/<video>.mp4 -af ebur128=peak=true -f null -        # volume (I ≈ -14 LUFS)
```

Planche rapide : `-vf "fps=1,scale=480:-1,tile=5x6" -frames:v 1 check/sheet.png`.
Synchro : comparer une image de la scène d'écoute avec le mot attendu dans
`content/alignments/b1-the-quiet-signal.json` (`pages['chapter_1.page_2'].words`).
