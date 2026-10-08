import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Check, Clock, X } from 'lucide-react'
import type { Verdict } from '@/core/policy'
import type { PurchaseStatus } from '@/core/workspace'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-onyx hover:bg-[#d8b25c]',
  secondary: 'text-ink ring-1 ring-inset ring-line-strong hover:ring-gold/60 hover:text-gold',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'text-deny ring-1 ring-inset ring-deny/40 hover:bg-deny-soft',
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' && 'h-8 px-3 text-[12px]',
        size === 'md' && 'h-9.5 px-4 text-[13px]',
        size === 'lg' && 'h-12 px-7 text-[14px]',
        BUTTON[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-md bg-surface shadow-card ring-1 ring-line', className)}>{children}</div>
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h3 className="font-display text-[15px]">{title}</h3>
        {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/** Small label above a heading or a value. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  // Skip the default colour when one is passed in; otherwise CSS order decides which wins
  return <p className={cn('font-display text-[12px] font-medium tracking-normal', !className?.includes('text-') && 'text-ink-3', className)}>{children}</p>
}

/** Machine values: ids, hashes, signatures. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tabular text-[12px]', !className?.includes('text-') && 'text-ink-2', className)}>{children}</span>
}

export const shortId = (id: string) => id.split(':').slice(1).join(':')
export const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`

type Tone = 'allow' | 'review' | 'deny' | 'neutral' | 'info'

const TONE: Record<Tone, string> = {
  allow: 'bg-allow-soft text-allow',
  review: 'bg-review-soft text-review',
  deny: 'bg-deny-soft text-deny',
  neutral: 'bg-sunken text-ink-2',
  info: 'bg-info-soft text-info',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] font-medium whitespace-nowrap [&_svg]:size-3', TONE[tone], className)}>{children}</span>
}

const VERDICT: Record<Verdict, { tone: Tone; label: string; icon: ReactNode }> = {
  allow: { tone: 'allow', label: 'Allowed', icon: <Check /> },
  review: { tone: 'review', label: 'Needs approval', icon: <Clock /> },
  deny: { tone: 'deny', label: 'Denied', icon: <X /> },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict]
  return (
    <Badge tone={v.tone}>
      {v.icon}
      {v.label}
    </Badge>
  )
}

const STATUS: Record<PurchaseStatus, { tone: Tone; label: string }> = {
  denied: { tone: 'deny', label: 'Denied' },
  'awaiting-approval': { tone: 'review', label: 'Awaiting approval' },
  'approval-rejected': { tone: 'deny', label: 'Rejected by owner' },
  'payment-ready': { tone: 'info', label: 'Credential ready' },
  settled: { tone: 'allow', label: 'Settled' },
}

export function StatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}

const INPUT = 'h-9.5 w-full rounded-sm bg-onyx px-3 text-sm ring-1 ring-inset ring-line-strong outline-none transition-shadow placeholder:text-ink-3 focus:ring-2 focus:ring-gold'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(INPUT, 'pr-8', className)} {...props} />
}

export function Dialog({ open, onClose, title, hint, children, footer }: { open: boolean; onClose: () => void; title: string; hint?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-rise flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-md bg-surface shadow-lift ring-1 ring-line-strong sm:rounded-md" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-[18px]">{title}</h2>
            {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-sm p-1.5 text-ink-3 hover:bg-sunken hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

/** Saign emblem: a signature stroke inside a thin gold frame. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M31 16.5c-2-2.2-5-3.2-8.2-2.8-3.6.5-6 2.8-5.7 5.6.7 6.4 14.6 3.2 15.1 10.2.2 3.1-2.9 5.3-7.3 5.3-3.6 0-6.6-1.3-8.4-3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Wordmark with the "ai" syllable in gold. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark className="size-6 text-gold" />
      <span className="font-display text-[22px] leading-none">
        S<span className="text-gold">ai</span>gn
      </span>
    </span>
  )
}

export function EmptyState({ title }: { title: string }) {
  return <p className="px-6 py-12 text-center text-[14px] text-ink-3">{title}</p>
}

export const formatDateTime = (at: number) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at)
export const formatDate = (at: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(at)
