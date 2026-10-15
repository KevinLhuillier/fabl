import { BookOpen, CloudOff, Database } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ServerStatus } from '../shared/api';
import { Badge, ToastProvider } from './components/ui';
import { api } from './lib/api';
import { useRoute } from './lib/router';
import { EditorPage } from './pages/EditorPage';
import { StoriesPage } from './pages/StoriesPage';

export function App() {
  const route = useRoute();
  const [server, setServer] = useState<ServerStatus | null>(null);
  useEffect(() => {
    api.status().then(setServer, () => setServer(null));
  }, []);

  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#/">
            <span className="brand-mark">
              <BookOpen size={20} />
            </span>
            Fabl
          </a>
          <Badge tone="primary">Admin</Badge>
          <span className="spacer" />
          {server ? (
            server.supabase ? (
              <Badge tone="success">
                <Database size={14} /> Supabase connecté
              </Badge>
            ) : (
              <span title="Renseigne SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans le .env à la racine, puis relance.">
                <Badge tone="danger">
                  <CloudOff size={14} /> Supabase non configuré : édition seule
                </Badge>
              </span>
            )
          ) : null}
        </header>
        {route.name === 'story' ? (
          <EditorPage key={route.slug} slug={route.slug} server={server} />
        ) : (
          <StoriesPage />
        )}
      </div>
    </ToastProvider>
  );
}
