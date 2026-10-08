import { Check, Minus, X } from 'lucide-react'
import { CATEGORY_LABEL, type Category, type Seller } from '@/core/types'
import { latestMandate, type AgentRecord, type Workspace } from '@/core/workspace'
import { Card, CardHeader, cn } from '@/ui/kit'
import { PageHeader, TH } from '../ConsoleLayout'
import { useStore } from '../store'

type Cell = { state: 'allow' | 'deny' | 'none'; why: string }

function sellerCell(ws: Workspace, agent: AgentRecord, seller: Seller, now: number): Cell {
  const mandate = latestMandate(ws, agent.passport.id)
  if (agent.revokedAt !== null) return { state: 'deny', why: 'Agent passport revoked.' }
  if (!mandate || now >= mandate.expiresAt) return { state: 'deny', why: 'No mandate in force.' }
  if (!seller.verified) return { state: 'deny', why: 'Seller is unverified; no key in the trust registry.' }
  if (mandate.merchants !== null && !mandate.merchants.includes(seller.id)) return { state: 'deny', why: "Seller is not on this mandate's allow list." }
  const sells = ws.offers.some((o) => o.sellerId === seller.id && mandate.categories.includes(o.category))
  if (!sells) return { state: 'none', why: "Seller has no offers in this agent's categories." }
  return { state: 'allow', why: 'Allowed.' }
}

function categoryCell(ws: Workspace, agent: AgentRecord, category: Category, now: number): Cell {
  const mandate = latestMandate(ws, agent.passport.id)
  if (agent.revokedAt !== null) return { state: 'deny', why: 'Agent passport revoked.' }
  if (!mandate || now >= mandate.expiresAt) return { state: 'deny', why: 'No mandate in force.' }
  return mandate.categories.includes(category) ? { state: 'allow', why: 'Category in scope.' } : { state: 'deny', why: 'Category out of scope.' }
}

function Mark({ cell }: { cell: Cell }) {
  return (
    <span
      title={cell.why}
      className={cn(
        'mx-auto flex size-7 items-center justify-center rounded-sm',
        cell.state === 'allow' && 'bg-allow-soft text-allow',
        cell.state === 'deny' && 'bg-deny-soft text-deny',
        cell.state === 'none' && 'bg-sunken text-ink-3',
      )}
    >
      {cell.state === 'allow' ? <Check className="size-3.5" strokeWidth={3} /> : cell.state === 'deny' ? <X className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" />}
    </span>
  )
}

function Grid<T>({ columns, label, cell }: { columns: T[]; label: (c: T) => { title: string; sub?: string }; cell: (agent: AgentRecord, column: T) => Cell }) {
  const { ws } = useStore()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="border-b border-line">
            <th className={TH}>Agent</th>
            {columns.map((c) => {
              const l = label(c)
              return (
                <th key={l.title} className="px-3 py-3 text-center font-medium">
                  <span className="block text-[13px]">{l.title}</span>
                  {l.sub && <span className="block text-[11px] font-normal text-ink-3">{l.sub}</span>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ws.agents.map((a) => (
            <tr key={a.passport.id}>
              <td className="px-5 py-3">
                <span className={cn('font-semibold', a.revokedAt !== null && 'text-ink-3 line-through')}>{a.passport.name}</span>
              </td>
              {columns.map((c) => (
                <td key={label(c).title} className="px-3 py-3">
                  <Mark cell={cell(a, c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Matrix() {
  const { ws } = useStore()
  const now = Date.now()
  return (
    <>
      <PageHeader title="Authority matrix" />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Agent × seller" />
          <Grid columns={ws.sellers} label={(s) => ({ title: s.name, sub: s.verified ? s.city : 'unverified' })} cell={(a, s) => sellerCell(ws, a, s, now)} />
        </Card>
        <Card>
          <CardHeader title="Agent × category" />
          <Grid columns={Object.keys(CATEGORY_LABEL) as Category[]} label={(c) => ({ title: CATEGORY_LABEL[c] })} cell={(a, c) => categoryCell(ws, a, c, now)} />
        </Card>
      </div>
    </>
  )
}
