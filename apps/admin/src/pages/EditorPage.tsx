import {
  AlertTriangle,
  ArrowLeft,
  BookPlus,
  CloudOff,
  Code2,
  FileDown,
  ImageUp,
  LayoutList,
  Rocket,
  Save,
  SearchCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AnalysisReport, ServerStatus, StoryDetail } from '../../shared/api';
import { ChapterCard } from '../components/ChapterCard';
import { ReportPanel } from '../components/ReportPanel';
import { StoryCover } from '../components/StoryCover';
import { Button, Dialog, Field, LevelPicker, useToast } from '../components/ui';
import { api } from '../lib/api';
import { fromSource, newChapter, sourceError, toSource, type Draft } from '../lib/draft';
import { LEVEL_NAMES, formatDate, plural } from '../lib/labels';
import { navigate } from '../lib/router';
import { levelVars } from '../theme';
import { StatusBadge } from './StoriesPage';

type Mode = 'visual' | 'markdown';

export function EditorPage({ slug, server }: { slug: string; server: ServerStatus | null }) {
  const toast = useToast();
  const [detail, setDetail] = useState<StoryDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('visual');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  /** Content as last loaded/saved: anything else is an unsaved change. */
  const [baseline, setBaseline] = useState('');
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [busy, setBusy] = useState<'save' | 'check' | 'publish' | 'import' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback((d: StoryDetail) => {
    setDetail(d);
    if (d.source === null) return;
    // Comments (<!-- -->) only survive in the Markdown editor.
    const keepsComments = d.source.includes('<!--');
    if (!keepsComments && !sourceError(d.source)) {
      const parsed = fromSource(d.source);
      setDraft(parsed);
      setMode('visual');
      setBaseline(toSource(parsed));
      setNotice(null);
    } else {
      setText(d.source);
      setMode('markdown');
      setBaseline(d.source);
      setNotice(
        keepsComments
          ? 'Ce fichier contient des commentaires <!-- -->, il s’ouvre en Markdown pour les conserver.'
          : 'Le fichier contient une erreur de format : corrige-la en Markdown pour retrouver l’éditeur visuel.',
      );
    }
  }, []);

  useEffect(() => {
    api
      .story(slug)
      .then(load)
      .catch((e: Error) => setLoadError(e.message));
  }, [slug, load]);

  const current = mode === 'visual' && draft ? toSource(draft) : text;
  const dirty = detail?.source != null && current !== baseline;
  const error = useMemo(
    () => (detail?.source != null ? sourceError(current) : null),
    [current, detail],
  );
  const meta = useMemo(() => {
    if (mode === 'visual') return draft?.meta ?? null;
    try {
      return fromSource(text).meta;
    } catch {
      return null;
    }
  }, [mode, draft, text]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const save = async () => {
    setBusy('save');
    try {
      const d = await api.save(slug, current);
      setDetail(d);
      setBaseline(current);
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current().then((ok) => ok && toast('Enregistré', 'success'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast]);

  const run = async (kind: 'check' | 'publish') => {
    if (dirty && !(await save())) return;
    setBusy(kind);
    try {
      const r = kind === 'check' ? await api.check(slug) : await api.publish(slug);
      setReport(r);
      if (kind === 'publish') {
        setDetail(await api.story(slug));
        toast('Histoire publiée dans l’app', 'success');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'markdown') {
      setText(current);
      setMode('markdown');
      return;
    }
    const err = sourceError(text);
    if (err) {
      toast(`Corrige d’abord le Markdown : ${err}`, 'error');
      return;
    }
    if (
      text.includes('<!--') &&
      !window.confirm('Les commentaires <!-- --> seront supprimés. Continuer ?')
    ) {
      return;
    }
    setDraft(fromSource(text));
    setMode('visual');
    setNotice(null);
  };

  const back = () => {
    if (dirty && !window.confirm('Quitter sans enregistrer les modifications ?')) return;
    navigate.stories();
  };

  if (loadError) {
    return (
      <main className="page stack">
        <div className="notice notice-danger">
          <AlertTriangle size={18} /> {loadError}
        </div>
        <div>
          <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={navigate.stories}>
            Histoires
          </Button>
        </div>
      </main>
    );
  }
  if (!detail) return <main className="page empty">Chargement…</main>;

  const level = meta?.level ?? detail.published?.level ?? 'A1';
  const title = meta?.title ?? detail.published?.title ?? slug;
  const updateMeta = (patch: Partial<Draft['meta']>) =>
    setDraft((d) => (d ? { ...d, meta: { ...d.meta, ...patch } } : d));
  const updateChapters = (fn: (chapters: Draft['chapters']) => Draft['chapters']) =>
    setDraft((d) => (d ? { ...d, chapters: fn(d.chapters) } : d));

  return (
    <main className="page" style={levelVars(level)}>
      <div className="editor-bar">
        <Button variant="ghost" size="icon" aria-label="Retour aux histoires" onClick={back}>
          <ArrowLeft size={20} />
        </Button>
        <div className="grow">
          <div className="row">
            <h1
              className="t-heading"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <span className="t-caption c-muted">
            {slug}.md
            {dirty ? (
              <>
                {' · '}
                <span className="dirty-dot" /> modifications non enregistrées
              </>
            ) : null}
          </span>
        </div>
        {detail.source !== null ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Save size={18} />}
              disabled={!dirty}
              loading={busy === 'save'}
              title="Ctrl+S"
              onClick={() => void save().then((ok) => ok && toast('Enregistré', 'success'))}>
              Enregistrer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<SearchCheck size={18} />}
              disabled={!!error || !!busy}
              loading={busy === 'check'}
              title="Analyse le texte sans rien publier"
              onClick={() => run('check')}>
              Vérifier
            </Button>
            <Button
              variant="level"
              size="sm"
              icon={<Rocket size={18} />}
              disabled={!!error || !server?.supabase || !!busy}
              loading={busy === 'publish'}
              title={
                server?.supabase ? 'Met l’histoire en ligne dans l’app' : 'Supabase non configuré'
              }
              onClick={() => run('publish')}>
              Publier
            </Button>
          </>
        ) : null}
      </div>

      <div className="editor">
        <aside className="editor-side">
          <section className="card">
            <h2 className="card-title">Couverture</h2>
            <CoverEditor
              slug={slug}
              title={title}
              level={level}
              cover={meta?.cover ?? detail.published?.coverUrl ?? null}
              editable={mode === 'visual' && !!draft}
              canUpload={!!server?.supabase}
              onChange={(cover) => updateMeta({ cover })}
            />
          </section>

          <section className="card stack">
            <h2 className="card-title" style={{ margin: 0 }}>
              Informations
            </h2>
            {mode === 'visual' && draft ? (
              <>
                <Field label="Titre">
                  <input
                    className="input"
                    value={draft.meta.title}
                    onChange={(e) => updateMeta({ title: e.target.value })}
                  />
                </Field>
                <Field label="Niveau" hint={LEVEL_NAMES[draft.meta.level]}>
                  <LevelPicker
                    value={draft.meta.level}
                    onChange={(l) => updateMeta({ level: l })}
                  />
                </Field>
                <Field label="Résumé" hint={`${draft.meta.summary.length} car.`}>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Une ou deux phrases qui donnent envie de lire."
                    value={draft.meta.summary}
                    onChange={(e) => updateMeta({ summary: e.target.value.replace(/\n/g, ' ') })}
                  />
                </Field>
                <label className="check check-premium">
                  <input
                    type="checkbox"
                    checked={draft.meta.premium}
                    onChange={(e) => updateMeta({ premium: e.target.checked })}
                  />
                  <span>
                    <span className="t-bold">Histoire premium</span>
                    <br />
                    <span className="t-caption c-secondary">
                      Sans abonnement, seul le premier chapitre se lit.
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <p className="t-caption c-muted">
                {detail.source === null
                  ? 'Récupère le fichier pour modifier l’histoire.'
                  : 'En mode Markdown, les informations se modifient dans l’en-tête du fichier (title, level, summary, cover, premium).'}
              </p>
            )}
          </section>

          <PublishedCard detail={detail} onDelete={() => setDeleting(true)} />
        </aside>

        <div className="editor-main">
          {report ? (
            <ReportPanel
              report={report}
              lang={server?.lang ?? 'fr'}
              onClose={() => setReport(null)}
            />
          ) : null}

          {detail.source === null ? (
            <section className="card stack">
              <div className="notice">
                <CloudOff size={18} />
                Cette histoire est dans l’app mais n’a pas de fichier dans content/stories (publiée
                depuis une autre machine ?).
              </div>
              <div>
                <Button
                  icon={<FileDown size={18} />}
                  loading={busy === 'import'}
                  onClick={async () => {
                    setBusy('import');
                    try {
                      load(await api.importFile(slug));
                      toast('Fichier recréé depuis l’app', 'success');
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    } finally {
                      setBusy(null);
                    }
                  }}>
                  Récupérer le fichier
                </Button>
              </div>
            </section>
          ) : (
            <>
              <div className="row row-wrap">
                <div className="tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className="tab"
                    aria-selected={mode === 'visual'}
                    onClick={() => switchMode('visual')}>
                    <LayoutList size={16} /> Chapitres
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="tab"
                    aria-selected={mode === 'markdown'}
                    onClick={() => switchMode('markdown')}>
                    <Code2 size={16} /> Markdown
                  </button>
                </div>
                <span className="grow" />
                {mode === 'visual' && draft ? (
                  <span className="t-caption c-muted">
                    {plural(draft.chapters.length, 'chapitre', 'chapitres')} ·{' '}
                    {plural(
                      draft.chapters.reduce((n, c) => n + c.pages.length, 0),
                      'page',
                      'pages',
                    )}
                  </span>
                ) : null}
              </div>

              {notice ? (
                <div className="notice">
                  <AlertTriangle size={18} /> {notice}
                </div>
              ) : null}
              {error ? (
                <div className="notice notice-danger">
                  <AlertTriangle size={18} /> {error}
                </div>
              ) : null}

              {mode === 'visual' && draft ? (
                <>
                  {draft.chapters.map((chapter, i) => (
                    <ChapterCard
                      key={chapter.id}
                      slug={slug}
                      canUpload={!!server?.supabase}
                      chapter={chapter}
                      index={i}
                      count={draft.chapters.length}
                      collapsed={collapsed.has(chapter.id)}
                      onToggle={() =>
                        setCollapsed((s) => {
                          const next = new Set(s);
                          if (!next.delete(chapter.id)) next.add(chapter.id);
                          return next;
                        })
                      }
                      onChange={(c) =>
                        updateChapters((cs) => cs.map((x) => (x.id === c.id ? c : x)))
                      }
                      onMove={(delta) =>
                        updateChapters((cs) => {
                          const next = [...cs];
                          const [moved] = next.splice(i, 1);
                          next.splice(i + delta, 0, moved!);
                          return next;
                        })
                      }
                      onDelete={() => {
                        const hasText = chapter.pages.some((p) => p.text.trim());
                        const warn = chapter.key
                          ? 'Supprimer ce chapitre ? Une fois republiée, la progression des lecteurs sur ce chapitre sera perdue.'
                          : 'Supprimer ce chapitre ?';
                        if ((hasText || chapter.key) && !window.confirm(warn)) return;
                        updateChapters((cs) => cs.filter((x) => x.id !== chapter.id));
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className="add-line add-line-lg"
                    onClick={() => updateChapters((cs) => [...cs, newChapter()])}>
                    <BookPlus size={20} /> Nouveau chapitre
                  </button>
                </>
              ) : (
                <textarea
                  className="input markdown"
                  spellCheck={false}
                  aria-label="Fichier Markdown"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {deleting ? (
        <DeleteDialog
          detail={detail}
          title={title}
          onClose={() => setDeleting(false)}
          onDeleted={(gone) => {
            setDeleting(false);
            if (gone) {
              toast('Histoire supprimée', 'success');
              navigate.stories();
            } else {
              toast('Histoire retirée de l’app', 'success');
              void api.story(slug).then(setDetail);
            }
          }}
        />
      ) : null}
    </main>
  );
}

function CoverEditor({
  slug,
  title,
  level,
  cover,
  editable,
  canUpload,
  onChange,
}: {
  slug: string;
  title: string;
  level: Draft['meta']['level'];
  cover: string | null;
  editable: boolean;
  canUpload: boolean;
  onChange: (cover: string | null) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await api.uploadCover(slug, file);
      onChange(url);
      toast('Image envoyée : pense à enregistrer', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack">
      <div className="cover-editor">
        <StoryCover slug={slug} title={title} level={level} cover={cover} />
        <div className="stack grow">
          <p className="t-caption c-muted">
            {cover
              ? 'Image personnalisée.'
              : 'Couverture par défaut, aux couleurs du niveau. Ajoute une image pour la remplacer.'}
          </p>
          {editable ? (
            <>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<ImageUp size={16} />}
                loading={uploading}
                disabled={!canUpload}
                title={
                  canUpload
                    ? 'JPEG, PNG ou WebP, 5 Mo max., format portrait 2:3'
                    : 'Supabase non configuré'
                }
                onClick={() => input.current?.click()}>
                Image
              </Button>
              {cover ? (
                <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                  Retirer
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {editable ? (
        <Field label="Ou l’adresse d’une image">
          <input
            className="input input-sm"
            placeholder="https://…"
            value={cover ?? ''}
            onChange={(e) => onChange(e.target.value.trim() || null)}
          />
        </Field>
      ) : null}
    </div>
  );
}

function PublishedCard({ detail, onDelete }: { detail: StoryDetail; onDelete: () => void }) {
  const p = detail.published;
  return (
    <section className="card stack">
      <h2 className="card-title" style={{ margin: 0 }}>
        <Smartphone size={18} /> Dans l’app
      </h2>
      {p ? (
        <p className="t-body c-secondary">
          Publiée le {formatDate(p.at)}
          <br />
          {plural(p.chapters, 'chapitre', 'chapitres')} · {plural(p.pages, 'page', 'pages')} ·{' '}
          {plural(p.words, 'mot', 'mots')}
        </p>
      ) : (
        <p className="t-body c-secondary">Pas encore publiée : les lecteurs ne la voient pas.</p>
      )}
      <div>
        <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={onDelete}>
          Supprimer…
        </Button>
      </div>
    </section>
  );
}

function DeleteDialog({
  detail,
  title,
  onClose,
  onDeleted,
}: {
  detail: StoryDetail;
  title: string;
  onClose: () => void;
  /** `gone`: nothing is left of the story (no file, not online). */
  onDeleted: (gone: boolean) => void;
}) {
  const toast = useToast();
  const hasFile = detail.source !== null;
  const online = !!detail.published;
  const [removeOnline, setRemoveOnline] = useState(online);
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.remove(detail.slug, { file: removeFile, online: removeOnline });
      onDeleted((removeFile || !hasFile) && (removeOnline || !online));
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Supprimer « ${title} »`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!removeOnline && !removeFile}
            onClick={confirm}>
            Supprimer
          </Button>
        </>
      }>
      {online ? (
        <label className="check">
          <input
            type="checkbox"
            checked={removeOnline}
            onChange={(e) => setRemoveOnline(e.target.checked)}
          />
          <span>
            <span className="t-bold">Retirer de l’app</span>
            <br />
            <span className="t-caption c-secondary">
              Les lecteurs ne la verront plus et leur progression sur cette histoire est effacée.
              Les mots déjà ajoutés à « Mes mots » restent.
            </span>
          </span>
        </label>
      ) : null}
      {hasFile ? (
        <label className="check">
          <input
            type="checkbox"
            checked={removeFile}
            onChange={(e) => setRemoveFile(e.target.checked)}
          />
          <span>
            <span className="t-bold">Supprimer le fichier {detail.slug}.md</span>
            <br />
            <span className="t-caption c-secondary">
              Le texte est perdu, sauf s’il est déjà commité dans git.
            </span>
          </span>
        </label>
      ) : null}
    </Dialog>
  );
}
