import { cn } from './kit'

export interface Tick {
  pair: string
  amount: string
  verdict: 'allow' | 'review' | 'deny'
}

const LABEL: Record<Tick['verdict'], string> = { allow: 'Allowed', review: 'Review', deny: 'Denied' }
const SIGN: Record<Tick['verdict'], string> = { allow: '▲', review: '■', deny: '▼' }
const TONE: Record<Tick['verdict'], string> = { allow: 'text-allow', review: 'text-review', deny: 'text-deny' }

/** Market tape: the latest decisions scroll past. The list is rendered twice for a seamless loop. */
export function TickerTape({ ticks, className }: { ticks: Tick[]; className?: string }) {
  if (ticks.length === 0) return null
  // Pad to at least 12 items so the tape never runs short
  const filled = Array.from({ length: Math.max(12, ticks.length) }, (_, i) => ticks[i % ticks.length])
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {filled.map((t, i) => (
        <li key={i} className="tabular flex items-center gap-3 px-6 text-[12px]">
          <span className="text-ink-2">{t.pair}</span>
          <span className="text-ink">{t.amount}</span>
          <span className={cn('flex items-center gap-1 font-semibold', TONE[t.verdict])}>
            <span className="text-[8px]">{SIGN[t.verdict]}</span>
            {LABEL[t.verdict]}
          </span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className={cn('overflow-hidden border-b border-line bg-onyx py-2', className)}>
      <div className="animate-ticker flex w-max hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
