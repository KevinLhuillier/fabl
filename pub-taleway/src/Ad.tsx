import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import library from '../clips/1-library.json';
import reader from '../clips/2-reader.json';
import listen from '../clips/3-listen.json';
import trueFalse from '../clips/4a-truefalse.json';
import fill from '../clips/4b-fill.json';

export const FPS = 60;
/** Durées d'animation écrites en images à 30 i/s, converties à la cadence de la vidéo. */
const k = (frames30: number) => (frames30 * FPS) / 30;
const s = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const C = {
  violet: '#6C4BF4',
  lilac: '#B9A8FF',
  mint: '#3FE0B0',
  ink: '#16132A',
  deep: '#241B5C',
};
const FONT = 'Nunito, sans-serif';
/** Fondu enchaîné entre deux clips dans le téléphone. */
const XFADE = k(6);
/** Avance de la 1re scène, visible pendant que le téléphone monte. */
const FIRST_LEAD = k(12);

type Clip = { duration: number; taps: number[]; audio: { t: number; pos: number }[] };

type Scene = {
  clip: string;
  /** Début et durée dans la vidéo (images). */
  from: number;
  dur: number;
  /** Point du clip montré au début de la scène (s). */
  start: number;
  /** Instants des taps dans le clip (s), pour les « tick ». */
  taps: number[];
  /** Début de la lecture audio dans le clip (s) : la narration y est calée. */
  audioAt?: number;
  audioPos?: number;
};

type Caption = { from: number; dur: number; text: string };

export type Plan = {
  vertical: boolean;
  duration: number;
  hookEnd: number;
  outroFrom: number;
  scenes: Scene[];
  captions: Caption[];
};

/** Une scène : `start` et `dur` en secondes ; un texte peut couvrir plusieurs scènes. */
type Shot = { clip: string; data: Clip; start: number; dur: number; narration?: boolean };

/**
 * Enchaîne les plans après l'accroche (3 s) et finit par le logo.
 * `groups` : chaque groupe de plans partage un texte.
 */
function plan(vertical: boolean, groups: { text: string; shots: Shot[] }[], outro: number): Plan {
  const hookEnd = s(3);
  let at = hookEnd;
  const scenes: Scene[] = [];
  const captions: Caption[] = [];
  for (const g of groups) {
    const capFrom = at;
    for (const sh of g.shots) {
      // Jamais au-delà de la fin du clip.
      const dur = Math.min(sh.dur, sh.data.duration - sh.start - 0.1);
      const a = sh.narration ? sh.data.audio[0] : undefined;
      scenes.push({
        clip: sh.clip,
        from: at,
        dur: s(dur),
        start: sh.start,
        taps: sh.data.taps,
        audioAt: a?.t,
        audioPos: a?.pos,
      });
      at += s(dur);
    }
    captions.push({ from: capFrom, dur: at - capFrom, text: g.text });
  }
  return { vertical, hookEnd, outroFrom: at, duration: at + s(outro), scenes, captions };
}

const TEXTS = {
  library: 'Lis des histoires en anglais *adaptées à ton niveau.*',
  reader: 'Tu ne comprends pas un mot ? Clique dessus, *c’est traduit.*',
  listen: 'Ou laisse-toi *raconter* l’histoire.',
  review: 'Puis révise *les mots traduits.*',
};

const tap = (c: Clip) => c.taps[0]!;
const lastTap = (c: Clip) => c.taps[c.taps.length - 1]!;

export const LANDSCAPE: Plan = plan(
  false,
  [
    { text: TEXTS.library, shots: [{ clip: '1-library', data: library, start: 1.2, dur: 11 }] },
    { text: TEXTS.reader, shots: [{ clip: '2-reader', data: reader, start: tap(reader) - 2.6, dur: 8 }] },
    {
      text: TEXTS.listen,
      shots: [{ clip: '3-listen', data: listen, start: tap(listen) - 1.2, dur: 10.5, narration: true }],
    },
    {
      text: TEXTS.review,
      shots: [
        { clip: '4a-truefalse', data: trueFalse, start: tap(trueFalse) - 4.0, dur: 5.6 },
        { clip: '4b-fill', data: fill, start: tap(fill) - 1.4, dur: lastTap(fill) - tap(fill) + 3.6 },
      ],
    },
  ],
  5,
);

export const VERTICAL: Plan = plan(
  true,
  [
    { text: TEXTS.library, shots: [{ clip: '1-library', data: library, start: 1.2, dur: 7 }] },
    { text: TEXTS.reader, shots: [{ clip: '2-reader', data: reader, start: tap(reader) - 1.8, dur: 6.5 }] },
    {
      text: TEXTS.listen,
      shots: [{ clip: '3-listen', data: listen, start: tap(listen) - 0.9, dur: 7.5, narration: true }],
    },
    {
      text: TEXTS.review,
      shots: [
        { clip: '4a-truefalse', data: trueFalse, start: tap(trueFalse) - 2.8, dur: 4.2 },
        { clip: '4b-fill', data: fill, start: tap(fill) - 1.0, dur: lastTap(fill) - tap(fill) + 3.0 },
      ],
    },
  ],
  3.5,
);

// ---------- texte ----------

/** Mots du texte ; ceux entre *astérisques* sont mis en couleur. */
function words(caption: string) {
  const out: { w: string; hi: boolean }[] = [];
  let hi = false;
  for (const part of caption.split(/(\*)/)) {
    if (part === '*') hi = !hi;
    // Espaces insécables devant « ? » et « : » : jamais seuls en début de ligne.
    else for (const w of part.replace(/ ([?:!])/g, ' $1').split(' ').filter(Boolean)) out.push({ w, hi });
  }
  return out;
}

const CaptionText: React.FC<{ text: string; dur: number; size: number; align: 'left' | 'center' }> = ({
  text,
  dur,
  size,
  align,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [dur - k(8), dur], [1, 0], clamp);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.14,
        color: 'white',
        textAlign: align,
        opacity: out,
        transform: `translateY(${(1 - out) * -16}px)`,
        textShadow: '0 4px 24px rgba(0,0,0,.25)',
      }}>
      {words(text).map(({ w, hi }, i) => {
        const p = spring({ frame: frame - k(4) - i * k(3), fps, config: { damping: 16, mass: 0.6 } });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginRight: size * 0.26,
              opacity: p,
              transform: `translateY(${(1 - p) * 28}px)`,
              color: hi ? C.mint : 'white',
            }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// ---------- téléphone ----------

const Phone: React.FC<{ height: number; children: React.ReactNode }> = ({ height, children }) => {
  const bezel = Math.round(height * 0.016);
  const screenH = height - bezel * 2;
  const screenW = Math.round((screenH * 390) / 844);
  return (
    <div
      style={{
        position: 'relative',
        width: screenW + bezel * 2,
        height,
        borderRadius: height * 0.068,
        background: '#0D0B16',
        padding: bezel,
        boxShadow: '0 40px 90px rgba(8,4,30,.55), 0 0 0 2px rgba(255,255,255,.08) inset',
      }}>
      <div
        style={{
          position: 'relative',
          width: screenW,
          height: screenH,
          borderRadius: height * 0.054,
          overflow: 'hidden',
          background: '#F7F6FC',
        }}>
        {children}
      </div>
    </div>
  );
};

/** Clip d'une scène, avec fondu d'entrée pour l'enchaînement. */
const ClipView: React.FC<{ scene: Scene; first: boolean }> = ({ scene, first }) => {
  const frame = useCurrentFrame();
  // La 1re scène commence pendant que le téléphone monte, sans fondu.
  const lead = first ? FIRST_LEAD : XFADE;
  const opacity = first ? 1 : interpolate(frame, [0, XFADE], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(`clips/${scene.clip}.mp4`)}
        startFrom={Math.max(0, s(scene.start) - lead)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};

// ---------- séquences ----------

const Hook: React.FC<{ vertical: boolean; end: number }> = ({ vertical, end }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = 'He knew she was lying.';
  const typed = Math.round(interpolate(frame, [k(8), k(40)], [0, line.length], clamp));
  const cursorOn = frame < k(44) || Math.floor(frame / k(8)) % 2 === 0;
  const q = spring({ frame: frame - k(48), fps, config: { damping: 18 } });
  const out = interpolate(frame, [end - k(10), end], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out, padding: 60 }}>
      <div
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          fontSize: vertical ? 80 : 104,
          color: 'white',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>
        {line.slice(0, typed)}
        <span style={{ opacity: cursorOn ? 1 : 0, color: C.lilac, fontStyle: 'normal' }}>|</span>
      </div>
      <div
        style={{
          marginTop: vertical ? 70 : 54,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: vertical ? 74 : 60,
          color: C.lilac,
          opacity: q,
          transform: `translateY(${(1 - q) * 24}px)`,
          textAlign: 'center',
        }}>
        Tu comprends cette phrase{' '}?
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - k(6), fps, config: { damping: 12, mass: 0.8 } });
  const title = spring({ frame: frame - k(16), fps, config: { damping: 18 } });
  const tag = spring({ frame: frame - k(26), fps, config: { damping: 18 } });
  const size = vertical ? 300 : 260;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <Img
        src={staticFile('logo.png')}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          transform: `scale(${0.6 + 0.4 * logo})`,
          opacity: logo,
          boxShadow: '0 30px 80px rgba(8,4,30,.5)',
        }}
      />
      <div
        style={{
          marginTop: vertical ? 70 : 52,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 84,
          color: 'white',
          textAlign: 'center',
          lineHeight: 1.1,
          opacity: title,
          transform: `translateY(${(1 - title) * 26}px)`,
        }}>
        English Stories with {vertical ? <br /> : null}
        <span style={{ color: C.lilac }}>Taleway</span>
      </div>
      <div
        style={{
          marginTop: vertical ? 40 : 26,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: vertical ? 56 : 48,
          letterSpacing: 2,
          color: C.mint,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 20}px)`,
        }}>
        Read. Listen. Understand.
      </div>
    </AbsoluteFill>
  );
};

/** Fond aux couleurs de Taleway : dégradé violet profond et halo derrière le téléphone. */
const Background: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / k(90)) * 30;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${vertical ? 170 : 125}deg, ${C.ink} 0%, ${C.deep} 55%, #3B26A8 100%)` }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: vertical ? '58%' : '50%',
          width: 1100,
          height: 1100,
          marginLeft: -550 + drift,
          marginTop: -550,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.violet}66 0%, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- son ----------

/** Volume de la musique : baissée sous la voix (~20 % pendant la narration), fondus. */
function musicVolume(f: number, p: Plan) {
  let v = 0.55;
  const n = p.scenes.find((sc) => sc.audioAt !== undefined);
  if (n) {
    const a = n.from;
    const b = n.from + n.dur;
    v *= interpolate(f, [a - k(8), a, b - k(4), b + k(8)], [1, 0.2, 0.2, 1], clamp);
  }
  // Accroche parlée.
  v *= interpolate(f, [k(6), k(12), k(62), k(74)], [1, 0.55, 0.55, 1], clamp);
  v *= interpolate(f, [0, k(20)], [0, 1], clamp);
  v *= interpolate(f, [p.duration - k(45), p.duration - 1], [1, 0], clamp);
  return v;
}

const Sounds: React.FC<{ plan: Plan }> = ({ plan: p }) => {
  const ticks: number[] = [];
  for (const sc of p.scenes)
    for (const t of sc.taps) {
      const f = sc.from + s(t - sc.start);
      if (f >= sc.from && f < sc.from + sc.dur) ticks.push(f);
    }
  return (
    <>
      <Audio src={staticFile('music.wav')} volume={(f) => musicVolume(f, p)} />
      <Sequence from={k(10)} durationInFrames={p.hookEnd - k(10)}>
        <Audio src={staticFile('hook.mp3')} volume={1} />
      </Sequence>
      {ticks.map((f) => (
        <Sequence key={f} from={f} durationInFrames={k(10)}>
          <Audio src={staticFile('tick.wav')} volume={0.55} />
        </Sequence>
      ))}
      {p.scenes
        .filter((sc) => sc.audioAt !== undefined)
        .map((sc) => {
          const at = sc.from + s(sc.audioAt! - sc.start);
          const len = sc.from + sc.dur - at;
          return (
            <Sequence key="narration" from={at} durationInFrames={len}>
              <Audio
                src={staticFile('narration.mp3')}
                startFrom={Math.round((sc.audioPos ?? 0) * FPS)}
                volume={(f) => interpolate(f, [len - k(10), len], [1, 0], clamp)}
              />
            </Sequence>
          );
        })}
    </>
  );
};

// ---------- composition ----------

export const Ad: React.FC<{ plan: Plan }> = ({ plan: p }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const v = p.vertical;
  const phoneH = v ? 1300 : 920;

  // Téléphone : monte à la fin de l'accroche, redescend avant le logo.
  const enter = spring({ frame: frame - (p.hookEnd - k(8)), fps, config: { damping: 17, mass: 0.9 } });
  const leave = interpolate(frame, [p.outroFrom - k(4), p.outroFrom + k(10)], [0, 1], clamp);
  const phoneY = (1 - enter) * (height * 1.2) + leave * 120;
  const black = interpolate(frame, [p.hookEnd - k(10), p.hookEnd + k(4)], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Background vertical={v} />
      <AbsoluteFill style={{ background: 'black', opacity: black }} />

      <Sequence durationInFrames={p.hookEnd}>
        <Hook vertical={v} end={p.hookEnd} />
      </Sequence>

      {/* Téléphone */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: v ? 'flex-end' : 'center',
          paddingBottom: v ? 150 : 0,
          transform: `translateY(${phoneY}px)`,
          opacity: 1 - leave,
        }}>
        <Phone height={phoneH}>
          {p.scenes.map((sc, i) => {
            const lead = i === 0 ? FIRST_LEAD : XFADE;
            const tail = i === p.scenes.length - 1 ? k(15) : 0;
            return (
              <Sequence key={sc.clip} from={sc.from - lead} durationInFrames={sc.dur + lead + tail}>
                <ClipView scene={sc} first={i === 0} />
              </Sequence>
            );
          })}
        </Phone>
      </AbsoluteFill>

      {/* Textes */}
      {p.captions.map((c) => (
        <Sequence key={'cap-' + c.from} from={c.from} durationInFrames={c.dur}>
          <AbsoluteFill
            style={
              v
                ? { padding: '120px 70px 0', justifyContent: 'flex-start', alignItems: 'center' }
                : { justifyContent: 'center', paddingLeft: 110, width: 110 + 560 }
            }>
            <CaptionText text={c.text} dur={c.dur} size={v ? 80 : 62} align={v ? 'center' : 'left'} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {!v && (
        <Sequence from={p.hookEnd} durationInFrames={p.outroFrom - p.hookEnd}>
          <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'flex-end', padding: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: enter * 0.95 }}>
              <Img src={staticFile('logo.png')} style={{ width: 64, height: 64, borderRadius: 15 }} />
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: 'white' }}>Taleway</span>
            </div>
          </AbsoluteFill>
        </Sequence>
      )}

      <Sequence from={p.outroFrom}>
        <Outro vertical={v} />
      </Sequence>

      <Sounds plan={p} />
    </AbsoluteFill>
  );
};
