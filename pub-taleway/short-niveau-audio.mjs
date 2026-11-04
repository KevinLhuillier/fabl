// Voix du short « Quel est ton vrai niveau en anglais ? » : une phrase par niveau, lue par la
// voix ElevenLabs des histoires, avec l'instant de chaque mot (endpoint with-timestamps).
//   public/short-niveau/<niveau>.mp3   la phrase lue
//   src/short-niveau-timings.json      début / fin de chaque mot (s), lus par le montage
// Les phrases sont dans src/ShortNiveau.tsx (SENTENCES) : les deux doivent rester identiques.
// Usage : node short-niveau-audio.mjs [--force]   (une phrase déjà générée n'est pas refaite)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const OUT = DIR + 'public/short-niveau/';
const TIMINGS = DIR + 'src/short-niveau-timings.json';
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  readFileSync(DIR + '../.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

const SENTENCES = {
  a2: 'Every night, the old fisherman tells his grandson a story about the sea.',
  b1: 'She had been waiting for hours when the train finally pulled into the station.',
  c1: 'Despite his misgivings, he reluctantly agreed to shoulder the blame.',
};

const force = process.argv.includes('--force');
const timings = existsSync(TIMINGS) ? JSON.parse(readFileSync(TIMINGS, 'utf8')) : {};

for (const [level, text] of Object.entries(SENTENCES)) {
  if (!force && existsSync(OUT + `${level}.mp3`) && timings[level]?.text === text) continue;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL || 'eleven_v4',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, clone_strength: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${level} ${res.status} : ${await res.text()}`);
  const data = await res.json();
  writeFileSync(OUT + `${level}.mp3`, Buffer.from(data.audio_base64, 'base64'));

  // Caractères → mots (séparés par des espaces), avec le premier et le dernier instant.
  const a = data.alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { word: '', start: a.character_start_times_seconds[i], end: 0 };
    cur.word += ch;
    cur.end = a.character_end_times_seconds[i];
  }
  if (cur) words.push(cur);
  const duration = a.character_end_times_seconds.at(-1);
  timings[level] = { text, duration, words };
  console.log(`${level}.mp3  ${duration.toFixed(2)} s  ${words.length} mots`);
}

writeFileSync(TIMINGS, JSON.stringify(timings, null, 2) + '\n');
