import { formatEuro } from '@/core/types'
import { findAgent, findSeller } from '@/core/workspace'
import { TickerTape, type Tick } from '@/ui/TickerTape'
import { useStore } from './store'

/** The tape above the console: the newest decisions in this workspace. */
export function Ticker() {
  const { ws } = useStore()
  const ticks: Tick[] = [...ws.purchases]
    .reverse()
    .slice(0, 16)
    .map((p) => ({
      pair: `${findAgent(ws, p.request.agentId)?.passport.name ?? '—'} → ${findSeller(ws, p.request.sellerId)?.name ?? '—'}`,
      amount: formatEuro(p.request.total),
      verdict: p.status === 'approval-rejected' ? 'deny' : p.decision.verdict,
    }))
  return <TickerTape ticks={ticks} />
}
