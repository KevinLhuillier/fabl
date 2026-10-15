import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

import { LEVEL_NAMES } from '../lib/labels';
import { CEFR_LEVELS, levelVars, type CefrLevel } from '../theme';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'level' | 'ghost';
  size?: 'md' | 'sm' | 'icon';
  loading?: boolean;
  icon?: ReactNode;
};

/** Tactile button with a 3D edge, as in the mobile app. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}>
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone,
  level,
}: {
  children: ReactNode;
  tone?: 'success' | 'xp' | 'info' | 'danger' | 'primary';
  level?: CefrLevel;
}) {
  if (level) {
    return (
      <span className="badge badge-level" style={levelVars(level)}>
        {children}
      </span>
    );
  }
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{children}</span>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        <span>{label}</span>
        {hint ? <span className="c-muted">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/** CEFR level pills, each in its level color. */
export function LevelPicker({
  value,
  onChange,
}: {
  value: CefrLevel;
  onChange: (level: CefrLevel) => void;
}) {
  return (
    <div className="level-picker" role="group" aria-label="Niveau">
      {CEFR_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className="level-option"
          style={levelVars(level)}
          aria-pressed={value === level}
          title={LEVEL_NAMES[level]}
          onClick={() => onChange(level)}>
          {level}
        </button>
      ))}
    </div>
  );
}

export function Dialog({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row">
          <h2 className="t-heading grow">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          {children}
        </div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}

// --- Toasts --------------------------------------------------------------------

type Toast = { id: number; tone: 'info' | 'success' | 'error'; message: string };
type ToastFn = (message: string, tone?: Toast['tone']) => void;

const ToastContext = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback<ToastFn>((message, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tone === 'error' ? 7000 : 3500,
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
