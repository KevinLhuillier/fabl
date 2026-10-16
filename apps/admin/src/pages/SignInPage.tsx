import { AlertTriangle, BookOpen, CloudOff, LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { AdminUser, ServerStatus } from '../../shared/api';
import { Button, Field } from '../components/ui';
import { api } from '../lib/api';

/** Admin sign-in, with the same Fabl account as in the mobile app. */
export function SignInPage({
  server,
  onSignedIn,
}: {
  server: ServerStatus | null;
  onSignedIn: (user: AdminUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offline = server !== null && !server.supabase;
  const canSubmit = !offline && email.includes('@') && password.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.signIn(email.trim(), password));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="signin">
      <div className="signin-hero">
        <span className="brand-mark signin-mark">
          <BookOpen size={32} />
        </span>
        <h1 className="t-display" style={{ color: 'var(--primary)' }}>
          Fabl Admin
        </h1>
        <p className="c-secondary">Connecte-toi avec un compte Fabl administrateur.</p>
      </div>

      <form className="card stack" onSubmit={submit}>
        {offline ? (
          <div className="notice notice-danger">
            <CloudOff size={18} />
            <span>
              Supabase n’est pas configuré : renseigne SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
              dans le .env à la racine, puis relance.
            </span>
          </div>
        ) : null}
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Mot de passe">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? (
          <div className="notice notice-danger">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        ) : null}
        <Button
          type="submit"
          className="btn-block"
          disabled={!canSubmit}
          loading={busy}
          icon={<LogIn size={18} />}>
          Se connecter
        </Button>
      </form>
    </main>
  );
}
