// Sons de la pub, dans public/ (lus par Remotion) :
//   hook.mp3       « He knew she was lying. », voix ElevenLabs du projet
//   narration.mp3  audio réel de la page 2 du chapitre 1 de The Quiet Signal (celui du clip 3)
//   music.wav      musique originale synthétisée ici (libre de droits), 52 s
//   tick.wav       petit son de tap
// Usage : node audio.mjs [--no-tts]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const PUB = DIR + 'public/';
mkdirSync(PUB, { recursive: true });
const env = Object.fromEntries(
  readFileSync(DIR + '../.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

// ---------- voix ----------

if (!process.argv.includes('--no-tts') && !existsSync(PUB + 'hook.mp3')) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'He knew she was lying.',
        model_id: env.ELEVENLABS_MODEL || 'eleven_v4',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, clone_strength: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${await res.text()}`);
  writeFileSync(PUB + 'hook.mp3', Buffer.from(await res.arrayBuffer()));
  console.log('hook.mp3');
}

const clip3 = JSON.parse(readFileSync(DIR + 'clips/3-listen.json', 'utf8'));
if (!existsSync(PUB + 'narration.mp3')) {
  const res = await fetch(clip3.audio[0].src);
  if (!res.ok) throw new Error(`narration ${res.status}`);
  writeFileSync(PUB + 'narration.mp3', Buffer.from(await res.arrayBuffer()));
  console.log('narration.mp3');
}

// ---------- synthèse ----------

const SR = 44100;

function wav(path, L, R = L) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
  console.log(path.slice(DIR.length));
}

// Tick : clic court et doux (transitoire bruité + petite note aiguë qui s'éteint vite).
{
  const n = Math.round(SR * 0.06);
  const t = new Float32Array(n);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    lp += 0.35 * (rnd() - lp);
    t[i] = 0.5 * Math.sin(2 * Math.PI * 1900 * s) * Math.exp(-s * 140) + 0.35 * lp * Math.exp(-s * 400);
  }
  wav(PUB + 'tick.wav', t);
}

// Musique : 84 bpm, Fmaj7 – Am7 – Dm9 – B♭maj7, nappe + arpège pincé + basse + percussions légères.
{
  const BPM = 84;
  const beat = 60 / BPM;
  const bar = beat * 4;
  const DUR = 52;
  const n = SR * DUR;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [57, 60, 64, 67], // Am7
    [50, 57, 60, 64], // Dm9 (sans tierce grave : D A C E)
    [46, 53, 57, 62], // B♭maj7
  ];
  const roots = [41, 45, 38, 46];
  const add = (i, l, r = l) => {
    if (i >= 0 && i < n) {
      L[i] += l;
      R[i] += r;
    }
  };
  // Enveloppe générale : intro (0–3 s) très douce, fondu d'entrée et de sortie.
  const master = (t) => {
    const fadeIn = Math.min(1, t / 1.5);
    const fadeOut = Math.min(1, Math.max(0, (DUR - 0.2 - t) / 3));
    return fadeIn * fadeOut;
  };
  const nBars = Math.ceil(DUR / bar);

  // Nappe.
  for (let b = 0; b < nBars; b++) {
    const ch = chords[b % 4];
    const t0 = b * bar;
    for (const [k, m] of ch.entries()) {
      const f = hz(m + 12);
      const len = bar + 0.6;
      let lp = 0;
      for (let s = 0; s < len * SR; s++) {
        const t = s / SR;
        const env = Math.min(1, t / 0.5) * Math.min(1, (len - t) / 0.6);
        const raw =
          Math.sin(2 * Math.PI * f * t) +
          0.5 * Math.sin(2 * Math.PI * f * 1.003 * t + k) +
          0.25 * Math.sin(2 * Math.PI * f * 2.001 * t);
        lp += 0.2 * (raw - lp);
        const v = lp * env * 0.022;
        const pan = (k - 1.5) / 3;
        add(Math.round((t0 + t) * SR), v * (1 - pan * 0.5), v * (1 + pan * 0.5));
      }
    }
  }

  // Arpège pincé (Karplus-Strong), en croches, à partir de la mesure 2.
  const pluck = (time, m, vel, pan) => {
    const f = hz(m);
    const period = Math.round(SR / f);
    const line = new Float32Array(period);
    let seed = Math.round(m * 977 + time * 1000);
    for (let i = 0; i < period; i++) {
      seed = (seed * 16807) % 2147483647;
      line[i] = (seed / 2147483647) * 2 - 1;
    }
    const len = Math.round(SR * 1.6);
    const start = Math.round(time * SR);
    let idx = 0;
    for (let s = 0; s < len; s++) {
      const a = line[idx];
      const b = line[(idx + 1) % period];
      line[idx] = 0.4985 * (a + b);
      idx = (idx + 1) % period;
      const v = a * vel * Math.min(1, s / 40);
      add(start + s, v * (1 - pan), v * (1 + pan));
    }
  };
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
  // Variante à partir de la 9e mesure : motif montant, une octave plus haut une note sur deux.
  const pattern2 = [0, 1, 2, 3, 1, 2, 3, 2];
  for (let b = 1; b < nBars - 1; b++) {
    const ch = chords[b % 4];
    for (let e = 0; e < 8; e++) {
      const t = b * bar + e * (beat / 2);
      if (t > DUR - 4) break;
      const variant = b >= 8 && b % 8 < 8 && Math.floor(b / 8) % 2 === 1;
      const m = ch[(variant ? pattern2 : pattern)[e]] + (variant && e % 2 ? 24 : 12);
      pluck(t, m, e % 2 ? 0.09 : 0.12, ((e % 4) - 1.5) / 6);
    }
  }

  // Basse douce (sinus) sur les temps 1 et 3, à partir de la mesure 2.
  for (let b = 1; b < nBars; b++) {
    for (const off of [0, 2]) {
      const t0 = b * bar + off * beat;
      if (t0 > DUR - 2) break;
      const f = hz(roots[b % 4]);
      for (let s = 0; s < beat * 1.9 * SR; s++) {
        const t = s / SR;
        const env = Math.min(1, t / 0.02) * Math.exp(-t * 1.3);
        const v = Math.sin(2 * Math.PI * f * t) * env * 0.11;
        add(Math.round((t0 + t) * SR), v);
      }
    }
  }

  // Kick feutré (temps 1 et 3) et shaker léger (croches), à partir de la mesure 3.
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let b = 2; b < nBars; b++) {
    for (let q = 0; q < 8; q++) {
      const t0 = b * bar + q * (beat / 2);
      if (t0 > DUR - 4.5) break;
      if (q % 4 === 0) {
        for (let s = 0; s < 0.35 * SR; s++) {
          const t = s / SR;
          const f = 50 + 70 * Math.exp(-t * 30);
          const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) * 0.16;
          add(Math.round((t0 + t) * SR), v);
        }
      }
      let hp = 0;
      let prev = 0;
      const vel = q % 2 ? 0.02 : 0.032;
      for (let s = 0; s < 0.07 * SR; s++) {
        const t = s / SR;
        const x = rnd();
        hp = 0.85 * (hp + x - prev);
        prev = x;
        const v = hp * Math.exp(-t * 60) * vel;
        add(Math.round((t0 + t) * SR), v * 0.8, v * 1.2);
      }
    }
  }

  // Petite réverb (retards en peigne croisés) et enveloppe générale.
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let i = 0; i < n; i++) {
    const x = (L[i] + R[i]) * 0.5;
    let wl = 0;
    let wr = 0;
    combs.forEach((c, k) => {
      const y = c.buf[c.i];
      c.buf[c.i] = x + y * 0.78;
      c.i = (c.i + 1) % c.d;
      if (k % 2) wr += y;
      else wl += y;
    });
    const g = master(i / SR);
    outL[i] = (L[i] + wl * 0.06) * g;
    outR[i] = (R[i] + wr * 0.06) * g;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
  const norm = 0.7 / peak;
  for (let i = 0; i < n; i++) {
    outL[i] *= norm;
    outR[i] *= norm;
  }
  wav(PUB + 'music.wav', outL, outR);
}
