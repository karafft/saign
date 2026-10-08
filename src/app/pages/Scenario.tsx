import { useEffect, useRef, useState } from 'react'
import { Check, Play, Receipt, Square } from 'lucide-react'
import { formatEuro } from '@/core/types'
import { findAgent, findSeller } from '@/core/workspace'
import { Badge, Button, Card, cn, Field, Input, Mono, Select, shortId, VerdictBadge } from '@/ui/kit'
import { PageHeader } from '../ConsoleLayout'
import { CredentialCard, DecisionReport, PhoneApproval } from '../parts'
import { PRESETS, TASKS, useScenario, type Step, type StepTone } from '../scenario'
import { useStore } from '../store'

const DOT: Record<StepTone, string> = {
  neutral: 'bg-line-strong',
  allow: 'bg-allow',
  review: 'bg-review',
  deny: 'bg-deny',
}

const option = (selected: boolean) => cn('w-full rounded-sm px-3 py-2.5 text-left transition-colors disabled:opacity-60', selected ? 'bg-sunken shadow-[inset_2px_0_0_var(--color-gold)]' : 'hover:bg-sunken/60')

export function Scenario() {
  const { ws } = useStore()
  const { steps, running, run, decide, stop } = useScenario()
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id)
  const [pickedAgent, setAgentId] = useState(ws.agents[0]?.passport.id ?? '')
  // Ids change when the demo is reset; fall back to the first agent if the selection went stale
  const agentId = ws.agents.some((a) => a.passport.id === pickedAgent) ? pickedAgent : (ws.agents[0]?.passport.id ?? '')
  const [taskId, setTaskId] = useState(TASKS[0].id)
  const [quantity, setQuantity] = useState(300)
  const [cleanStart, setCleanStart] = useState(true)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [steps.length])

  const start = () => {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (preset) {
      run({ agent: { name: preset.agentName }, task: TASKS.find((t) => t.id === preset.taskId)!, quantity: preset.quantity, tamperSeller: preset.tamperSeller, offHours: preset.offHours, cleanStart })
      return
    }
    run({ agent: { id: agentId }, task: TASKS.find((t) => t.id === taskId)!, quantity: Math.max(1, Math.floor(quantity)) })
  }

  return (
    <>
      <PageHeader title="Live scenario" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-2">
            <ul className="flex flex-col">
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setPresetId(p.id)} disabled={running} className={option(presetId === p.id)}>
                    <p className="text-[14px] font-medium">{p.title}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-ink-3">{p.description}</p>
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => setPresetId(null)} disabled={running} className={option(presetId === null)}>
                  <p className="text-[14px] font-medium">Custom task</p>
                </button>
              </li>
            </ul>
          </Card>

          {presetId === null && (
            <Card className="flex flex-col gap-4 p-4">
              <Field label="Agent">
                <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {ws.agents.map((a) => (
                    <option key={a.passport.id} value={a.passport.id}>
                      {a.passport.name}
                      {a.revokedAt !== null ? ' (revoked)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Product">
                <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                  {TASKS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantity">
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </Field>
            </Card>
          )}

          {presetId !== null && (
            <label className="flex items-start gap-2.5 px-1 text-[13px] text-ink-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-gold" checked={cleanStart} disabled={running} onChange={(e) => setCleanStart(e.target.checked)} />
              <span>
                Reset demo data first
                <span className="block text-[12px] text-ink-3">Agents and products you added are removed.</span>
              </span>
            </label>
          )}

          {running ? (
            <Button variant="secondary" size="lg" onClick={stop}>
              <Square /> Stop
            </Button>
          ) : (
            <Button size="lg" onClick={start}>
              <Play /> Run scenario
            </Button>
          )}
        </div>

        <Card className="min-h-[520px] p-5 sm:p-7">
          {steps.length === 0 ? (
            <div className="flex h-full min-h-[440px] items-center justify-center">
              <p className="font-display text-[24px] text-ink-3">Pick a scenario</p>
            </div>
          ) : (
            <ol className="relative flex flex-col gap-6">
              <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line" aria-hidden="true" />
              {steps.map((step) => (
                <li key={step.key} className="animate-rise relative pl-7">
                  <span className={cn('absolute left-0 top-1.5 size-[11px] rounded-full ring-4 ring-surface', DOT[step.tone])} />
                  <StepView step={step} onDecide={decide} />
                </li>
              ))}
              {running && steps.at(-1)?.kind !== 'approval' && (
                <li className="relative pl-7 text-[13px] text-ink-3">
                  <span className="absolute left-0 top-1.5 size-[11px] animate-pulse rounded-full bg-line-strong ring-4 ring-surface" />
                  Running
                </li>
              )}
            </ol>
          )}
          <div ref={end} />
        </Card>
      </div>
    </>
  )
}

function StepView({ step, onDecide }: { step: Step; onDecide: (approve: boolean) => void }) {
  const { ws } = useStore()
  const heading = <p className="text-[15px] font-semibold">{step.title}</p>

  switch (step.kind) {
    case 'note':
      return (
        <div>
          {heading}
          {step.body && <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{step.body}</p>}
        </div>
      )

    case 'offers':
      return (
        <div>
          {heading}
          <ul className="mt-2 divide-y divide-line rounded-sm ring-1 ring-line">
            {step.offers.map((o, i) => {
              const seller = findSeller(ws, o.sellerId)
              return (
                <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <span className="tabular w-4 text-ink-3">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{seller?.name}</span> <span className="text-ink-3">· {seller?.city}</span>
                  </span>
                  {o.productId ? <Badge tone="info">Passport</Badge> : <Badge>No passport</Badge>}
                  <span className="tabular w-16 text-right">{formatEuro(o.unitPrice)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )

    case 'decision':
      return (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {heading}
            <VerdictBadge verdict={step.purchase.decision.verdict} />
          </div>
          <p className="mb-2 mt-1">
            <Mono className="text-ink-3">{shortId(step.purchase.request.id)}</Mono>
          </p>
          <DecisionReport decision={step.purchase.decision} />
        </div>
      )

    case 'approval':
      return (
        <div>
          {heading}
          <p className="mb-4 mt-1 text-[14px] text-ink-2">{step.purchase.decision.reason}</p>
          <PhoneApproval
            purchase={step.purchase}
            offer={step.offer}
            agentName={findAgent(ws, step.purchase.request.agentId)?.passport.name ?? ''}
            sellerName={findSeller(ws, step.offer.sellerId)?.name ?? ''}
            resolved={step.resolved}
            onDecide={onDecide}
          />
        </div>
      )

    case 'credential':
      return (
        <div>
          {heading}
          <div className="h-3" />
          <CredentialCard credential={step.credential} sellerName={step.sellerName} />
        </div>
      )

    case 'receipt': {
      const { request } = step.purchase
      return (
        <div>
          {heading}
          <div className="mt-2 rounded-sm bg-allow-soft p-4 ring-1 ring-allow/25">
            <div className="flex items-center gap-2 text-allow">
              <Receipt className="size-4" />
              <span className="text-[13px] font-semibold">Receipt</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
              {['Agent passport re-verified by the seller', 'Request signature matches the passport key', 'Credential used and closed'].map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <Check className="size-3.5 text-allow" /> {line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-allow/20 pt-3">
              <span className="text-[13px] text-ink-2">
                {step.sellerName} · {request.quantity} units
              </span>
              <span className="tabular text-[22px] text-allow">{formatEuro(request.total)}</span>
            </div>
          </div>
        </div>
      )
    }
  }
}
