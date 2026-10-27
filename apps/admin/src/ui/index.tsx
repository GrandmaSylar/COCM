// UI primitives that mirror the Expo app's components (apps/mobile/src/components/ui):
// same radii, spacing, type variants and tone colors, driven by the shared design tokens.
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, XCircle } from 'lucide-react';

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type IconType = ComponentType<{ size?: number; className?: string }>;

// ---------------------------------------------------------------------------
// Tones
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

// Literal class names so Tailwind can see them.
const TONE: Record<Tone, { soft: string; text: string }> = {
  neutral: { soft: 'bg-surface-muted', text: 'text-muted' },
  primary: { soft: 'bg-primary-soft', text: 'text-primary-text' },
  success: { soft: 'bg-success-soft', text: 'text-success-text' },
  warning: { soft: 'bg-warning-soft', text: 'text-warning-text' },
  danger: { soft: 'bg-danger-soft', text: 'text-danger-text' },
  info: { soft: 'bg-info-soft', text: 'text-info-text' },
};

// ---------------------------------------------------------------------------
// Surfaces and lists
// ---------------------------------------------------------------------------

/** Plain grouped surface (no shadow). */
export function Surface({ children, padded = true, className }: { children: ReactNode; padded?: boolean; className?: string }) {
  return <div className={cn('overflow-hidden rounded-lg border border-border bg-surface', padded && 'p-4', className)}>{children}</div>;
}

/** A titled group of rows with hairline dividers between them. */
export function Section({ title, action, footer, children, bare }: { title?: string; action?: ReactNode; footer?: string; children: ReactNode; bare?: boolean }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <section className="flex flex-col gap-2">
      {title || action ? (
        <div className="flex min-h-7 items-center justify-between px-1">
          {title ? <h2 className="t-caption-strong text-muted">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {bare ? (
        children
      ) : (
        <Surface padded={false}>
          {items.map((child, i) => (
            <div key={i}>
              {i > 0 ? <div className="ml-4 h-px bg-border" /> : null}
              {child}
            </div>
          ))}
        </Surface>
      )}
      {footer ? <p className="t-caption px-1 text-subtle">{footer}</p> : null}
    </section>
  );
}

/** Rounded square holding an icon, tinted by tone. */
export function IconWell({ icon: Icon, tone = 'primary', size = 36 }: { icon: IconType; tone?: Tone; size?: number }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', TONE[tone].soft)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    >
      <Icon size={Math.round(size * 0.5)} className={TONE[tone].text} />
    </span>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      className="t-caption-strong inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  expanded,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1 text-left">
        <span className="t-body-medium block truncate text-ink">{title}</span>
        {subtitle ? <span className="t-caption block text-muted">{subtitle}</span> : null}
      </span>
      {trailing}
      {onClick ? <ChevronRight size={16} className={cn('shrink-0 text-subtle transition-transform', expanded && 'rotate-90')} /> : null}
    </>
  );
  const classes = 'flex min-h-14 w-full items-center gap-3 px-4 py-3';
  return onClick ? (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={cn(classes, 'press hover:bg-surface-muted')}>
      {body}
    </button>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Read-only "label, value" line. */
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-12 items-start gap-3 px-4 py-3">
      <span className="t-caption flex-1 pt-px text-muted">{label}</span>
      <span className="t-caption-strong t-numeric text-right text-ink">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge, buttons, fields
// ---------------------------------------------------------------------------

/** Small status label. Square-ish corners, sentence case. */
export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: Tone; icon?: IconType }) {
  return (
    <span className={cn('t-micro inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-[3px]', TONE[tone].soft, TONE[tone].text)}>
      {Icon ? <Icon size={12} /> : null}
      {label}
    </span>
  );
}

export type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-on hover:bg-primary-pressed',
  soft: 'bg-primary-soft text-primary-text',
  secondary: 'border border-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'bg-transparent text-primary-text hover:bg-surface-muted',
  danger: 'bg-danger text-danger-on hover:bg-danger-pressed',
  dangerSoft: 'bg-danger-soft text-danger-text',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  fullWidth,
  className,
  disabled,
  ...rest
}: { label: string; variant?: ButtonVariant; size?: 'md' | 'sm'; icon?: IconType; loading?: boolean; fullWidth?: boolean } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
>) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'press inline-flex items-center justify-center gap-2 rounded-md disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-12 px-5 t-body-strong' : 'h-9 px-3.5 t-caption-strong',
        BUTTON[variant],
        fullWidth ? 'w-full' : 'self-start',
        className,
      )}
    >
      {loading ? <Loader2 size={size === 'md' ? 18 : 16} className="animate-spin" /> : Icon ? <Icon size={size === 'md' ? 18 : 16} /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function IconButton({ icon: Icon, label, ...rest }: { icon: IconType; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className="press inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-surface-muted">
      <Icon size={20} />
    </button>
  );
}

export function TextField({
  label,
  error,
  helper,
  icon: Icon,
  className,
  ...input
}: { label?: string; error?: string | null; helper?: string; icon?: IconType } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { className?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label ? <span className="t-label text-muted">{label}</span> : null}
      <span
        className={cn(
          'flex min-h-12 items-center gap-2.5 rounded-md border bg-surface px-3.5 transition-colors',
          error ? 'border-danger' : 'border-strong focus-within:border-primary',
        )}
      >
        {Icon ? <Icon size={18} className="text-subtle" /> : null}
        <input {...input} className={cn('t-body min-w-0 flex-1 bg-transparent py-2 text-ink outline-none placeholder:text-subtle', className)} />
      </span>
      {error ? <span className="t-caption text-danger-text">{error}</span> : helper ? <span className="t-caption text-subtle">{helper}</span> : null}
    </label>
  );
}

export function Chip({ label, selected, onClick }: { label: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'press t-caption-strong h-9 rounded-full border px-3.5',
        selected ? 'border-primary bg-primary-soft text-primary-text' : 'border-strong bg-surface text-muted hover:bg-surface-muted',
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function StatTile({ label, value, tone = 'primary', icon: Icon, footnote }: { label: string; value: string | number; tone?: Tone; icon?: IconType; footnote?: string }) {
  return (
    <div className="flex min-h-[104px] flex-1 flex-col gap-1.5 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="t-caption-strong truncate text-muted">{label}</span>
        {Icon ? <Icon size={16} className={TONE[tone].text} /> : null}
      </div>
      <span className="t-title t-numeric truncate text-ink">{value}</span>
      {footnote ? <span className="t-caption text-muted">{footnote}</span> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, tone = 'neutral' }: { icon: IconType; title: string; message?: string; tone?: Tone }) {
  return (
    <div className="fade-in flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <span className={cn('mb-1 inline-flex h-14 w-14 items-center justify-center rounded-[18px]', TONE[tone].soft)}>
        <Icon size={26} className={TONE[tone].text} />
      </span>
      <p className="t-headline text-ink">{title}</p>
      {message ? <p className="t-caption max-w-[300px] text-muted">{message}</p> : null}
    </div>
  );
}

type ToastTone = 'success' | 'error' | 'warning' | 'info';
interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
}

const TOAST_ICON: Record<ToastTone, { icon: IconType; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success-text' },
  error: { icon: XCircle, color: 'text-danger-text' },
  warning: { icon: AlertTriangle, color: 'text-warning-text' },
  info: { icon: Info, color: 'text-info-text' },
};

const ToastContext = createContext<{ show: (options: ToastOptions) => void }>({ show: () => {} });

/** Non-blocking confirmations, dropping in from the top like the Expo app's toasts. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Required<Pick<ToastOptions, 'title' | 'tone'>> & { id: number; message?: string }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback(({ title, message, tone = 'success', duration }: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++counter.current;
    setToast({ id, title, message, tone });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), duration ?? (tone === 'error' ? 4500 : 3000));
  }, []);

  const view = toast ? TOAST_ICON[toast.tone] : null;
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && view ? (
        <div className="pointer-events-none fixed inset-x-4 top-3 z-50 flex justify-center">
          <button
            key={toast.id}
            type="button"
            onClick={() => setToast(null)}
            role="status"
            aria-live="polite"
            className="toast-in pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-left shadow-sm"
          >
            <view.icon size={20} className={cn('mt-px shrink-0', view.color)} />
            <span className="min-w-0 flex-1">
              <span className="t-body-strong block text-ink">{toast.title}</span>
              {toast.message ? <span className="t-caption block text-muted">{toast.message}</span> : null}
            </span>
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Screen chrome
// ---------------------------------------------------------------------------

/** The single screen header: surface background, hairline below, title left, actions right. */
export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="mx-auto flex min-h-[60px] max-w-3xl items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="t-title truncate text-ink">{title}</h1>
          {subtitle ? <p className="t-caption truncate text-muted">{subtitle}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Centered content column used by every screen. */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-12 pt-4">{children}</main>;
}
