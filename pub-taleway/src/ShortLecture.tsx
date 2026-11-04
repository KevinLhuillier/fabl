/**
 * Short vertical « Séance de lecture en anglais » : les deux premières pages du chapitre 1 de
 * Write Back (B2) : la main ouvre le livre depuis l'accueil, puis le chapitre 1, et la page 1
 * est lue dans l'écran de lecture de l'appli, redessiné dans un grand téléphone.
 * La main lance l'audio, le texte se surligne au fil de la voix (audio et alignement réels de
 * l'appli), et la lecture s'arrête sur quelques mots difficiles (3 au plus par page) : la main
 * les touche et leur fiche de traduction monte, puis « Compris ». Fin : « Lis la suite sur
 * Taleway » avec le logo et le badge Google Play.
 *
 * Données : node short-lecture-data.mjs (public/short-lecture/, src/short-lecture-data.json).
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import data from './short-lecture-data.json';

export const LECTURE_FPS = 30;
const s = (sec: number) => Math.round(sec * LECTURE_FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const FONT = 'Nunito, sans-serif';

/** Couleurs de l'appli (apps/mobile/src/theme/colors.ts), niveau B2 = soleil. */
const C = {
  ink: '#25223A',
  inkSoft: '#6B6785',
  inkMuted: '#A5A2BA',
  line: '#E6E3F0',
  cloud: '#F7F6FC',
  white: '#FFFFFF',
  violet: '#6C4BF4',
  violetShade: '#4F31C9',
  violetSoft: '#EEE9FF',
  sun: '#FFC233',
  sunShade: '#D99B0A',
  sunSoft: '#FFF5D9',
  mintShade: '#14A079',
  paper: '#FFFCF5',
  backdrop: 'rgba(37,34,58,0.35)',
};

type Word = { text: string; start: number; end: number; p: number };
type Tap = { words: number[]; label: string; pos: string; translation: string; context: string };
type PageData = { n: number; duration: number; words: Word[]; taps: Tap[] };
type Measure = { tops: number[]; lefts: number[]; height: number };
/** Seule la page 1 est lue. */
const PAGES = (data.pages as PageData[]).slice(0, 1);

// ---------------------------------------------------------------------------
// Le téléphone et l'écran (en dp de l'appli : 390 de large, mis à l'échelle)
// ---------------------------------------------------------------------------

const DP_W = 390;
const DP_H = 700;
const SCREEN_W = 760;
const K = SCREEN_W / DP_W;
const SCREEN_H = Math.round(DP_H * K);
const BEZEL = 22;
const PHONE_TOP = 440;

const STATUS_H = 30;
const HEADER_H = 52;
const FOOTER_H = 88;
const BODY_TOP = STATUS_H + HEADER_H;
const BODY_H = DP_H - BODY_TOP - FOOTER_H;
const BODY_PAD = 24;
const CAPTION_H = 17 + 16; // légende + espace avant le texte
const LINE = 34;

/** Cibles de la main (dp, dans l'écran). */
const PLAY = { x: 227, y: DP_H - FOOTER_H / 2 };
const NEXT = { x: 348, y: DP_H - FOOTER_H / 2 };
const GOT_IT = { x: 195, y: DP_H - 24 - 26 };

// ---------------------------------------------------------------------------
// Minutage
// ---------------------------------------------------------------------------

const TRAVEL = s(0.55);
const PAUSE = s(3.6); // main → mot, fiche ouverte, main → « Compris », fiche fermée
const GOT_IT_AT = s(2.9); // dans la pause
const TURN = s(0.6);
const OUTRO = s(4.5);
const LEAD = 0.06; // comme l'appli (LEAD_MS)
const HOLD = 0.6; // le surlignage tient pendant un court silence (HOLD_MS)

// ---------------------------------------------------------------------------
// Avant la lecture : l'accueil (on fait défiler jusqu'à B2, on touche Write Back), la page
// de l'histoire (on touche le chapitre 1), puis l'écran de lecture glisse par-dessus.
// ---------------------------------------------------------------------------

const NAV = {
  swipe1: [s(1.3), s(2.2)] as const,
  swipe2: [s(2.5), s(3.4)] as const,
  book: s(4.2), // la main touche la couverture
  story: s(4.35), // la page de l'histoire glisse
  chapter: s(5.9), // la main touche le chapitre 1
  reader: s(6.05), // l'écran de lecture glisse
};
const SLIDE = s(0.38);
const PLAY_AT = s(7.3);

type Pause = { audio: number; frame: number; tap: number };
type PageTime = {
  play: number; // la main touche lecture
  start: number; // début de l'audio
  pauses: Pause[];
  segments: { audio: number; from: number; dur: number }[];
  end: number; // fin de l'audio
};

const timeline = (() => {
  const pages: PageTime[] = [];
  let at = PLAY_AT;
  const turns: number[] = [];
  PAGES.forEach((page, i) => {
    const play = at;
    const start = play + s(0.3);
    const cuts = page.taps.map((t) => page.words[t.words[t.words.length - 1]!]!.end + 0.12);
    const bounds = [0, ...cuts, page.duration];
    const segments = [];
    const pauses: Pause[] = [];
    let f = start;
    for (let j = 0; j < bounds.length - 1; j++) {
      const dur = Math.round((bounds[j + 1]! - bounds[j]!) * LECTURE_FPS);
      segments.push({ audio: bounds[j]!, from: f, dur });
      f += dur;
      if (j < cuts.length) {
        pauses.push({ audio: cuts[j]!, frame: f, tap: f + TRAVEL });
        f += PAUSE;
      }
    }
    pages.push({ play, start, pauses, segments, end: f });
    if (i < PAGES.length - 1) {
      const next = f + s(0.6) + TRAVEL; // la main touche « page suivante »
      turns.push(next);
      at = next + TURN + s(0.9);
    } else {
      at = f + s(0.8);
    }
  });
  return { pages, turns, outro: at };
})();
export const LECTURE_DURATION = timeline.outro + OUTRO;

/** Position de l'audio de la page (s) à l'image `frame` ; -1 avant le début. */
function audioTime(p: PageTime, frame: number, duration: number) {
  if (frame < p.start) return -1;
  for (let j = 0; j < p.segments.length; j++) {
    const seg = p.segments[j]!;
    if (frame < seg.from) return seg.audio; // dans la pause précédente
    if (frame < seg.from + seg.dur) return seg.audio + (frame - seg.from) / LECTURE_FPS;
  }
  return duration + 1;
}

/** Page affichée et image du passage d'une page à l'autre. */
const pageAt = (frame: number) => timeline.turns.filter((t) => frame >= t + TURN / 2).length;

// ---------------------------------------------------------------------------
// Éléments
// ---------------------------------------------------------------------------

function Rich({ text, color = C.sun }: { text: string; color?: string }) {
  const parts = text.replace(/ ([?!:])/g, ' $1').split('*');
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} style={{ color }}>
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

const HAND = 58; // dp
const TIP = { x: (8 / 24) * HAND, y: (2.3 / 24) * HAND };

function Hand({ x, y, press, opacity }: { x: number; y: number; press: number; opacity: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - TIP.x,
        top: y - TIP.y,
        width: HAND,
        height: HAND,
        opacity,
        transform: `scale(${1 - press * 0.12})`,
        transformOrigin: `${TIP.x}px ${TIP.y}px`,
        filter: 'drop-shadow(0 3px 5px rgba(20,10,60,.35))',
        zIndex: 20,
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

/** Icônes lucide de l'appli (x, chevrons, réglages, lecture, pause, haut-parleur, coche). */
const ICONS: Record<string, string[]> = {
  x: ['M18 6 6 18', 'm6 6 12 12'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  ],
  play: ['M6 3l14 9-14 9V3z'],
  pause: ['M14 4h4v16h-4z', 'M6 4h4v16H6z'],
  speaker: [
    'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z',
    'M16 9a5 5 0 0 1 0 6',
    'M19.364 18.364a9 9 0 0 0 0-12.728',
  ],
  check: ['M20 6 9 17l-5-5'],
  crown: [
    'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z',
    'M5 21h14',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  flame: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  clock: ['M12 6v6l4 2', 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'],
  target: [
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
    'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
    'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  map: [
    'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z',
    'M15 5.764v15',
    'M9 3.236v15',
  ],
  library: ['m16 6 4 14', 'M12 6v14', 'M8 8v12', 'M4 4v16'],
  user: [
    'M18 20a6 6 0 0 0-12 0',
    'M16 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  ],
};

function Ico({
  name,
  size,
  color,
  width = 2.5,
}: {
  name: string;
  size: number;
  color: string;
  width?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round">
      {ICONS[name]!.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Le texte d'une page : surlignage au fil de la voix, mots touchés, défilement. */
function PageText({
  page,
  t,
  selected,
  scroll,
  onMeasure,
}: {
  page: PageData;
  t: number;
  selected: number[];
  scroll: number;
  onMeasure: (m: Measure) => void;
}) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender(`mesure page ${page.n}`));
  useLayoutEffect(() => {
    // Milieu de chaque mot dans le bloc de texte (avant défilement).
    const tops = refs.current.map((el) => (el ? el.offsetTop + el.offsetHeight / 2 : 0));
    const lefts = refs.current.map((el) => (el ? el.offsetLeft + el.offsetWidth * 0.45 : 0));
    onMeasure({ tops, lefts, height: box.current?.offsetHeight ?? 0 });
    continueRender(handle);
    // Une seule mesure par page : la mise en page ne change pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mot lu : le dernier commencé, tant qu'il n'est pas fini depuis plus de HOLD.
  let current = -1;
  for (let i = 0; i < page.words.length; i++) if (page.words[i]!.start <= t + LEAD) current = i;
  const live =
    current >= 0 &&
    t >= 0 &&
    t <= page.duration &&
    (t <= page.words[current]!.end + HOLD ||
      (page.words[current + 1]?.start ?? Infinity) <= t + LEAD);

  const paragraphs: number[][] = [];
  page.words.forEach((w, i) => (paragraphs[w.p] ??= []).push(i));
  return (
    <div ref={box} style={{ position: 'relative', transform: `translateY(${-scroll}px)` }}>
      {paragraphs.map((ids, p) => (
        <p
          key={p}
          style={{
            margin: p ? '16px 0 0' : 0,
            fontFamily: FONT,
            fontWeight: 400,
            fontSize: 21,
            lineHeight: `${LINE}px`,
            color: C.ink,
            textAlign: 'justify',
          }}>
          {ids.map((i) => {
            const isSelected = selected.includes(i);
            const isCurrent = live && i === current;
            const isRead = t >= 0 && (i < current || (i === current && !live && t > page.duration));
            return (
              <React.Fragment key={i}>
                <span
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  style={{
                    borderRadius: 8,
                    padding: '2px 3px',
                    margin: '0 -3px',
                    background: isSelected ? C.sunSoft : isCurrent ? C.sunSoft : 'transparent',
                    color: isSelected ? C.violet : isRead || isCurrent ? C.sunShade : C.ink,
                    boxDecorationBreak: 'clone',
                  }}>
                  {page.words[i]!.text}
                </span>{' '}
              </React.Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/** La fiche de traduction de l'appli (WordSheet). */
function WordSheet({ tap, open }: { tap: Tap; open: number }) {
  return (
    <>
      <div
        style={{ position: 'absolute', inset: 0, background: C.backdrop, opacity: open, zIndex: 8 }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9,
          background: C.white,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          padding: '24px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transform: `translateY(${(1 - open) * 105}%)`,
          fontFamily: FONT,
        }}>
        <div
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: 99,
            background: C.line,
            marginBottom: 4,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 26, lineHeight: '32px', color: C.ink }}>
            {tap.label}
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: C.violetSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ico name="speaker" size={20} color={C.violet} width={2.25} />
          </div>
          <div
            style={{
              background: C.violetSoft,
              color: C.violet,
              fontWeight: 700,
              fontSize: 14,
              padding: '3px 12px',
              borderRadius: 99,
            }}>
            {tap.pos}
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, lineHeight: '26px', color: C.violet }}>
          {tap.translation}
        </div>
        <div
          style={{
            background: C.cloud,
            borderRadius: 16,
            padding: 12,
            color: C.inkSoft,
            fontSize: 16,
            lineHeight: '23px',
          }}>
          {tap.context}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: C.mintShade,
            fontWeight: 700,
            fontSize: 13,
          }}>
          <Ico name="check" size={16} color={C.mintShade} />
          Ajouté à tes mots
        </div>
        <div
          style={{
            height: 52,
            borderRadius: 16,
            background: C.violet,
            borderBottom: `5px solid ${C.violetShade}`,
            color: C.white,
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          COMPRIS
        </div>
      </div>
    </>
  );
}

/** Le bouton audio de l'appli : rond, cerclé de la progression. */
function PageAudio({ progress, playing }: { progress: number; playing: boolean }) {
  const R = 30;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <svg width={64} height={64} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={32} cy={32} r={R} stroke={C.line} strokeWidth={4} fill={C.white} />
        {progress > 0 ? (
          <circle
            cx={32}
            cy={32}
            r={R}
            stroke={C.sun}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            transform="rotate(-90 32 32)"
          />
        ) : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          width: 52,
          height: 52,
          borderRadius: 26,
          background: C.sun,
          borderBottom: `4px solid ${C.sunShade}`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ico name={playing ? 'pause' : 'play'} size={22} color={C.white} />
      </div>
    </div>
  );
}

/** L'écran de lecture, dans le téléphone (dp). */
function ReaderScreen() {
  const frame = useCurrentFrame();
  const index = Math.min(pageAt(frame), PAGES.length - 1);
  const page = PAGES[index]!;
  const time = timeline.pages[index]!;
  const t = audioTime(time, frame, page.duration);
  const [measures, setMeasures] = useState<Record<number, Measure>>({});
  const m = measures[page.n];

  // Défilement : la ligne lue reste vers le tiers de la zone de texte (lissé sur 0,6 s).
  const viewport = BODY_H - BODY_PAD * 2 - CAPTION_H;
  const target = (tt: number) => {
    if (!m || tt < 0) return 0;
    let cur = 0;
    for (let i = 0; i < page.words.length; i++) if (page.words[i]!.start <= tt) cur = i;
    const max = Math.max(0, m.height - viewport + 8);
    return Math.min(max, Math.max(0, (m.tops[cur] ?? 0) - viewport * 0.32));
  };
  let scroll = 0;
  const N = 18;
  for (let k = 0; k < N; k++) scroll += target(audioTime(time, frame - k, page.duration));
  scroll /= N;

  // Mot touché : de la pause en cours (fiche ouverte entre le tap et « Compris »).
  const pause = time.pauses.findIndex((p) => frame >= p.frame && frame < p.frame + PAUSE);
  const tap = pause >= 0 ? page.taps[pause]! : null;
  const pz = pause >= 0 ? time.pauses[pause]! : null;
  const openT = pz
    ? interpolate(frame, [pz.tap + 2, pz.tap + s(0.35)], [0, 1], { ...clamp, easing: ease }) *
      interpolate(frame, [pz.frame + GOT_IT_AT + 2, pz.frame + GOT_IT_AT + s(0.3)], [1, 0], {
        ...clamp,
        easing: ease,
      })
    : 0;
  const selected =
    tap && pz && frame >= pz.tap && frame < pz.frame + GOT_IT_AT + s(0.2) ? tap.words : [];

  // Changement de page : le texte glisse vers la gauche.
  const turn = timeline.turns[0] ?? -1e9;
  const slide =
    frame >= turn && frame < turn + TURN
      ? frame < turn + TURN / 2
        ? -interpolate(frame, [turn, turn + TURN / 2], [0, 1], { ...clamp, easing: ease })
        : 1 - interpolate(frame, [turn + TURN / 2, turn + TURN], [0, 1], { ...clamp, easing: ease })
      : 0;

  // La main : gestes (cible, image du tap), enchaînés quand ils se suivent.
  type Target = { x: number; y: number };
  const wordTarget = (pg: number, k: number): Target => {
    const mm = measures[PAGES[pg]!.n];
    const w = PAGES[pg]!.taps[k]!.words[0]!;
    const y = BODY_TOP + BODY_PAD + CAPTION_H + (mm?.tops[w] ?? 0) - scroll + 6;
    return { x: BODY_PAD + (mm?.lefts[w] ?? 120), y };
  };
  const gestures: { taps: { frame: number; at: Target }[] }[] = [];
  timeline.pages.forEach((p, pg) => {
    gestures.push({ taps: [{ frame: p.play, at: PLAY }] });
    p.pauses.forEach((pp, k) => {
      gestures.push({
        taps: [
          { frame: pp.tap, at: wordTarget(pg, k) },
          { frame: pp.frame + GOT_IT_AT, at: GOT_IT },
        ],
      });
    });
    if (pg < timeline.turns.length)
      gestures.push({ taps: [{ frame: timeline.turns[pg]!, at: NEXT }] });
  });
  let hand: React.ReactNode = null;
  let ripple: React.ReactNode = null;
  for (const g of gestures) {
    const first = g.taps[0]!;
    const last = g.taps[g.taps.length - 1]!;
    if (frame < first.frame - TRAVEL || frame > last.frame + s(0.9)) continue;
    const off = (p: Target) => ({ x: p.x + 160, y: p.y + 260 });
    let pos: Target;
    if (frame <= first.frame) {
      const k = interpolate(frame, [first.frame - TRAVEL, first.frame], [0, 1], {
        ...clamp,
        easing: ease,
      });
      const o = off(first.at);
      pos = { x: o.x + (first.at.x - o.x) * k, y: o.y + (first.at.y - o.y) * k };
    } else if (frame >= last.frame) {
      const k = interpolate(frame, [last.frame + s(0.35), last.frame + s(0.9)], [0, 1], {
        ...clamp,
        easing: ease,
      });
      const o = off(last.at);
      pos = { x: last.at.x + (o.x - last.at.x) * k, y: last.at.y + (o.y - last.at.y) * k };
    } else {
      pos = first.at;
      for (let i = 1; i < g.taps.length; i++) {
        const a = g.taps[i - 1]!;
        const b = g.taps[i]!;
        if (frame > a.frame && frame <= b.frame) {
          const k = interpolate(frame, [b.frame - TRAVEL, b.frame], [0, 1], {
            ...clamp,
            easing: ease,
          });
          pos = { x: a.at.x + (b.at.x - a.at.x) * k, y: a.at.y + (b.at.y - a.at.y) * k };
        }
      }
    }
    const press = Math.max(
      ...g.taps.map((tp) =>
        interpolate(frame, [tp.frame - 3, tp.frame, tp.frame + 4], [0, 1, 0], clamp),
      ),
    );
    const fade = interpolate(
      frame,
      [first.frame - TRAVEL, first.frame - TRAVEL + 6],
      [0, 1],
      clamp,
    );
    hand = <Hand x={pos.x} y={pos.y} press={press} opacity={fade} />;
    const tp = g.taps.find((x) => frame >= x.frame && frame < x.frame + s(0.5));
    if (tp) {
      const r = (frame - tp.frame) / s(0.5);
      ripple = (
        <div
          style={{
            position: 'absolute',
            left: tp.at.x - 22,
            top: tp.at.y - 22,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: `3px solid ${C.violet}`,
            background: 'rgba(108,75,244,.25)',
            transform: `scale(${0.6 + r * 1.6})`,
            opacity: 1 - r,
            zIndex: 19,
          }}
        />
      );
    }
  }

  const playing = t >= 0 && t <= page.duration && pause < 0 && frame >= time.start;
  const progress = t < 0 ? 0 : Math.min(1, t / page.duration);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: C.cloud,
        overflow: 'hidden',
        fontFamily: FONT,
      }}>
      {/* Barre d'état */}
      <div
        style={{
          height: STATUS_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 30px 0',
          fontWeight: 800,
          fontSize: 13,
          color: C.ink,
        }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {[5, 7, 9, 11].map((h) => (
            <i
              key={h}
              style={{ width: 3, height: h, borderRadius: 1, background: C.ink, display: 'block' }}
            />
          ))}
          <i
            style={{
              marginLeft: 4,
              width: 20,
              height: 10,
              borderRadius: 3,
              border: `1.5px solid ${C.ink}`,
              display: 'block',
              padding: 1,
            }}>
            <i
              style={{
                display: 'block',
                width: '70%',
                height: '100%',
                background: C.ink,
                borderRadius: 1,
              }}
            />
          </i>
        </span>
      </div>
      {/* En-tête : fermer, progression, page */}
      <div
        style={{
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
        }}>
        <Ico name="x" size={28} color={C.inkMuted} />
        <div
          style={{ flex: 1, height: 16, borderRadius: 99, background: C.line, overflow: 'hidden' }}>
          <div
            style={{
              width: `${(page.n / data.pageCount) * 100}%`,
              height: '100%',
              background: C.sun,
              borderRadius: 99,
            }}
          />
        </div>
        <div
          style={{
            minWidth: 40,
            textAlign: 'right',
            fontWeight: 700,
            fontSize: 13,
            color: C.sunShade,
          }}>
          {page.n}/{data.pageCount}
        </div>
      </div>
      {/* Texte */}
      <div
        style={{
          position: 'absolute',
          top: BODY_TOP,
          left: 0,
          right: 0,
          height: BODY_H,
          overflow: 'hidden',
          padding: BODY_PAD,
          transform: `translateX(${slide * 110}%)`,
          opacity: 1 - Math.abs(slide) * 0.6,
        }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            lineHeight: '17px',
            color: C.sunShade,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
          Chapitre 1 · {data.chapterTitle} · Page {page.n}/{data.pageCount}
        </div>
        <div style={{ height: viewport, overflow: 'hidden', position: 'relative' }}>
          <PageText
            key={page.n}
            page={page}
            t={t}
            selected={selected}
            scroll={scroll}
            onMeasure={(mm) => setMeasures((old) => ({ ...old, [page.n]: mm }))}
          />
        </div>
      </div>
      {/* Pied : page précédente, réglages, audio, page suivante */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: FOOTER_H,
          borderTop: `2px solid ${C.line}`,
          background: C.white,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 8,
          boxSizing: 'border-box',
        }}>
        <div style={{ flex: 1, display: 'flex' }}>
          {page.n > 1 ? <Ico name="left" size={36} color={C.sunShade} /> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              border: `2px solid ${C.line}`,
              background: C.cloud,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ico name="settings" size={24} color={C.inkSoft} />
          </div>
          <PageAudio progress={progress} playing={playing} />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Ico name="right" size={36} color={C.sunShade} />
        </div>
      </div>
      {tap ? <WordSheet tap={tap} open={openT} /> : null}
      {ripple}
      {hand}
    </div>
  );
}

const LEVEL_C: Record<string, { solid: string; shade: string; soft: string; name: string }> = {
  A2: { solid: '#3BA9FF', shade: '#1A85D9', soft: '#E1F2FF', name: 'Élémentaire' },
  B1: { solid: '#6C4BF4', shade: '#4F31C9', soft: '#EEE9FF', name: 'Intermédiaire' },
  B2: { solid: C.sun, shade: C.sunShade, soft: C.sunSoft, name: 'Intermédiaire avancé' },
};
/** « 19 015 » : séparateur de milliers français. */
const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const minutes = (words: number) => Math.max(1, Math.round(words / 150));

// Mise en page de l'accueil (dp, dans le contenu qui défile).
const HOME_SHELF_TOP = 260;
const HOME_SHELF_STEP = 382;
const TILE_W = 136;
const TILE_GAP = 16;
const COVER_H = 204;
const HOME_SCROLL = [0, 470, 944];
const BOOK_INDEX = data.shelves[2]!.stories.findIndex((st) => st.slug === data.slug);
const BOOK_AT = {
  x: 24 + BOOK_INDEX * (TILE_W + TILE_GAP) + TILE_W / 2,
  y: STATUS_H + HOME_SHELF_TOP + 2 * HOME_SHELF_STEP - HOME_SCROLL[2]! + 40 + COVER_H / 2,
};
// Page de l'histoire : la ligne du chapitre 1 dans le sommaire.
const TOC_TOP = 546;
const ROW_H = 78;
const CHAPTER_AT = { x: 200, y: TOC_TOP + ROW_H / 2 + 4 };

function homeScroll(frame: number) {
  const [a1, b1] = NAV.swipe1;
  const [a2, b2] = NAV.swipe2;
  const k1 = interpolate(frame, [a1, b1], [0, 1], { ...clamp, easing: ease });
  const k2 = interpolate(frame, [a2, b2], [0, 1], { ...clamp, easing: ease });
  return (
    HOME_SCROLL[0]! +
    (HOME_SCROLL[1]! - HOME_SCROLL[0]!) * k1 +
    (HOME_SCROLL[2]! - HOME_SCROLL[1]!) * k2
  );
}

/** La main de la navigation : deux glissés vers le haut, la couverture, le chapitre 1. */
function NavHand() {
  const frame = useCurrentFrame();
  const START = { x: 250, y: 600 };
  const OFF = { x: 340, y: 860 };
  const mix = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => ({
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
  });
  const move = (from: number, to: number) =>
    interpolate(frame, [from, to], [0, 1], { ...clamp, easing: ease });
  const [a1, b1] = NAV.swipe1;
  const [a2, b2] = NAV.swipe2;
  if (frame < a1 - TRAVEL || frame > NAV.chapter + s(0.9)) return null;
  let pos: { x: number; y: number };
  let press = 0;
  const drag = (a: number, b: number, from: number) => ({
    x: START.x,
    y: START.y - (homeScroll(frame) - from) * 1.0,
  });
  if (frame < a1) pos = mix(OFF, START, move(a1 - TRAVEL, a1));
  else if (frame <= b1) {
    pos = drag(a1, b1, HOME_SCROLL[0]!);
    press = 1;
  } else if (frame < a2)
    pos = mix(
      { x: START.x, y: START.y - (HOME_SCROLL[1]! - HOME_SCROLL[0]!) },
      START,
      move(b1, a2),
    );
  else if (frame <= b2) {
    pos = drag(a2, b2, HOME_SCROLL[1]!);
    press = 1;
  } else if (frame <= NAV.book) {
    pos = mix(
      { x: START.x, y: START.y - (HOME_SCROLL[2]! - HOME_SCROLL[1]!) },
      BOOK_AT,
      move(b2 + 3, NAV.book),
    );
  } else if (frame <= NAV.chapter)
    pos = mix(BOOK_AT, CHAPTER_AT, move(NAV.chapter - TRAVEL - s(0.3), NAV.chapter));
  else pos = mix(CHAPTER_AT, OFF, move(NAV.chapter + s(0.3), NAV.chapter + s(0.9)));
  // Appui : pendant les glissés, et un tap sur la couverture et le chapitre.
  for (const t of [NAV.book, NAV.chapter])
    press = Math.max(press, interpolate(frame, [t - 3, t, t + 4], [0, 1, 0], clamp));
  const fade = interpolate(frame, [a1 - TRAVEL, a1 - TRAVEL + 6], [0, 1], clamp);
  const tap = [NAV.book, NAV.chapter].find((t) => frame >= t && frame < t + s(0.5));
  const at = tap === NAV.book ? BOOK_AT : CHAPTER_AT;
  return (
    <>
      {tap !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: at.x - 22,
            top: at.y - 22,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: `3px solid ${C.violet}`,
            background: 'rgba(108,75,244,.25)',
            transform: `scale(${0.6 + ((frame - tap) / s(0.5)) * 1.6})`,
            opacity: 1 - (frame - tap) / s(0.5),
            zIndex: 29,
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
        <Hand x={pos.x} y={pos.y} press={press * 0.6} opacity={fade} />
      </div>
    </>
  );
}

function StatusBar({ color = C.ink }: { color?: string }) {
  return (
    <div
      style={{
        height: STATUS_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 30px 0',
        fontWeight: 800,
        fontSize: 13,
        color,
        fontFamily: FONT,
      }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {[5, 7, 9, 11].map((h) => (
          <i
            key={h}
            style={{ width: 3, height: h, borderRadius: 1, background: color, display: 'block' }}
          />
        ))}
        <i
          style={{
            marginLeft: 4,
            width: 20,
            height: 10,
            borderRadius: 3,
            border: `1.5px solid ${color}`,
            display: 'block',
            padding: 1,
          }}>
          <i
            style={{
              display: 'block',
              width: '70%',
              height: '100%',
              background: color,
              borderRadius: 1,
            }}
          />
        </i>
      </span>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  return (
    <div
      style={{
        background: LEVEL_C[level]!.solid,
        color: '#fff',
        fontWeight: 900,
        fontSize: 13,
        lineHeight: '17px',
        padding: '3px 9px',
        borderRadius: 9,
        borderBottom: `2px solid ${LEVEL_C[level]!.shade}`,
      }}>
      {level}
    </div>
  );
}

function Tile({
  story,
  level,
}: {
  story: (typeof data.shelves)[number]['stories'][number];
  level: string;
}) {
  return (
    <div style={{ width: TILE_W, flexShrink: 0, fontFamily: FONT }}>
      <div style={{ position: 'relative', width: TILE_W, height: COVER_H }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '3px 3px 0 #EDE5D3, 0 4px 10px rgba(37,34,58,.18)',
          }}>
          <Img
            src={staticFile(`short-lecture/covers/${story.slug}.webp`)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ position: 'absolute', top: 8, left: 14 }}>
          <LevelBadge level={level} />
        </div>
        {story.premium ? (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 26,
              height: 26,
              borderRadius: 13,
              background: C.sun,
              border: '2px solid #fff',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ico name="crown" size={13} color="#fff" />
          </div>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 12,
          fontWeight: 700,
          fontSize: 16,
          lineHeight: '21px',
          color: C.ink,
          height: 42,
          overflow: 'hidden',
        }}>
        {story.title}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: '17px', color: C.inkSoft }}>
        {minutes(story.words)} min · {story.chapters} chapitres
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 99, background: C.line }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: C.inkSoft }}>0 %</span>
      </div>
    </div>
  );
}

function HomeScreen() {
  const frame = useCurrentFrame();
  const scroll = homeScroll(frame);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: C.cloud,
        overflow: 'hidden',
        fontFamily: FONT,
      }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: STATUS_H,
          transform: `translateY(${-scroll}px)`,
        }}>
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', height: 40 }}>
          <div style={{ flex: 1, fontWeight: 900, fontSize: 26, color: C.ink }}>
            Que lire aujourd’hui ?
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: `2px solid ${C.line}`,
              background: C.white,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ico name="moon" size={20} color={C.inkSoft} />
          </div>
        </div>
        <div style={{ padding: '24px 24px 0', display: 'flex', gap: 10, height: 36 }}>
          {[
            { icon: 'flame', label: '3', color: '#D46A06', bg: '#FFEEDC' },
            { icon: 'clock', label: '2 h 15', color: C.sunShade, bg: C.sunSoft },
          ].map((p) => (
            <div
              key={p.icon}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                borderRadius: 99,
                background: p.bg,
                color: p.color,
                fontWeight: 900,
                fontSize: 16,
              }}>
              <Ico name={p.icon} size={18} color={p.color} />
              {p.label}
            </div>
          ))}
        </div>
        <div
          style={{
            margin: '16px 24px 0',
            height: 96,
            boxSizing: 'border-box',
            borderRadius: 22,
            border: `2px solid ${C.line}`,
            borderBottomWidth: 5,
            background: C.white,
            padding: '18px 18px',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico name="target" size={20} color={C.sunShade} />
            <span style={{ flex: 1, fontWeight: 800, fontSize: 17, color: C.ink }}>
              Objectif du jour
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.inkSoft }}>4 / 10 min</span>
          </div>
          <div style={{ marginTop: 14, height: 14, borderRadius: 99, background: C.line }}>
            <div style={{ width: '40%', height: '100%', borderRadius: 99, background: C.sun }} />
          </div>
        </div>
        {data.shelves.map((shelf, i) => (
          <div
            key={shelf.level}
            style={{
              position: 'absolute',
              top: HOME_SHELF_TOP + i * HOME_SHELF_STEP,
              left: 24,
              right: 0,
            }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 28,
                paddingRight: 24,
              }}>
              <LevelBadge level={shelf.level} />
              <span style={{ flex: 1, fontWeight: 800, fontSize: 20, color: C.ink }}>
                {LEVEL_C[shelf.level]!.name}
              </span>
              <span style={{ fontWeight: 700, fontSize: 13, color: C.inkSoft }}>
                {shelf.stories.length} histoires
              </span>
            </div>
            <div style={{ display: 'flex', gap: TILE_GAP, marginTop: 12 }}>
              {shelf.stories.slice(0, 3).map((st) => (
                <Tile key={st.slug} story={st} level={shelf.level} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: C.cloud }}>
        <StatusBar />
      </div>
      {/* Barre d'onglets */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 64,
          background: C.white,
          borderTop: `2px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}>
        {[
          { icon: 'map', label: 'Histoires', on: true },
          { icon: 'library', label: 'Mes mots', on: false },
          { icon: 'user', label: 'Profil', on: false },
        ].map((t) => (
          <div
            key={t.icon}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Ico name={t.icon} size={24} color={t.on ? C.violet : C.inkMuted} />
            <span style={{ fontWeight: 800, fontSize: 11, color: t.on ? C.violet : C.inkMuted }}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tally({ n, color }: { n: number; color: string }) {
  return (
    <div style={{ width: 40, display: 'flex', gap: 4, justifyContent: 'center' }}>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          style={{ display: 'block', width: 5, height: 22, borderRadius: 3, background: color }}
        />
      ))}
    </div>
  );
}

function StoryScreen() {
  const lvl = LEVEL_C[data.level]!;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: C.cloud,
        overflow: 'hidden',
        fontFamily: FONT,
      }}>
      <StatusBar />
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}>
        <Ico name="left" size={30} color={C.inkMuted} />
        <div
          style={{
            background: lvl.solid,
            color: '#fff',
            fontWeight: 800,
            fontSize: 15,
            padding: '6px 14px',
            borderRadius: 99,
          }}>
          {data.level} · {lvl.name}
        </div>
      </div>
      <div
        style={{
          margin: '10px 24px 0',
          boxSizing: 'border-box',
          height: TOC_TOP - 20 - 96 - 40,
          borderRadius: 22,
          border: `2px solid ${lvl.solid}`,
          borderBottomWidth: 5,
          background: lvl.soft,
          padding: 16,
        }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <Img
            src={staticFile(`short-lecture/covers/${data.slug}.webp`)}
            style={{
              width: 104,
              height: 156,
              borderRadius: 8,
              objectFit: 'cover',
              boxShadow: '3px 3px 0 #EDE5D3',
            }}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 8,
            }}>
            <div style={{ fontWeight: 900, fontSize: 28, lineHeight: '32px', color: C.ink }}>
              {data.title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 13,
                color: lvl.shade,
              }}>
              <Ico name="book" size={16} color={lvl.shade} />
              {num(data.words)} mots · {data.chapters.length} chapitres
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 13,
                color: lvl.shade,
              }}>
              <Ico name="clock" size={16} color={lvl.shade} />≈ {minutes(data.words)} min
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            lineHeight: '20px',
            color: C.inkSoft,
            fontWeight: 400,
          }}>
          {data.summary}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1, height: 12, borderRadius: 99, background: C.line }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: lvl.shade }}>0 %</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: TOC_TOP - 38,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: lvl.shade,
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 3,
        }}>
        <i style={{ display: 'block', width: 40, height: 2, background: lvl.solid }} />◆ SOMMAIRE ◆
        <i style={{ display: 'block', width: 40, height: 2, background: lvl.solid }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: TOC_TOP,
          left: 24,
          right: 24,
          borderRadius: 22,
          border: '2px solid #EDE5D3',
          background: C.paper,
          overflow: 'hidden',
        }}>
        {data.chapters.slice(0, 3).map((ch, i) => (
          <div
            key={ch.title}
            style={{
              position: 'relative',
              height: ROW_H,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 16px 0 6px',
              background: i === 0 ? lvl.soft : 'transparent',
              borderTop: i ? '2px dashed #EDE5D3' : 'none',
            }}>
            <Tally n={i + 1} color={lvl.solid} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: C.ink }}>{ch.title}</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: i === 0 ? lvl.shade : C.inkMuted,
                  letterSpacing: i === 0 ? 0.5 : 0,
                }}>
                {i === 0 ? 'COMMENCER LA LECTURE' : `${ch.pages} pages · ${num(ch.words)} mots`}
              </div>
            </div>
            {i === 0 ? (
              <svg width={24} height={32} style={{ position: 'absolute', right: 22, top: 0 }}>
                <path d="M0 0h24v32l-12-8-12 8z" fill={lvl.solid} />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** L'appli dans le téléphone : accueil, histoire, puis lecture, chaque écran glissant sur le précédent. */
function AppScreens() {
  const frame = useCurrentFrame();
  const slideIn = (at: number) =>
    1 - interpolate(frame, [at, at + SLIDE], [0, 1], { ...clamp, easing: ease });
  const story = slideIn(NAV.story);
  const reader = slideIn(NAV.reader);
  return (
    <>
      <div
        style={{ position: 'absolute', inset: 0, transform: `translateX(${-(1 - story) * 30}%)` }}>
        <HomeScreen />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${story * 100}%)`,
          boxShadow: '-10px 0 20px rgba(0,0,0,.12)',
        }}>
        <StoryScreen />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${reader * 100}%)`,
          boxShadow: '-10px 0 20px rgba(0,0,0,.12)',
        }}>
        <ReaderScreen />
      </div>
      <NavHand />
    </>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const W = SCREEN_W + BEZEL * 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: (1080 - W) / 2,
        top: PHONE_TOP,
        width: W,
        height: SCREEN_H + BEZEL * 2,
        padding: BEZEL,
        boxSizing: 'border-box',
        borderRadius: 96,
        background: '#16131f',
        boxShadow: '0 40px 80px rgba(30,6,80,.55), inset 0 0 0 3px #3a3550',
        transform: `translateY(${(1 - up) * 500}px)`,
      }}>
      <div
        style={{
          position: 'absolute',
          right: -6,
          top: 300,
          width: 8,
          height: 130,
          borderRadius: 4,
          background: '#2a2638',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -6,
          top: 470,
          width: 8,
          height: 200,
          borderRadius: 4,
          background: '#2a2638',
        }}
      />
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 76,
          overflow: 'hidden',
          position: 'relative',
        }}>
        <div
          style={{
            width: DP_W,
            height: DP_H,
            transform: `scale(${K})`,
            transformOrigin: '0 0',
            position: 'relative',
          }}>
          {children}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 16,
            width: 26,
            height: 26,
            marginLeft: -13,
            borderRadius: 13,
            background: '#0b0a10',
            boxShadow: 'inset 0 0 0 4px #1f1c2b',
          }}
        />
      </div>
    </div>
  );
}

function Header() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 14 } });
  const b = spring({ frame: frame - s(0.25), fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: FONT,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          opacity: a,
          transform: `translateY(${(1 - a) * -30}px)`,
        }}>
        <Img src={staticFile('logo-t.png')} style={{ width: 70, height: 70, borderRadius: 18 }} />
        <span style={{ fontWeight: 800, fontSize: 46, color: '#fff' }}>Taleway</span>
      </div>
      <div
        style={{
          marginTop: 26,
          fontWeight: 900,
          fontSize: 74,
          lineHeight: 1.08,
          color: '#fff',
          textShadow: '0 6px 0 rgba(40,8,110,.35)',
          opacity: b,
          transform: `scale(${0.85 + b * 0.15})`,
        }}>
        <Rich text="Séance de lecture *en anglais*" />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 22,
          marginTop: 22,
          opacity: b,
        }}>
        <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 50, color: '#fff' }}>
          {data.title}
        </span>
        <span
          style={{
            background: C.sun,
            color: C.ink,
            fontWeight: 800,
            fontSize: 34,
            padding: '6px 24px',
            borderRadius: 999,
            boxShadow: `0 6px 0 ${C.sunShade}`,
          }}>
          Niveau {data.level}
        </span>
      </div>
    </div>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = interpolate(frame, [0, s(0.5)], [0, 1], clamp);
  const a = spring({ frame: frame - s(0.3), fps, config: { damping: 12 } });
  const b = spring({ frame: frame - s(0.8), fps, config: { damping: 14 } });
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg,#8E6CFF 0%,#6C3BE0 55%,#4E14A0 100%)',
        opacity: bg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        padding: '0 80px',
      }}>
      <Img
        src={staticFile('logo-t.png')}
        style={{
          width: 220,
          height: 220,
          borderRadius: 52,
          opacity: a,
          transform: `scale(${0.6 + a * 0.4})`,
          boxShadow: '0 20px 50px rgba(30,6,80,.45)',
        }}
      />
      <div
        style={{
          marginTop: 60,
          fontWeight: 900,
          fontSize: 100,
          lineHeight: 1.1,
          color: '#fff',
          textAlign: 'center',
          textShadow: '0 8px 0 rgba(40,8,110,.35)',
          opacity: a,
          transform: `translateY(${(1 - a) * 30}px)`,
        }}>
        <Rich text="Lis la suite sur *Taleway*" />
      </div>
      <Img
        src={staticFile('badges/fr.png')}
        style={{
          marginTop: 70,
          height: 150,
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function ShortLecture() {
  const frame = useCurrentFrame();
  const music = (f: number) =>
    interpolate(f, [0, s(1), LECTURE_DURATION - s(2), LECTURE_DURATION], [0, 0.05, 0.05, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(160deg,#8E6CFF 0%,#6C3BE0 55%,#4E14A0 100%)',
        overflow: 'hidden',
      }}>
      {[
        { size: 640, x: 620, y: -220, o: 0.07 },
        { size: 460, x: -220, y: 900, o: 0.06 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y + Math.sin(frame / 60 + i) * 24,
            borderRadius: '50%',
            background: '#fff',
            opacity: b.o,
          }}
        />
      ))}
      <Audio src={staticFile('music.wav')} volume={music} loop />
      <Header />
      <Phone>
        <AppScreens />
      </Phone>
      {timeline.pages.map((p, i) =>
        p.segments.map((seg, j) => (
          <Sequence key={`${i}-${j}`} from={seg.from} durationInFrames={seg.dur}>
            <Audio
              src={staticFile(`short-lecture/page-${PAGES[i]!.n}.mp3`)}
              startFrom={Math.round(seg.audio * LECTURE_FPS)}
            />
          </Sequence>
        )),
      )}
      {[
        ...timeline.pages.flatMap((p) => [
          p.play,
          ...p.pauses.flatMap((pp) => [pp.tap, pp.frame + GOT_IT_AT]),
        ]),
        ...timeline.turns,
      ].map((f) => (
        <Sequence key={f} from={f}>
          <Audio src={staticFile('tick.wav')} volume={0.6} />
        </Sequence>
      ))}
      <Sequence from={timeline.outro}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
}
