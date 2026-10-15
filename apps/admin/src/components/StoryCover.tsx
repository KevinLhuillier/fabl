import { useEffect, useState } from 'react';

import { levelVars, type CefrLevel } from '../theme';

type Props = {
  slug: string;
  title: string;
  level: CefrLevel;
  cover: string | null;
};

/**
 * Web copy of apps/mobile/src/components/StoryCover.tsx: the story's image,
 * or the default cover drawn in the level color (motif picked from the slug,
 * so the admin shows exactly what readers will see).
 */
export function StoryCover({ slug, title, level, cover }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [cover]);
  const showImage = !!cover && !failed;

  return (
    <div className="cover" style={levelVars(level)}>
      <div className="cover-pages" />
      <div className="cover-face">
        {showImage ? (
          <img src={cover} alt="" onError={() => setFailed(true)} />
        ) : (
          <>
            <Motif slug={slug} />
            <div className="cover-frame">
              <span className="cover-rule" />
              <span className="cover-title">{title || 'Sans titre'}</span>
              <span className="cover-rule" />
            </div>
          </>
        )}
        <div className="cover-spine" />
      </div>
    </div>
  );
}

const MOTIFS = ['stars', 'waves', 'sun', 'dots'] as const;

/** Same hash as the mobile app: the same slug gets the same motif. */
function motifOf(slug: string) {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return MOTIFS[Math.abs(hash) % MOTIFS.length]!;
}

function Motif({ slug }: { slug: string }) {
  const motif = motifOf(slug);
  const ink = 'rgba(255,255,255,0.22)';
  return (
    <svg className="motif" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {motif === 'stars' ? (
        <>
          <circle cx={74} cy={30} r={14} fill={ink} />
          <circle cx={80} cy={25} r={12} fill="var(--lvl)" />
          {[
            [26, 22, 2.4],
            [44, 38, 1.6],
            [18, 50, 1.4],
            [60, 54, 2],
            [86, 60, 1.4],
            [30, 128, 1.6],
            [76, 132, 2.2],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={ink} />
          ))}
        </>
      ) : null}
      {motif === 'waves'
        ? [112, 124, 136, 148].map((y) => (
            <path
              key={y}
              d={`M -10 ${y} Q 15 ${y - 10}, 40 ${y} T 90 ${y} T 140 ${y}`}
              stroke={ink}
              strokeWidth={4}
              fill="none"
            />
          ))
        : null}
      {motif === 'sun'
        ? [16, 30, 44, 58].map((r) => (
            <circle key={r} cx={50} cy={150} r={r} stroke={ink} strokeWidth={5} fill="none" />
          ))
        : null}
      {motif === 'dots'
        ? Array.from({ length: 6 * 3 }, (_, i) => (
            <circle
              key={i}
              cx={14 + (i % 6) * 15}
              cy={112 + Math.floor(i / 6) * 13 + (i % 2) * 6}
              r={2.6}
              fill={ink}
            />
          ))
        : null}
    </svg>
  );
}
