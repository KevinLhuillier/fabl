# Fabl

Learn English through interactive mini-stories (CEFR A1 → C2).

## Structure

```
apps/mobile         Expo app (TypeScript, expo-router)
  src/app           Screens (expo-router): tabs, story reader, review, celebration, sign-in
  src/components    App components (story path, passage text, word sheet, confetti…)
  src/lib           Data & logic: Supabase, auth, gamification, SM-2, API
  src/theme         Design system: colors, typography, spacing, motion, haptics, base components
apps/admin          Local web admin to write and publish stories (Vite + React, Hono API)
content/stories     Stories in Markdown (.md)
content/translations Translations per language (fr.json, es.json)
content/alignments  Text ↔ voice-over timings per story (align-audio)
scripts/publish     Publishing pipeline (Markdown → Supabase)
supabase/migrations SQL schema
```

## Prerequisites

- Node.js 20+ and npm
- The **Expo Go** app on your phone (SDK 57)
- To publish stories: Python 3.10–3.12 (see [Publishing setup](#publishing-setup))

## Run the app

```bash
npm install                      # at the repo root (npm workspaces)
cp apps/mobile/.env.example apps/mobile/.env   # then fill in the Supabase values
npm run mobile                   # scan the QR code with Expo Go
```

Sign up with an email and a password. Supabase asks new users to confirm their
email by default: click the link received, then sign in. For development you can
turn this off in **Authentication → Providers → Email → Confirm email**.

### What's in the app

- **Stories** (home): every story as a book — front cover, level badge, word count, reading
  time and reading progress (%) — plus streak, total practice time and today's goal.
- **Story**: cover, summary, overall progress and the **table of contents** of its chapters.
  Chapters unlock one after the other (done / current with a bookmark / locked); a finished
  chapter can be read again.
- **Reader**: one chapter, page by page, with a "Continue" button (stories are linear, no
  choices). Tap any word to see its translation in a bottom sheet; the word is added to
  "Mes mots" (once). The current page is saved and resumed on reopen. A page with a voice-over
  has a round play button (bottom right); once the page is aligned, the words light up as they
  are read and a long press on a word plays from there.
- **Mes mots**: every word looked up, with translation, context sentence and story, searchable,
  removable (trash icon), with the number of words due today. Practice is possible at any time.
- **Review**: due words (spaced repetition, simplified SM-2 — `src/lib/srs.ts`): the user types the word's translation,
  alternating English → user's language and back (synonyms, articles, a missing accent or one typo accepted — `src/lib/answer.ts`). Missed words come back at the end.
- **Celebration** screen after a chapter (with "next chapter" and the number of new words to learn:
  the chapter's words added to "Mes mots" and not reviewed yet), a whole story or a review.

### Languages

The interface and the word translations are in **French**, **Spanish**, **Portuguese** (Brazil), **Italian** or **German**: the language chosen in
**Profil → Langue** (saved on the account, `user_stats.lang`), else the phone's language (French
when it is none of them). On the first sign-in, a **language screen** asks for it (shown while
`user_stats.lang` is empty, the phone's language preselected). Interface texts live in
`apps/mobile/src/i18n/` — `fr.ts` is the reference, the other dictionaries (`es.ts`, `pt.ts`, `it.ts`, `de.ts`) must have the same keys (TypeScript
checks it). To add a language: a new dictionary, its code in `LANGS` (`i18n/index.tsx`) and in
the `user_stats.lang` check constraint (migration), and a `content/translations/<lang>.json`
imported with `seed-translations`.

### Tuning the game

The daily goal is a number of **minutes of practice**: time spent reading a chapter (voice-over
included) or reviewing words. Time only counts while the app is in the foreground and the user
interacted less than 2 minutes ago (`src/lib/activity.ts`); it is saved every 30 s in
`daily_activity` (one row per local day). A day counts for the streak once its goal is reached. New accounts choose their goal at the first sign-in,
right after their language (`src/app/daily-goal.tsx`; `daily_goal_minutes` is null until then).
The rules live in `apps/mobile/src/lib/gamification.ts` (`DAILY_GOAL_OPTIONS`, `IDLE_AFTER_MS`,
`nextStreak`).

## Supabase

1. Create a project on [supabase.com](https://supabase.com).
2. In **Authentication → Providers**, make sure **Email** is enabled (email + password).
3. Apply the migrations, either:
   - **CLI** (no install needed, runs through npx):
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **or Dashboard**: paste each file of `supabase/migrations/` (in order) into the SQL Editor and run it.
4. Fill in the keys (**Project Settings → API**):
   - `apps/mobile/.env` → project URL + **anon / publishable** key
   - `.env` (repo root) → project URL + **service_role / secret** key (publish script only, never in the app)

### Data model

| Table                                                                                       | Access                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `stories`, `chapters`, `passages` (pages), `tokens`, `lemmas`, `translations`               | public read, written by the publish script |
| `user_progress`, `user_chapter_progress`, `user_vocabulary`, `user_stats`, `daily_activity` | owner only (RLS on `auth.uid()`)           |

A `user_stats` row is created automatically when an account signs up.

## Publishing stories

### Publishing setup

The publish script calls a small Python script (spaCy) to split the text into
words and find each word's base form ("went" → _go_, "cats" → _cat_). Create
its virtual environment once:

```bash
# Windows (PowerShell)
py -3.12 -m venv scripts/publish/.venv
scripts/publish/.venv/Scripts/python -m pip install -r scripts/publish/requirements.txt

# macOS / Linux
python3 -m venv scripts/publish/.venv
scripts/publish/.venv/bin/python -m pip install -r scripts/publish/requirements.txt
```

The script uses this venv automatically (override with `PYTHON_BIN` in `.env`).
Then copy `.env.example` to `.env` at the repo root and fill in
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Publish

```bash
npm run publish-story -- content/stories/a1-my-story.md            # one or more files
npm run publish-story -- content/stories/a1-my-story.md --dry-run  # check only, no database
npm run seed-translations                                           # import content/translations/fr.json
npm run seed-translations -- --lang es                              # import content/translations/es.json
```

For each story the script:

1. parses the Markdown file: front matter, **chapters** and **pages** (with clear errors and line
   numbers when the format is wrong);
2. tokenizes and lemmatizes the text (spaCy) and counts the words;
3. upserts story, chapters, pages, lemmas and tokens — **idempotent**: the story is keyed by its
   file name (slug), chapters and pages by their `key`, so republishing updates everything
   without duplicates (removed chapters/pages are deleted);
4. lists the lemmas that still have no translation in `--lang` (`fr` by default; run it again
   with `--lang es` for Spanish).

Add the missing ones to `content/translations/<lang>.json`, then run `npm run seed-translations`
(`-- --lang es` for Spanish, `pt`, `it`, `de` for the others): every language needs its own run.

### Admin (web)

```bash
npm run admin    # → http://localhost:5180
```

A local web app, styled like the mobile app, to manage stories without touching the Markdown.

**Access**: sign in with a Fabl account (the same as in the mobile app) that is an **admin**.
Grant it once (the account must exist; `--revoke` takes it back):

```bash
npm run grant-admin -- you@example.com
```

This sets `app_metadata.admin = true` on the Supabase user (only the service key can change
`app_metadata`). The server signs in on the browser's behalf and keeps the session in HttpOnly
cookies; every API call checks it against Supabase, so the Supabase keys in `.env` are required.

- **Histoires**: every story on one shelf with its cover, level and status — _Brouillon_ (file
  only), _Publiée_, _Modifiée_ (file changed since the last publish), _En ligne sans fichier_
  (published from elsewhere; its file can be rebuilt from Supabase). Create a story from here.
- **Editor**: title, level, summary and **cover** (upload to the public `covers` Storage bucket,
  or an image URL; preview of the default cover otherwise); chapters and pages edited as pages of
  a book (add, delete, reorder — moved chapters get an explicit `{#id}` so readers' progress
  follows them), or the raw **Markdown** (files with `<!-- comments -->` open there to keep them).
  Format errors show live. `Ctrl+S` saves the file. Each page has a **Voix off** button: upload
  an MP3 (public `audio` Storage bucket, 20 MB max.), listen to it, replace or remove it.
- **Vérifier** (dry run) / **Publier**: same pipeline as `publish-story`; the report lists the
  words without translation, with the story sentence as suggested example, to translate on the
  spot (saved to `content/translations/fr.json` and Supabase; start the admin with `ADMIN_LANG=es`
  to work on the Spanish ones).
- **Supprimer**: remove from the app (readers' progress on the story is deleted) and/or delete
  the file.

The `.md` files stay the source of truth (commit them). The server only listens on localhost: the
service key from `.env` never reaches the browser. Cover and voice-over uploads need the `covers`
and `audio` bucket migrations.

### Story format (Markdown)

```markdown
---
title: Where Is Leo?
level: A1
summary: Mia's cat is not at home. Help her find him!
---

# Leo Is Not Here

It is Saturday morning.
Mia has a cat. His name is Leo.

---

Mia goes into the garden.
"Leo! Leo!" she calls.

# Mr Green

Then Mia sees her neighbour, Mr Green.
```

- **Front matter** (between the first two `---` lines): `title`, `level` (A1–C2), `summary`
  and optionally `cover` (http(s) URL of the front cover image; without it the app draws a
  default cover in the level color). Chapters share the story's level.
- **`# Title` starts a chapter**; `---` separates two **pages** of a chapter. Only `#` headings.
- **One line = one paragraph**; blank lines are ignored. `<!-- comments -->` are allowed.
- **`@audio <url>`** (optional, one per page, written first by the admin) attaches a recorded
  voice-over (MP3) to the page: the reader shows a play button above the text. The URL lives in
  the file, so the recording follows its page when pages or chapters move.
- Dialogue goes between straight double quotes on a single line; the reader highlights it.
- Stories are **linear** (no choices), static text only.
- **Keys**: the file name identifies the story (renaming it publishes a new story). Chapters are
  keyed by position (`chapter_1`, `chapter_2`…) and pages by `<chapter>.page_<n>`; readers'
  progress is attached to chapters. To reorder chapters without mixing up progress, give them an
  explicit id: `# Mr Green {#mr-green}`.

### Translation file

`content/translations/<lang>.json` (`fr.json`, `es.json`, `pt.json`, `it.json`, `de.json`):

```json
{
  "lang": "fr",
  "entries": [{ "word": "go", "pos": "VERB", "translation": "aller", "example": "I go to school." }]
}
```

`word` + `pos` must match the lemma printed by the publish script.

### Expressions

Phrasal verbs and fixed phrases are translated as a whole: tapping "shut" in "Shut up!" shows
_shut up — se taire_ (the word alone below it), highlights both words and adds the expression to
"Mes mots", so it is reviewed as such. An expression is a lemma with the pos `PHRASE`, translated
in the same files: `{ "word": "shut up", "pos": "PHRASE", "translation": "se taire, la fermer" }`.
The publish script lists the untranslated ones with the other lemmas.

- **Phrasal verbs** are found by spaCy's dependency parser: a particle attached to its verb, even
  when separated ("She picked it up" → _pick up_).
- **Fixed phrases** ("of course", "in front of", "be about to") are listed in
  `content/expressions.json` and matched on consecutive words, each by its text or its base form
  ("took care of" → _take care of_). The longest match wins.
- `ignore` in the same file lists phrasal verbs that mean nothing more than their words.

After changing `content/expressions.json`, republish the stories and translate the new expressions.

### Generated voice-overs (ElevenLabs)

Instead of uploading MP3s in the admin, the voice-overs can be generated with ElevenLabs
text-to-speech (`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`; the voice settings
live in `scripts/publish/src/generateAudio.ts`):

```bash
npm run generate-audio -- content/stories/c1-my-story.md --dry-run                  # pages and characters to bill
npm run generate-audio -- content/stories/c1-my-story.md                            # every page without @audio
npm run generate-audio -- content/stories/c1-my-story.md --page chapter_2.page_1   # one page
```

Each page is generated, uploaded to the `audio` bucket and its `@audio` line added to the file
(saved after every page). Pages that already have an `@audio` line are skipped: remove the line to
regenerate one. Then run `align-audio` and publish.

### Read-along (voice-over alignment)

After adding a voice-over to a page, align it with the text so the reader can highlight the
words as they are spoken, then publish:

```bash
npm run align-audio -- content/stories/c1-my-story.md                          # every page with @audio
npm run align-audio -- content/stories/c1-my-story.md --page chapter_1.page_1  # one page
```

Whisper (faster-whisper, `small.en`, run locally; ~500 MB downloaded on first use) transcribes the
recording with a timestamp per word, matched to the page's words. Timings are saved in
`content/alignments/<slug>.json` (commit it) and sent with the tokens on publish. Pages already
aligned are skipped (`--force` to redo). If the page text or its audio changes, the alignment is
ignored with a warning until `align-audio` runs again.

### Lemma fixes

spaCy sometimes gets a base form wrong ("soles" → _sol_, "stared" → _star_). Correct it in
`content/lemma-fixes.json`: the exact token text and spaCy's POS (AUX counts as VERB) map to the
right lemma. Then republish the affected stories and translate the new lemma.

```json
{ "fixes": [{ "text": "soles", "pos": "NOUN", "word": "sole", "lemmaPos": "NOUN" }] }
```

A fix can be limited to one context with `next`, the text of the following token (punctuation
included); it wins over the fix without `next`. "Well" is always the Well of _Hollow Wilds_,
except before a comma:
`{ "text": "Well", "pos": "INTJ", "next": ",", "word": "well", "lemmaPos": "INTJ" }`.

## Scripts

| Command                               | What it does                                 |
| ------------------------------------- | -------------------------------------------- |
| `npm run mobile`                      | Start the Expo dev server                    |
| `npm run admin`                       | Start the web admin (localhost:5180)         |
| `npm run grant-admin -- <email>`      | Give admin access (`--revoke` to remove)     |
| `npm run publish-story -- <file.md>`  | Publish a story (`--dry-run` to check only)  |
| `npm run align-audio -- <file.md>`    | Align voice-overs with the text (read-along) |
| `npm run generate-audio -- <file.md>` | Generate missing voice-overs (ElevenLabs)    |
| `npm run seed-translations`           | Import translations (`-- --lang es`)         |
| `npm run lint`                        | ESLint + Prettier on all packages            |
| `npm run typecheck`                   | TypeScript on all packages                   |
| `npm run format`                      | Format the whole repo                        |
