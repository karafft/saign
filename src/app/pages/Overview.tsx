import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PlayCircle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { verifyChain, type ChainStatus } from '@/core/ledger'
import { formatEuro } from '@/core/types'
import { findAgent, findSeller, latestMandate, spentBy } from '@/core/workspace'
import { Button, Card, CardHeader, EmptyState, Eyebrow, formatDateTime, StatusBadge, VerdictBadge } from '@/ui/kit'
import { PageHeader } from '../ConsoleLayout'
import { useStore } from '../store'

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className="tabular mt-3 text-[30px] leading-none">{value}</p>
      <p className="mt-2 text-[13px] text-ink-3">{hint}</p>
    </Card>
  )
}

export function Overview() {
  const { ws } = useStore()
  const [chain, setChain] = useState<ChainStatus | null>(null)
  useEffect(() => {
    verifyChain(ws.ledger).then(setChain)
  }, [ws.ledger])

  const now = Date.now()
  const active = ws.agents.filter((a) => a.revokedAt === null)
  const monthSpend = active.reduce((sum, a) => sum + spentBy(ws, a.passport.id, now).month, 0)
  const denied = ws.purchases.filter((p) => p.decision.verdict === 'deny').length
  const recent = [...ws.purchases].reverse().slice(0, 7)

  return (
    <>
      <PageHeader
        title="Overview"
        action={
          <Link to="/console/scenario">
            <Button>
              <PlayCircle /> Run a scenario
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active agents" value={String(active.length)} hint={`${ws.agents.length - active.length} revoked`} />
        <Stat label="Spent this month" value={formatEuro(monthSpend)} hint="Settled and pending" />
        <Stat label="Requests blocked" value={String(denied)} hint={`of ${ws.purchases.length} total`} />
        <Stat label="Product passports" value={String(ws.products.length)} hint={`${ws.sellers.filter((s) => s.verified).length} verified manufacturers`} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Latest decisions" />
          {recent.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((p) => (
                <li key={p.request.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {findAgent(ws, p.request.agentId)?.passport.name} → {findSeller(ws, p.request.sellerId)?.name}
                    </p>
                    <p className="truncate text-[12px] text-ink-3">{p.decision.verdict === 'deny' ? p.decision.reason : `${p.request.quantity} units · ${formatDateTime(p.request.requestedAt)}`}</p>
                  </div>
                  <span className="tabular text-[14px]">{formatEuro(p.request.total)}</span>
                  {p.decision.verdict === 'deny' ? <VerdictBadge verdict="deny" /> : <StatusBadge status={p.status} />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <Eyebrow>Audit ledger</Eyebrow>
            <div className="mt-3 flex items-center gap-3">
              {chain?.valid === false ? <ShieldAlert className="size-8 text-deny" /> : <ShieldCheck className="size-8 text-allow" />}
              <div>
                <p className="text-[15px] font-semibold">{chain === null ? 'Verifying' : chain.valid ? 'Chain intact' : `Chain broken at entry ${chain.brokenAt}`}</p>
                <p className="tabular text-[13px] text-ink-3">{ws.ledger.length} entries</p>
              </div>
            </div>
            <Link to="/console/ledger" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-gold hover:underline">
              Open ledger <ArrowRight className="size-3.5" />
            </Link>
          </Card>

          <Card>
            <CardHeader title="Agent limits" />
            <ul className="flex flex-col gap-4 p-5">
              {active.map((a) => {
                const mandate = latestMandate(ws, a.passport.id)
                if (!mandate) return null
                const spent = spentBy(ws, a.passport.id, now).month
                const ratio = Math.min(1, spent / mandate.limits.monthly)
                return (
                  <li key={a.passport.id}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <Link to={`/console/agents/${encodeURIComponent(a.passport.id)}`} className="font-medium hover:text-gold">
                        {a.passport.name}
                      </Link>
                      <span className="tabular text-ink-3">
                        {formatEuro(spent)} / {formatEuro(mandate.limits.monthly)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${ratio * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
