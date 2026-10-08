import { useEffect, useState } from 'react'
import { Download, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react'
import { GENESIS_HASH, verifyChain, type ChainStatus, type LedgerEntry, type LedgerKind } from '@/core/ledger'
import { findAgent, findSeller, type Workspace } from '@/core/workspace'
import { Badge, Button, Card, cn, formatDateTime, Mono, shortHash } from '@/ui/kit'
import { PageHeader, TH } from '../ConsoleLayout'
import { useStore } from '../store'

const KIND: Record<LedgerKind, { label: string; tone: 'allow' | 'review' | 'deny' | 'neutral' | 'info' }> = {
  'agent.issued': { label: 'Agent passport', tone: 'neutral' },
  'agent.revoked': { label: 'Revocation', tone: 'deny' },
  'mandate.issued': { label: 'Mandate', tone: 'neutral' },
  'passport.issued': { label: 'Product passport', tone: 'neutral' },
  'request.allowed': { label: 'Allowed', tone: 'allow' },
  'request.review': { label: 'Sent to review', tone: 'review' },
  'request.denied': { label: 'Denied', tone: 'deny' },
  'approval.granted': { label: 'Approved', tone: 'allow' },
  'approval.rejected': { label: 'Rejected', tone: 'deny' },
  'payment.credential': { label: 'Credential', tone: 'info' },
  'payment.settled': { label: 'Settled', tone: 'allow' },
  'payment.refused': { label: 'Charge refused', tone: 'deny' },
}

function actorName(ws: Workspace, id: string) {
  if (id === ws.principal.id) return ws.principal.name
  return findAgent(ws, id)?.passport.name ?? findSeller(ws, id)?.name ?? id
}

export function Ledger() {
  const { ws } = useStore()
  // The tampering demo only touches this page's copy; the real ledger is never changed
  const [tamperedAt, setTamperedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<ChainStatus | null>(null)

  const chain: LedgerEntry[] = tamperedAt === null ? ws.ledger : ws.ledger.map((e, i) => (i === tamperedAt ? { ...e, summary: `${e.summary.replace(/\d/g, '9')} (edited afterwards)` } : e))

  useEffect(() => {
    let cancelled = false
    verifyChain(chain).then((s) => !cancelled && setStatus(s))
    return () => {
      cancelled = true
    }
    // `chain` is rebuilt on every render; tracking its two sources is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.ledger, tamperedAt])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(ws.ledger, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saign-audit-ledger.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const brokenAt = status && !status.valid ? status.brokenAt : null
  const rows = [...chain].reverse()

  return (
    <>
      <PageHeader
        title="Audit ledger"
        action={
          <Button variant="secondary" onClick={exportJson}>
            <Download /> Download JSON
          </Button>
        }
      />

      <Card className={cn('mb-6 flex flex-wrap items-center gap-4 p-5', brokenAt !== null && 'ring-deny/40')}>
        {brokenAt === null ? <ShieldCheck className="size-9 text-allow" /> : <ShieldAlert className="size-9 text-deny" />}
        <p className="min-w-0 flex-1 text-[16px] font-semibold">
          {status === null ? 'Verifying chain' : brokenAt === null ? `Chain intact: all ${chain.length} entries verified` : `Chain broken at entry #${brokenAt}`}
        </p>
        {tamperedAt === null ? (
          <Button variant="danger" size="sm" disabled={ws.ledger.length < 4} onClick={() => setTamperedAt(Math.max(1, ws.ledger.length - 4))}>
            Demo: tamper with an entry
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setTamperedAt(null)}>
            <Undo2 /> Undo
          </Button>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {['#', 'Time', 'Event', 'Actor', 'Summary', 'Previous → this hash'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => {
              const broken = brokenAt !== null && e.index >= brokenAt
              return (
                <tr key={e.index} className={cn(broken && 'bg-deny-soft')}>
                  <td className="tabular px-5 py-3 align-top text-ink-3">{e.index}</td>
                  <td className="tabular px-5 py-3 align-top text-ink-2">{formatDateTime(e.at)}</td>
                  <td className="px-5 py-3 align-top">
                    <Badge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Badge>
                  </td>
                  <td className="px-5 py-3 align-top font-medium whitespace-nowrap">{actorName(ws, e.actor)}</td>
                  <td className={cn('px-5 py-3 align-top leading-relaxed', e.index === brokenAt && 'font-medium text-deny')}>{e.summary}</td>
                  <td className="px-5 py-3 align-top whitespace-nowrap">
                    <Mono className="text-ink-3">{e.prevHash === GENESIS_HASH ? 'genesis' : shortHash(e.prevHash)}</Mono>
                    <br />
                    <Mono className={broken ? 'text-deny' : undefined}>{shortHash(e.hash)}</Mono>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}
