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
content/translations Translations per language (fr.json)
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
  time and reading progress (%) — plus streak, total XP and today's goal.
- **Story**: cover, summary, overall progress and the **table of contents** of its chapters.
  Chapters unlock one after the other (done / current with a bookmark / locked); a finished
  chapter can be read again.
- **Reader**: one chapter, page by page, with a "Continue" button (stories are linear, no
  choices). Tap any word to see its translation in a bottom sheet; the word is added to
  "Mes mots" (once). The current page is saved and resumed on reopen.
- **Mes mots**: every word looked up, with translation, context sentence and story, searchable,
  removable (trash icon), with the number of words due today. Practice is possible at any time.
- **Review**: due words (spaced repetition, simplified SM-2 — `src/lib/srs.ts`) as multiple-choice
  questions, alternating EN → FR and FR → EN. Missed words come back at the end.
- **Celebration** screen after a chapter (with "next chapter"), a whole story or a review.

### Tuning the game

All XP / streak / daily-goal rules live in `apps/mobile/src/lib/gamification.ts` (`XP_RULES`,
`DAILY_GOAL_OPTIONS`, `nextStreak`). A day counts for the streak as soon as the user earns XP.

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

| Table                                                                                  | Access                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `stories`, `chapters`, `passages` (pages), `tokens`, `lemmas`, `translations`          | public read, written by the publish script |
| `user_progress`, `user_chapter_progress`, `user_vocabulary`, `user_stats`, `xp_events` | owner only (RLS on `auth.uid()`)           |

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
```

For each story the script:

1. parses the Markdown file: front matter, **chapters** and **pages** (with clear errors and line
   numbers when the format is wrong);
2. tokenizes and lemmatizes the text (spaCy) and counts the words;
3. upserts story, chapters, pages, lemmas and tokens — **idempotent**: the story is keyed by its
   file name (slug), chapters and pages by their `key`, so republishing updates everything
   without duplicates (removed chapters/pages are deleted);
4. lists the lemmas that still have no French translation.

Add the missing ones to `content/translations/fr.json`, then run `npm run seed-translations`.

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
  spot (saved to `content/translations/fr.json` and Supabase).
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

`content/translations/fr.json`:

```json
{
  "lang": "fr",
  "entries": [{ "word": "go", "pos": "VERB", "translation": "aller", "example": "I go to school." }]
}
```

`word` + `pos` must match the lemma printed by the publish script.

## Scripts

| Command                              | What it does                                |
| ------------------------------------ | ------------------------------------------- |
| `npm run mobile`                     | Start the Expo dev server                   |
| `npm run admin`                      | Start the web admin (localhost:5180)        |
| `npm run grant-admin -- <email>`     | Give admin access (`--revoke` to remove)    |
| `npm run publish-story -- <file.md>` | Publish a story (`--dry-run` to check only) |
| `npm run seed-translations`          | Import `content/translations/fr.json`       |
| `npm run lint`                       | ESLint + Prettier on all packages           |
| `npm run typecheck`                  | TypeScript on all packages                  |
| `npm run format`                     | Format the whole repo                       |
