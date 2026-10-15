import { AlertTriangle, BookPlus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { Level, StoryListItem, StoryStatus } from '../../shared/api';
import { StoryCover } from '../components/StoryCover';
import { Badge, Button, Dialog, Field, LevelPicker, useToast } from '../components/ui';
import { api } from '../lib/api';
import { STATUS_LABELS, plural, slugify } from '../lib/labels';
import { navigate } from '../lib/router';

const STATUS_TONES = {
  draft: undefined,
  published: 'success',
  modified: 'xp',
  'online-only': 'info',
} as const satisfies Record<StoryStatus, string | undefined>;

export function StatusBadge({ status }: { status: StoryStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

type Filter = 'all' | StoryStatus;
const FILTERS: Filter[] = ['all', 'draft', 'modified', 'published', 'online-only'];

/** Every story on one shelf, in the app's order (level, then title). */
export function StoriesPage() {
  const toast = useToast();
  const [stories, setStories] = useState<StoryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .stories()
      .then((s) =>
        setStories(
          [...s].sort((a, b) => a.level.localeCompare(b.level) || a.title.localeCompare(b.title)),
        ),
      )
      .catch((e: Error) => setError(e.message));
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: 0,
      draft: 0,
      modified: 0,
      published: 0,
      'online-only': 0,
    };
    for (const s of stories ?? []) {
      c.all++;
      c[s.status]++;
    }
    return c;
  }, [stories]);

  const q = query.trim().toLowerCase();
  const visible = (stories ?? []).filter(
    (s) =>
      (filter === 'all' || s.status === filter) &&
      (!q || s.title.toLowerCase().includes(q) || s.slug.includes(q)),
  );

  return (
    <main className="page">
      <div className="page-head">
        <div className="grow">
          <h1 className="t-display">Histoires</h1>
          <p className="t-body c-secondary">
            {stories
              ? `${plural(counts.all, 'histoire', 'histoires')} · ${counts.published} publiée${counts.published > 1 ? 's' : ''}`
              : 'Chargement…'}
          </p>
        </div>
        <label className="row" style={{ minWidth: 240 }}>
          <Search size={18} className="c-muted" />
          <input
            className="input input-sm"
            placeholder="Rechercher une histoire"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <Button icon={<BookPlus size={20} />} onClick={() => setCreating(true)}>
          Nouvelle histoire
        </Button>
      </div>

      {error ? (
        <div className="notice notice-danger">
          <AlertTriangle size={18} />
          Impossible de charger les histoires : {error}
        </div>
      ) : null}

      {stories ? (
        <>
          <div className="filters">
            {FILTERS.filter((f) => f === 'all' || counts[f] > 0).map((f) => (
              <button
                key={f}
                type="button"
                className="chip"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}>
                {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}
                <span className="chip-count">{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="shelf">
            {filter === 'all' && !q ? (
              <div>
                <button type="button" className="tile-new" onClick={() => setCreating(true)}>
                  <BookPlus size={36} />
                  Nouvelle histoire
                </button>
              </div>
            ) : null}
            {visible.map((s) => (
              <StoryTile key={s.slug} story={s} />
            ))}
          </div>
          {!visible.length && (q || filter !== 'all') ? (
            <div className="empty">Aucune histoire ne correspond.</div>
          ) : null}
        </>
      ) : null}

      {creating ? (
        <NewStoryDialog
          existing={new Set(stories?.map((s) => s.slug))}
          onClose={() => setCreating(false)}
          onCreated={(slug) => {
            toast('Histoire créée', 'success');
            navigate.story(slug);
          }}
        />
      ) : null}
    </main>
  );
}

function StoryTile({ story }: { story: StoryListItem }) {
  return (
    <button type="button" className="tile" onClick={() => navigate.story(story.slug)}>
      <div style={{ position: 'relative' }}>
        <StoryCover slug={story.slug} title={story.title} level={story.level} cover={story.cover} />
        <div className="tile-badges">
          <Badge level={story.level}>{story.level}</Badge>
          {story.error ? (
            <Badge tone="danger">Erreur</Badge>
          ) : (
            <StatusBadge status={story.status} />
          )}
        </div>
      </div>
      <span className="t-bold tile-title">{story.title}</span>
      <span className="t-caption c-secondary">
        {story.error
          ? 'Format à corriger'
          : `${plural(story.chapters, 'chapitre', 'chapitres')} · ${plural(story.pages, 'page', 'pages')}`}
      </span>
    </button>
  );
}

function NewStoryDialog({
  existing,
  onClose,
  onCreated,
}: {
  existing: Set<string>;
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<Level>('A1');
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slug = customSlug ?? slugify(level, title);
  const taken = existing.has(slug);
  const valid = !!title.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !taken;

  const create = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await api.create(slug, title.trim(), level);
      onCreated(slug);
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Nouvelle histoire"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid} loading={busy} onClick={create}>
            Créer
          </Button>
        </>
      }>
      <Field label="Titre (en anglais, comme dans l’app)">
        <input
          className="input"
          autoFocus
          placeholder="Where Is Leo?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
      </Field>
      <Field label="Niveau">
        <LevelPicker value={level} onChange={setLevel} />
      </Field>
      <Field
        label="Identifiant (nom du fichier)"
        hint={taken ? <span className="c-danger">déjà utilisé</span> : `${slug || '…'}.md`}>
        <input
          className="input input-mono"
          value={slug}
          onChange={(e) => setCustomSlug(e.target.value.toLowerCase())}
        />
      </Field>
      <p className="t-caption c-muted">
        L’identifiant ne pourra plus changer : le renommer créerait une nouvelle histoire dans
        l’app.
      </p>
    </Dialog>
  );
}
