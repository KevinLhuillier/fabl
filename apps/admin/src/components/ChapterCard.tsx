import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

import { newPage, type DraftChapter } from '../lib/draft';
import { plural, roughWords, toRoman } from '../lib/labels';
import { Button } from './ui';

type Props = {
  chapter: DraftChapter;
  index: number;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (chapter: DraftChapter) => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
};

/** Lines the parser would not read as text. */
const SPECIAL_LINE = /^\s*(#|-{3,}\s*$)/m;

/** A chapter as in the app's table of contents, with its pages on paper below. */
export function ChapterCard({
  chapter,
  index,
  count,
  collapsed,
  onToggle,
  onChange,
  onMove,
  onDelete,
}: Props) {
  const words = chapter.pages.reduce((n, p) => n + roughWords(p.text), 0);
  const setPage = (i: number, text: string) =>
    onChange({
      ...chapter,
      pages: chapter.pages.map((p, j) => (j === i ? { ...p, text } : p)),
    });
  const insertPage = (at: number) =>
    onChange({
      ...chapter,
      pages: [...chapter.pages.slice(0, at), newPage(), ...chapter.pages.slice(at)],
    });
  const removePage = (i: number) => {
    if (chapter.pages[i]!.text.trim() && !window.confirm('Supprimer cette page et son texte ?')) {
      return;
    }
    onChange({ ...chapter, pages: chapter.pages.filter((_, j) => j !== i) });
  };

  return (
    <section className="card" aria-label={`Chapitre ${index + 1}`}>
      <div className="chapter-head">
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? 'Déplier' : 'Replier'}
          aria-expanded={!collapsed}
          onClick={onToggle}>
          {collapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
        </Button>
        <span className="numeral">{toRoman(index + 1)}</span>
        <input
          className="title-input"
          placeholder="Titre du chapitre"
          aria-label="Titre du chapitre"
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
        />
        <span className="t-caption c-muted" style={{ whiteSpace: 'nowrap' }}>
          {plural(chapter.pages.length, 'page', 'pages')} · ≈ {plural(words, 'mot', 'mots')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Monter"
          disabled={index === 0}
          onClick={() => onMove(-1)}>
          <ArrowUp size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Descendre"
          disabled={index === count - 1}
          onClick={() => onMove(1)}>
          <ArrowDown size={18} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Supprimer le chapitre" onClick={onDelete}>
          <Trash2 size={18} />
        </Button>
      </div>

      {collapsed ? null : (
        <div className="pages">
          {chapter.pages.map((page, i) => (
            <div key={page.id} className="stack">
              <div className="paper">
                <div className="paper-head">
                  <span className="t-overline c-level grow">Page {i + 1}</span>
                  <span className="t-caption c-muted">
                    ≈ {plural(roughWords(page.text), 'mot', 'mots')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer la page ${i + 1}`}
                    disabled={chapter.pages.length === 1}
                    onClick={() => removePage(i)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
                <AutoTextarea
                  className="page-text"
                  placeholder="Écris le texte de la page. Une ligne = un paragraphe."
                  aria-label={`Texte de la page ${i + 1}`}
                  value={page.text}
                  onChange={(e) => setPage(i, e.target.value)}
                />
                {SPECIAL_LINE.test(page.text) ? (
                  <p className="t-caption c-danger" style={{ padding: '0 16px 12px' }}>
                    Une ligne qui commence par « # » ou « --- » serait lue comme un titre de
                    chapitre ou un changement de page.
                  </p>
                ) : null}
              </div>
              <button type="button" className="add-line" onClick={() => insertPage(i + 1)}>
                <Plus size={16} /> Page
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Textarea that grows with its content (CSS field-sizing where supported, JS otherwise). */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports('field-sizing', 'content')) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={4} {...props} />;
}
