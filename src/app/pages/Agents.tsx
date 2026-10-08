import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Plus, SlidersHorizontal } from 'lucide-react'
import { CATEGORY_LABEL, formatEuro, scheduleText } from '@/core/types'
import { addAgent, findAgent, findSeller, latestMandate, revokeAgent, spentBy, updateMandate } from '@/core/workspace'
import { Badge, Button, Card, CardHeader, cn, Dialog, EmptyState, Eyebrow, Field, formatDate, formatDateTime, Input, Mono, Select, shortId, StatusBadge, VerdictBadge } from '@/ui/kit'
import { PageHeader, TH } from '../ConsoleLayout'
import { draftErrors, draftFromMandate, draftToSettings, EMPTY_DRAFT, MandateForm, type MandateDraft } from '../MandateForm'
import { AgentPassportCard, DecisionReport, ruleText } from '../parts'
import { useStore } from '../store'

const RUNTIMES = ['Sonnet-class model · MCP', 'Opus-class model · MCP', 'Haiku-class model', 'Open-weight model · local']

export function Agents() {
  const { ws } = useStore()
  const [creating, setCreating] = useState(false)
  const now = Date.now()

  return (
    <>
      <PageHeader
        title="Agents"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New agent
          </Button>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line">
              {['Agent', 'Mandate', 'Working hours', 'Transaction limit', 'This month', 'Status'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ws.agents.map((a) => {
              const mandate = latestMandate(ws, a.passport.id)
              return (
                <tr key={a.passport.id} className="hover:bg-sunken/50">
                  <td className="px-5 py-3.5">
                    <Link to={`/console/agents/${encodeURIComponent(a.passport.id)}`} className="font-semibold hover:text-gold">
                      {a.passport.name}
                    </Link>
                    <p className="text-[12px] text-ink-3">{a.passport.purpose}</p>
                  </td>
                  <td className="px-5 py-3.5">{mandate?.label ?? '—'}</td>
                  <td className="px-5 py-3.5 text-[13px] text-ink-2">{scheduleText(mandate?.schedule)}</td>
                  <td className="tabular px-5 py-3.5">{mandate ? formatEuro(mandate.limits.perTransaction) : '—'}</td>
                  <td className="tabular px-5 py-3.5">{formatEuro(spentBy(ws, a.passport.id, now).month)}</td>
                  <td className="px-5 py-3.5">{a.revokedAt === null ? <Badge tone="allow">Active</Badge> : <Badge tone="deny">Revoked</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <NewAgentDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <ul className="mt-5 rounded-sm bg-deny-soft px-4 py-3 text-[12px] text-deny">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  )
}

function NewAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ws, apply } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [identity, setIdentity] = useState({ name: '', purpose: '', runtime: RUNTIMES[0] })
  const [draft, setDraft] = useState<MandateDraft>(EMPTY_DRAFT)
  const errors = [...(identity.name.trim().length < 2 ? ['Give the agent a name.'] : []), ...draftErrors(draft)]

  const submit = async () => {
    setBusy(true)
    const mandate = draftToSettings(draft)
    let created = ''
    await apply(async (w) => {
      const result = await addAgent(w, { name: identity.name.trim(), purpose: identity.purpose.trim() || mandate.label, runtime: identity.runtime }, mandate, Date.now())
      created = result.agentId
      return result.ws
    })
    setBusy(false)
    onClose()
    navigate(`/console/agents/${encodeURIComponent(created)}`)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New agent"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={errors.length > 0 || busy}>
            {busy ? 'Signing' : 'Issue passport'}
          </Button>
        </>
      }
    >
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} placeholder="Mistral" autoFocus />
        </Field>
        <Field label="Runtime">
          <Select value={identity.runtime} onChange={(e) => setIdentity({ ...identity, runtime: e.target.value })}>
            {RUNTIMES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Purpose">
            <Input value={identity.purpose} onChange={(e) => setIdentity({ ...identity, purpose: e.target.value })} placeholder="Restaurant textile procurement" />
          </Field>
        </div>
      </div>
      <MandateForm draft={draft} onChange={setDraft} sellers={ws.sellers} />
      {identity.name.trim().length > 0 && <Errors errors={errors} />}
    </Dialog>
  )
}

function EditMandateDialog({ agentId, initial, onClose }: { agentId: string; initial: MandateDraft; onClose: () => void }) {
  const { ws, apply } = useStore()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(initial)
  const errors = draftErrors(draft)

  const submit = async () => {
    setBusy(true)
    await apply((w) => updateMandate(w, agentId, draftToSettings(draft), Date.now()))
    setBusy(false)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit mandate"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={errors.length > 0 || busy}>
            {busy ? 'Signing' : 'Sign and put in force'}
          </Button>
        </>
      }
    >
      <MandateForm draft={draft} onChange={setDraft} sellers={ws.sellers} />
      <Errors errors={errors} />
    </Dialog>
  )
}

export function AgentDetail() {
  const { id = '' } = useParams()
  const { ws, apply } = useStore()
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const agent = findAgent(ws, decodeURIComponent(id))
  if (!agent) return <Navigate to="/console/agents" replace />

  const mandate = latestMandate(ws, agent.passport.id)
  const now = Date.now()
  const spent = spentBy(ws, agent.passport.id, now)
  const purchases = ws.purchases.filter((p) => p.request.agentId === agent.passport.id).reverse()
  const revoked = agent.revokedAt !== null
  const versions = ws.mandates.filter((m) => m.agentId === agent.passport.id).length

  const bars = mandate
    ? [
        { label: 'Today', used: spent.today, limit: mandate.limits.daily },
        { label: 'This month', used: spent.month, limit: mandate.limits.monthly },
      ]
    : []

  const facts: Array<[string, string]> = mandate
    ? [
        ['Per transaction', formatEuro(mandate.limits.perTransaction)],
        ['Daily', formatEuro(mandate.limits.daily)],
        ['Monthly', formatEuro(mandate.limits.monthly)],
        ['Approval above', mandate.approvalAbove === null ? 'None' : formatEuro(mandate.approvalAbove)],
      ]
    : []

  return (
    <>
      <Link to="/console/agents" className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-gold">
        <ArrowLeft className="size-3.5" /> Agents
      </Link>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <AgentPassportCard agent={agent} principalName={ws.principal.name} />
          {revoked ? (
            <p className="rounded-sm bg-deny-soft px-4 py-3 text-[13px] text-deny">Revoked on {formatDate(agent.revokedAt!)}.</p>
          ) : (
            <>
              <Button onClick={() => setEditing(true)} disabled={!mandate}>
                <SlidersHorizontal /> Edit mandate
              </Button>
              <Button variant="danger" onClick={() => setConfirming(true)}>
                <Ban /> Revoke passport
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {mandate && (
            <Card>
              <CardHeader title={mandate.label} hint={`Until ${formatDate(mandate.expiresAt)} · version ${versions}`} action={<Mono>{shortId(mandate.id)}</Mono>} />
              <dl className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
                {facts.map(([k, v]) => (
                  <div key={k} className="px-5 py-4">
                    <dd className="tabular text-[20px]">{v}</dd>
                    <dt className="mt-1 text-[12px] text-ink-3">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="grid gap-6 p-5 sm:grid-cols-2">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3">
                    {bars.map((b) => (
                      <div key={b.label}>
                        <div className="flex justify-between text-[12px] text-ink-3">
                          <span>{b.label}</span>
                          <span className="tabular">
                            {formatEuro(b.used)} / {formatEuro(b.limit)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                          <div className={cn('h-full rounded-full', b.used / b.limit > 0.85 ? 'bg-deny' : 'bg-gold')} style={{ width: `${Math.min(100, (b.used / b.limit) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Eyebrow>Working hours</Eyebrow>
                    <p className="mt-1.5 text-[14px]">{scheduleText(mandate.schedule)}</p>
                  </div>
                  <div>
                    <Eyebrow>Sellers</Eyebrow>
                    <p className="mt-1.5 text-[14px]">{mandate.merchants === null ? 'Any verified manufacturer' : mandate.merchants.map((m) => findSeller(ws, m)?.name ?? m).join(', ')}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-5">
                  <div>
                    <Eyebrow>Categories</Eyebrow>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mandate.categories.map((c) => (
                        <Badge key={c}>{CATEGORY_LABEL[c]}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Eyebrow>Product rules</Eyebrow>
                    <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                      {mandate.productRules.length === 0 && <li className="text-ink-3">None</li>}
                      {mandate.productRules.map((r) => (
                        <li key={r.kind} className="flex gap-2.5">
                          <span className="mt-[8px] size-1 shrink-0 rounded-full bg-gold" />
                          {ruleText(r)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Request history" />
            {purchases.length === 0 ? (
              <EmptyState title="No requests yet" />
            ) : (
              <ul className="divide-y divide-line">
                {purchases.map((p) => (
                  <li key={p.request.id} className="flex flex-col gap-2 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[14px] font-medium">{findSeller(ws, p.request.sellerId)?.name}</span>
                      <span className="text-[12px] text-ink-3">
                        {p.request.quantity} units · {formatDateTime(p.request.requestedAt)}
                      </span>
                      <span className="tabular ml-auto text-[14px]">{formatEuro(p.request.total)}</span>
                      {p.decision.verdict === 'deny' ? <VerdictBadge verdict="deny" /> : <StatusBadge status={p.status} />}
                    </div>
                    <DecisionReport decision={p.decision} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && mandate && <EditMandateDialog agentId={agent.passport.id} initial={draftFromMandate(mandate)} onClose={() => setEditing(false)} />}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Revoke ${agent.passport.name}?`}
        hint="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await apply((w) => revokeAgent(w, agent.passport.id, Date.now()))
                setConfirming(false)
              }}
            >
              <Ban /> Revoke
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-ink-2">Pending credentials become unusable as well.</p>
      </Dialog>
    </>
  )
}
