import { AlertTriangle, CheckCircle2, Languages, SearchCheck, X } from 'lucide-react';
import { useState } from 'react';

import type { AnalysisReport, MissingLemma } from '../../shared/api';
import { api } from '../lib/api';
import { formatNumber, posLabel } from '../lib/labels';
import { Badge, Button, useToast } from './ui';

const keyOf = (l: MissingLemma) => `${l.word}|${l.pos}`;

/** Result of "Vérifier" / "Publier": figures, warnings and the words left to translate. */
export function ReportPanel({
  report,
  lang,
  onClose,
}: {
  report: AnalysisReport;
  lang: string;
  onClose: () => void;
}) {
  return (
    <section className="card card-tint stack">
      <div className="row">
        {report.published ? (
          <CheckCircle2 size={22} className="c-level" />
        ) : (
          <SearchCheck size={22} className="c-level" />
        )}
        <h2 className="t-heading grow">
          {report.published ? 'Publiée dans l’app' : 'Vérification (rien n’est publié)'}
        </h2>
        <Button variant="ghost" size="icon" aria-label="Fermer le rapport" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      <div className="stats">
        <Stat value={report.words} label="mots" />
        <Stat value={report.pages} label="pages" />
        <Stat value={report.chapters.length} label="chapitres" />
        <Stat value={report.lemmas} label="mots distincts" />
      </div>

      {report.warnings.map((w) => (
        <div key={w} className="notice notice-xp">
          <AlertTriangle size={18} />
          {w.replace(/^[^:]+\.md:/, 'Ligne ')}
        </div>
      ))}

      {report.missing.length ? (
        <Translations key={report.missing.map(keyOf).join()} missing={report.missing} lang={lang} />
      ) : (
        <div className="notice notice-success">
          <CheckCircle2 size={18} />
          Tous les mots ont une traduction ({lang}).
        </div>
      )}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{formatNumber(value)}</div>
      <div className="t-caption c-secondary">{label}</div>
    </div>
  );
}

function Translations({ missing, lang }: { missing: MissingLemma[]; lang: string }) {
  const toast = useToast();
  const [remaining, setRemaining] = useState(missing);
  const [values, setValues] = useState<Record<string, { translation: string; example: string }>>(
    () =>
      Object.fromEntries(missing.map((l) => [keyOf(l), { translation: '', example: l.context }])),
  );
  const [busy, setBusy] = useState(false);
  const ready = remaining.filter((l) => values[keyOf(l)]?.translation.trim());

  const set = (l: MissingLemma, field: 'translation' | 'example', value: string) =>
    setValues((v) => ({ ...v, [keyOf(l)]: { ...v[keyOf(l)]!, [field]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      const { saved, online } = await api.saveTranslations(
        ready.map((l) => ({ word: l.word, pos: l.pos, ...values[keyOf(l)]! })),
      );
      const done = new Set(ready.map(keyOf));
      setRemaining((r) => r.filter((l) => !done.has(keyOf(l))));
      toast(
        `${saved} traduction${saved > 1 ? 's' : ''} enregistrée${saved > 1 ? 's' : ''}${online ? ' (fichier + app)' : ' (fichier)'}`,
        'success',
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!remaining.length) {
    return (
      <div className="notice notice-success">
        <CheckCircle2 size={18} />
        Toutes les traductions sont enregistrées.
      </div>
    );
  }

  return (
    <div className="card stack" style={{ marginBottom: 0 }}>
      <div className="row row-wrap">
        <Languages size={20} className="c-level" />
        <h3 className="t-bold grow">
          {remaining.length} mot{remaining.length > 1 ? 's' : ''} sans traduction ({lang})
        </h3>
        <Button size="sm" variant="level" disabled={!ready.length} loading={busy} onClick={save}>
          Enregistrer {ready.length || ''}
        </Button>
      </div>
      <p className="t-caption c-muted">
        Les mots sans traduction s’affichent sans définition dans l’app. L’exemple est la phrase de
        l’histoire où le mot apparaît : tu peux la garder, la compléter ou la vider.
      </p>
      <div>
        {remaining.map((l) => (
          <div key={keyOf(l)} className="translation">
            <div className="translation-word">
              <div className="t-bold">{l.word}</div>
              <Badge>{posLabel(l.pos)}</Badge>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <input
                className="input input-sm"
                placeholder="Traduction"
                aria-label={`Traduction de ${l.word}`}
                value={values[keyOf(l)]!.translation}
                onChange={(e) => set(l, 'translation', e.target.value)}
              />
              <input
                className="input input-sm c-secondary"
                placeholder="Exemple (facultatif)"
                aria-label={`Exemple pour ${l.word}`}
                value={values[keyOf(l)]!.example}
                onChange={(e) => set(l, 'example', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
