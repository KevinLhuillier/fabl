/**
 * Short vertical « Quel est ton vrai niveau en anglais ? » (Reels, TikTok, YouTube Shorts) :
 * trois phrases de plus en plus dures (A2, B1, C1), lues par la voix des histoires et
 * surlignées mot à mot comme dans l'appli. Puis une main touche les mots difficiles et leur
 * traduction s'affiche. Fin : « Où as-tu décroché ? ». En bas de chaque écran : logo + Google Play.
 * Versions : français (ShortNiveau) et portugais du Brésil (ShortNiveauPt).
 *
 * Voix et instants des mots : node short-niveau-audio.mjs (public/short-niveau/, timings.json).
 * Rendu : npx remotion render src/index.ts ShortNiveau out/short-niveau-1080x1920.mp4 ...
 */
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import timings from './short-niveau-timings.json';

export const SHORT_FPS = 30;
const s = (sec: number) => Math.round(sec * SHORT_FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const FONT = 'Nunito, sans-serif';

export type ShortLang = 'fr' | 'pt';

/** Textes à l'écran, par langue (la voix lit les phrases en anglais dans les deux). */
const TEXTS: Record<
  ShortLang,
  {
    hook: string;
    hookSub: string;
    header: string;
    level: string;
    names: Record<Level, string>;
    outro: string;
    tagline: string;
    /** Badge officiel « Disponible sur Google Play » (play.google.com/intl/en_us/badges). */
    badge: string;
  }
> = {
  fr: {
    hook: 'Quel est ton *vrai* niveau en anglais ?',
    hookSub: '3 phrases, de plus en plus dures 👇',
    header: 'Quel est ton *vrai* niveau ?',
    level: 'Niveau',
    names: { a2: 'Élémentaire', b1: 'Intermédiaire', c1: 'Avancé' },
    outro: 'Où as-tu *décroché* ?',
    tagline: "L'anglais avec des histoires",
    badge: 'badges/fr.png',
  },
  pt: {
    hook: 'Qual é o seu nível *real* de inglês?',
    hookSub: '3 frases, cada vez mais difíceis 👇',
    header: 'Qual é o seu nível *real*?',
    level: 'Nível',
    names: { a2: 'Elementar', b1: 'Intermediário', c1: 'Avançado' },
    outro: 'Onde você *travou*?',
    tagline: 'Inglês com histórias',
    badge: 'badges/pt-br.png',
  },
};

const LangContext = React.createContext<ShortLang>('fr');
const useTexts = () => TEXTS[React.useContext(LangContext)];

const C = {
  ink: '#25223A',
  inkSoft: '#6B6785',
  yellow: '#FFC233',
  paper: '#FFFCF5',
};

type Level = 'a2' | 'b1' | 'c1';
/** Un mot difficile (ou une expression : plusieurs mots) touché après la lecture. */
type Hard = {
  words: number[];
  /** Traduction, par langue de la vidéo. */
  tr: Record<ShortLang, string>;
  /** Mot où la main touche et où s'accroche la bulle (par défaut le premier). */
  anchor?: number;
  /** Bulle sous le mot (au-dessus, elle cacherait la ligne précédente). */
  below?: boolean;
};
const anchor = (h: Hard) => h.anchor ?? h.words[0]!;
/** Espace entre les mots de la phrase (px). */
const GAP = 18;

const LEVELS: {
  id: Level;
  label: string;
  color: string;
  soft: string;
  hard: Hard[];
}[] = [
  {
    id: 'a2',
    label: 'A2',
    color: '#3BA9FF',
    soft: '#E1F2FF',
    hard: [{ words: [4], tr: { fr: 'pêcheur', pt: 'pescador' } }],
  },
  {
    id: 'b1',
    label: 'B1',
    color: '#6C4BF4',
    soft: '#EEE9FF',
    hard: [
      { words: [9], tr: { fr: 'enfin', pt: 'finalmente' } },
      {
        words: [10, 11, 12, 13],
        tr: { fr: 'entrer en gare', pt: 'chegar à estação' },
        anchor: 13,
        below: true,
      },
    ],
  },
  {
    id: 'c1',
    label: 'C1',
    color: '#FF8A1F',
    soft: '#FFEEDC',
    hard: [
      { words: [2], tr: { fr: 'doutes', pt: 'receios' } },
      { words: [4], tr: { fr: 'à contrecœur', pt: 'a contragosto' } },
      {
        words: [7, 8, 9],
        tr: { fr: 'endosser la faute', pt: 'assumir a culpa' },
        anchor: 8,
        below: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Minutage
// ---------------------------------------------------------------------------

/** Haut du bandeau logo + Google Play. */
const FOOTER_TOP = 1360;

const HOOK = s(2.6);
const HIGHLIGHT_LEAD = 0.2;
const ENTER = s(0.7); // la carte arrive, puis la voix
const AFTER_READ = s(0.35);
const PER_TAP = s(1.7); // la main va au mot, touche, la traduction reste affichée
const TRAVEL = s(0.5);
const HOLD_END = s(0.9);
const OUTRO = s(4.5);

type Section = { level: (typeof LEVELS)[number]; from: number; dur: number; read: number };

const SECTIONS: Section[] = (() => {
  let at = HOOK;
  return LEVELS.map((level) => {
    const read = s(timings[level.id].duration);
    const dur = ENTER + read + AFTER_READ + level.hard.length * PER_TAP + HOLD_END;
    const section = { level, from: at, dur, read };
    at += dur;
    return section;
  });
})();
const LAST = SECTIONS[SECTIONS.length - 1]!;
const OUTRO_FROM = LAST.from + LAST.dur;
export const SHORT_DURATION = OUTRO_FROM + OUTRO;

/** Instant (images, dans la section) où la main touche le mot difficile n°i. */
const tapAt = (sec: Section, i: number) => ENTER + sec.read + AFTER_READ + i * PER_TAP + TRAVEL;

// ---------------------------------------------------------------------------
// Éléments
// ---------------------------------------------------------------------------

/** Texte avec un mot clé entre *astérisques* en jaune ; espaces insécables devant ? ! : */
function Rich({ text }: { text: string }) {
  const parts = text.replace(/ ([?!:])/g, ' $1').split('*');
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} style={{ color: C.yellow }}>
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Où la main touche un bloc (pas tout à fait au centre : plus naturel). */
const TOUCH = { left: '40%', top: '70%' } as const;

const HAND = 120;
/** Pointe de l'index dans la main (même dessin que record.mjs). */
const TIP = { x: (8 / 24) * HAND, y: (2.3 / 24) * HAND };

function Hand({ x, y, press }: { x: number; y: number; press: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - TIP.x,
        top: y - TIP.y,
        width: HAND,
        height: HAND,
        transform: `scale(${1 - press * 0.12})`,
        transformOrigin: `${TIP.x}px ${TIP.y}px`,
        filter: 'drop-shadow(0 6px 10px rgba(20,10,60,.35))',
        zIndex: 5,
      }}>
      <svg viewBox="0 0 24 24" width={HAND} height={HAND}>
        <path
          d="M6 4a2 2 0 0 1 4 0v5.5a2 2 0 0 1 4 0v.5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 15Z"
          fill="#fff"
          stroke={C.ink}
          strokeWidth={1.25}
          strokeLinejoin="round"
        />
        <path
          d="M10 9.5v3M14 10v2.6M18 11v2"
          stroke={C.ink}
          strokeWidth={1.1}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/** Sur le mot touché : la main (arrive du bas à droite, touche, repart), le cercle, la bulle. */
function Touch({
  hard,
  tap,
  shown,
  color,
}: {
  hard: Hard;
  tap: number;
  shown: boolean;
  color: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lang = React.useContext(LangContext);
  const pop = spring({ frame: frame - tap, fps, config: { damping: 11 } });
  const press = interpolate(frame, [tap - 3, tap, tap + 4], [0, 1, 0], clamp);
  const arrive = interpolate(frame, [tap - TRAVEL, tap], [0, 1], {
    ...clamp,
    easing: (x) => 1 - (1 - x) ** 3,
  });
  const away = interpolate(frame, [tap + s(0.4), tap + s(0.9)], [0, 1], {
    ...clamp,
    easing: (x) => x * x,
  });
  const off = 1 - arrive + away;
  const handOn = frame >= tap - TRAVEL && frame <= tap + s(0.9);
  const ripple = (frame - tap) / s(0.5);
  return (
    <>
      {shown ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            ...(hard.below ? { top: 'calc(100% + 22px)' } : { bottom: 'calc(100% + 22px)' }),
            transform: `translateX(-50%) scale(${pop})`,
            transformOrigin: hard.below ? '50% 0%' : '50% 100%',
            whiteSpace: 'nowrap',
            background: C.ink,
            color: '#fff',
            fontWeight: 800,
            fontSize: 50,
            lineHeight: 1.2,
            padding: '16px 30px',
            borderRadius: 24,
            boxShadow: '0 8px 0 rgba(0,0,0,.2)',
            zIndex: 4,
          }}>
          {hard.tr[lang]}
          <div
            style={{
              position: 'absolute',
              left: 'calc(50% - 16px)',
              borderLeft: '16px solid transparent',
              borderRight: '16px solid transparent',
              ...(hard.below
                ? { top: -16, borderBottom: `16px solid ${C.ink}` }
                : { bottom: -16, borderTop: `16px solid ${C.ink}` }),
            }}
          />
        </div>
      ) : null}
      {ripple >= 0 && ripple < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: TOUCH.left,
            top: TOUCH.top,
            width: 90,
            height: 90,
            marginLeft: -45,
            marginTop: -45,
            borderRadius: '50%',
            border: `5px solid ${color}`,
            background: `${color}40`,
            transform: `scale(${0.5 + ripple * 1.6})`,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      {handOn ? (
        <div style={{ position: 'absolute', left: TOUCH.left, top: TOUCH.top }}>
          <Hand x={off * 380} y={off * 520} press={press} />
        </div>
      ) : null}
    </>
  );
}

/** Une phrase : lecture surlignée, mots difficiles touchés et traduits. */
function SentenceCard({ sec }: { sec: Section }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { level } = sec;
  const texts = useTexts();
  const words = timings[level.id].words;
  // Temps de la voix (s), un peu en avance : les instants d'ElevenLabs sont légèrement
  // tardifs, et un mot surligné juste avant d'être dit paraît en phase.
  const t = (frame - ENTER) / fps + HIGHLIGHT_LEAD;

  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const exit = interpolate(frame, [sec.dur - s(0.3), sec.dur], [0, 1], clamp);

  // Mot difficile touché le plus récemment (sa traduction est affichée).
  const taps = level.hard.map((_, i) => tapAt(sec, i));
  const current = taps.reduce((acc, at, i) => (frame >= at ? i : acc), -1);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        transform: `translateY(${(1 - enter) * 120 - exit * 60}px) scale(${0.94 + enter * 0.06})`,
      }}>
      {/* Niveau */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}>
        <div
          style={{
            background: level.color,
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 46,
            padding: '14px 36px',
            borderRadius: 999,
            boxShadow: '0 8px 0 rgba(0,0,0,.18)',
            transform: `scale(${spring({ frame: frame - s(0.15), fps, config: { damping: 9 } })})`,
          }}>
          {texts.level} {level.label} · {texts.names[level.id]}
        </div>
      </div>

      {/* Carte */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 620,
          background: C.paper,
          borderRadius: 48,
          padding: '64px 56px',
          boxShadow: `0 14px 0 ${level.color}, 0 30px 60px rgba(30,6,80,.35)`,
          border: `5px solid ${level.color}`,
        }}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.55,
            color: C.ink,
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: GAP,
          }}>
          {words.map((w, i) => {
            const reading = t >= w.start - 0.03 && t < (words[i + 1]?.start ?? w.end + 0.2);
            const read = t >= w.end;
            // Mot (ou mot d'une expression) difficile : jaune une fois touché.
            const k = level.hard.findIndex((h) => h.words.includes(i));
            const isTouched = k >= 0 && k <= current;
            const word = (
              <span
                key={i}
                style={{
                  position: 'relative',
                  borderRadius: 14,
                  // L'espace entre les mots (columnGap) est couvert : une expression surlignée
                  // forme une bande continue, même sur deux lignes.
                  padding: `0 ${GAP / 2}px`,
                  margin: `0 -${GAP / 2}px`,
                  background: isTouched ? C.yellow : reading ? level.soft : 'transparent',
                  color: isTouched ? C.ink : read ? level.color : C.ink,
                }}>
                {w.word}
                {k >= 0 && anchor(level.hard[k]!) === i ? (
                  <Touch
                    hard={level.hard[k]!}
                    tap={taps[k]!}
                    shown={k === current}
                    color={level.color}
                  />
                ) : null}
              </span>
            );
            return word;
          })}
        </div>
      </div>

      {/* Voix et tics */}
      <Sequence from={ENTER}>
        <Audio src={staticFile(`short-niveau/${level.id}.mp3`)} />
      </Sequence>
      {taps.map((at, i) => (
        <Sequence key={i} from={at}>
          <Audio src={staticFile('tick.wav')} volume={0.7} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** En haut pendant les phrases : la question et l'avancement (A2 · B1 · C1). */
function Header() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Dans sa séquence, qui commence après l'accroche.
  const at = frame + HOOK;
  const index = SECTIONS.findIndex((x) => at >= x.from && at < x.from + x.dur);
  const shown = spring({ frame: frame + s(0.2), fps, config: { damping: 18 } });
  return (
    <div
      style={{
        position: 'absolute',
        top: 210,
        left: 0,
        right: 0,
        textAlign: 'center',
        opacity: shown,
        transform: `translateY(${(1 - shown) * -40}px)`,
      }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 58, color: '#fff' }}>
        <Rich text={useTexts().header} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 30 }}>
        {LEVELS.map((l, i) => (
          <div
            key={l.id}
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 34,
              padding: '8px 26px',
              borderRadius: 999,
              color: i <= index ? '#fff' : 'rgba(255,255,255,.55)',
              background:
                i === index ? l.color : i < index ? 'rgba(255,255,255,.22)' : 'transparent',
              border: `3px solid ${i <= index ? 'transparent' : 'rgba(255,255,255,.35)'}`,
            }}>
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const sub = spring({ frame: frame - s(0.6), fps, config: { damping: 14 } });
  const out = interpolate(frame, [HOOK - s(0.35), HOOK], [0, 1], clamp);
  const texts = useTexts();
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
        opacity: 1 - out,
        transform: `scale(${1 - out * 0.08})`,
      }}>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 112,
          lineHeight: 1.1,
          color: '#fff',
          textAlign: 'center',
          transform: `scale(${0.7 + pop * 0.3})`,
          opacity: pop,
          textShadow: '0 8px 0 rgba(40,8,110,.35)',
        }}>
        <Rich text={texts.hook} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 52,
          color: '#EEE9FF',
          textAlign: 'center',
          opacity: sub,
          transform: `translateY(${(1 - sub) * 30}px)`,
        }}>
        {texts.hookSub}
      </div>
    </AbsoluteFill>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 80px' }}>
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 116,
          lineHeight: 1.1,
          color: '#fff',
          textAlign: 'center',
          transform: `scale(${0.7 + a * 0.3})`,
          opacity: a,
          textShadow: '0 8px 0 rgba(40,8,110,.35)',
        }}>
        <Rich text={useTexts().outro} />
      </div>
    </AbsoluteFill>
  );
}

/**
 * En bas de chaque écran : le logo et le nom de l'appli, et le badge Google Play.
 * Au-dessus de la zone couverte par l'interface des applis (légende, boutons).
 */
function Footer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const texts = useTexts();
  const shown = spring({ frame: frame - s(0.3), fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: FOOTER_TOP,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 34,
        opacity: shown,
        transform: `translateY(${(1 - shown) * 40}px)`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Img src={staticFile('logo-t.png')} style={{ width: 96, height: 96, borderRadius: 24 }} />
        <div style={{ fontFamily: FONT, color: '#fff' }}>
          <div style={{ fontWeight: 800, fontSize: 50, lineHeight: 1.05 }}>Taleway</div>
          <div style={{ fontWeight: 700, fontSize: 28, color: '#EEE9FF' }}>{texts.tagline}</div>
        </div>
      </div>
      <Img src={staticFile(texts.badge)} style={{ height: 112 }} />
    </div>
  );
}

export function ShortNiveau({ lang = 'fr' }: { lang?: ShortLang }) {
  return (
    <LangContext.Provider value={lang}>
      <ShortNiveauScenes />
    </LangContext.Provider>
  );
}

function ShortNiveauScenes() {
  const frame = useCurrentFrame();
  const musicVolume = (f: number) =>
    interpolate(f, [0, s(1), SHORT_DURATION - s(1.5), SHORT_DURATION], [0, 0.07, 0.07, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg,#8E6CFF 0%,#6C3BE0 55%,#4E14A0 100%)',
        overflow: 'hidden',
      }}>
      {/* Bulles du fond, qui dérivent lentement */}
      {[
        { size: 640, x: 620, y: -220, o: 0.07, v: 0.25 },
        { size: 460, x: -200, y: 1150, o: 0.06, v: -0.2 },
        { size: 300, x: 860, y: 1500, o: 0.05, v: 0.3 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y + Math.sin(frame / 60 + i) * 30 * b.v * 4,
            borderRadius: '50%',
            background: '#fff',
            opacity: b.o,
          }}
        />
      ))}

      <Audio src={staticFile('music.wav')} volume={musicVolume} />

      <Sequence durationInFrames={HOOK}>
        <Hook />
      </Sequence>
      <Sequence from={HOOK} durationInFrames={OUTRO_FROM - HOOK}>
        <Header />
      </Sequence>
      {SECTIONS.map((sec) => (
        <Sequence key={sec.level.id} from={sec.from} durationInFrames={sec.dur}>
          <SentenceCard sec={sec} />
        </Sequence>
      ))}
      <Sequence from={OUTRO_FROM}>
        <Outro />
      </Sequence>
      <Footer />
    </AbsoluteFill>
  );
}
