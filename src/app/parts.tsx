import { useEffect, useState } from 'react'
import { Check, ChevronDown, CreditCard, Fingerprint, Lock, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { fingerprint } from '@/core/crypto'
import type { OneTimeCredential } from '@/core/credential'
import type { Check as PolicyCheck, CheckGroup, Decision } from '@/core/policy'
import { formatEuro, recycledShare, type Offer, type ProductPassport, type ProductRule } from '@/core/types'
import { isProductIntact, type AgentRecord, type Purchase, type Workspace } from '@/core/workspace'
import { Badge, Button, cn, Eyebrow, formatDate, Mark, shortId } from '@/ui/kit'

const GROUPS: CheckGroup[] = ['agent', 'mandate', 'budget', 'product']
const GROUP_LABEL: Record<CheckGroup, string> = { agent: 'Agent', mandate: 'Mandate', budget: 'Budget', product: 'Product passport' }

function CheckRow({ check }: { check: PolicyCheck }) {
  return (
    <li className="flex gap-2.5 py-1.5">
      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full', check.passed ? 'bg-allow-soft text-allow' : 'bg-deny text-onyx')}>
        {check.passed ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <p className={cn('text-[13px] font-medium', !check.passed && 'text-deny')}>{check.label}</p>
        <p className="text-[12px] text-ink-3">{check.detail}</p>
      </div>
    </li>
  )
}

/** The policy engine's decision report. Failed checks are always shown expanded. */
export function DecisionReport({ decision, defaultOpen = false }: { decision: Decision; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const failed = decision.checks.filter((c) => !c.passed)
  const passedCount = decision.checks.length - failed.length

  return (
    <div className="rounded-sm bg-onyx ring-1 ring-line">
      {failed.length > 0 && (
        <ul className="border-b border-line px-3 py-1.5">
          {failed.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      )}
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium text-ink-2 hover:text-ink">
        <span>
          {passedCount} of {decision.checks.length} checks passed
        </span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-x-6 border-t border-line px-3 py-2 sm:grid-cols-2">
          {GROUPS.map((group) => {
            const checks = decision.checks.filter((c) => c.group === group)
            if (!checks.length) return null
            return (
              <div key={group} className="py-1">
                <Eyebrow>{GROUP_LABEL[group]}</Eyebrow>
                <ul>
                  {checks.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function useFingerprint(key: JsonWebKey | undefined) {
  const [value, setValue] = useState('')
  useEffect(() => {
    let cancelled = false
    if (key) fingerprint(key).then((f) => !cancelled && setValue(f))
    return () => {
      cancelled = true
    }
  }, [key])
  return value
}

/** The passport as an identity card. */
export function AgentPassportCard({ agent, principalName, className }: { agent: AgentRecord; principalName: string; className?: string }) {
  const { passport } = agent
  const print = useFingerprint(passport.publicKey)
  const revoked = agent.revokedAt !== null
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-gradient-to-br from-[#14171d] to-onyx p-6 text-ink shadow-lift ring-1 ring-gold/25', className)}>
      <div className="absolute -right-12 -top-12 opacity-[0.06]">
        <Mark className="size-60 text-gold" />
      </div>
      <div className="relative flex items-start justify-between">
        <div>
          <Eyebrow className="text-gold">Agent passport</Eyebrow>
          <p className="font-display mt-2 text-[34px] leading-none">{passport.name}</p>
          <p className="mt-1.5 text-[13px] text-ink-2">{passport.purpose}</p>
        </div>
        {revoked ? <span className="animate-stamp rounded-sm border border-deny px-2.5 py-1 text-[12px] font-semibold text-deny">Revoked</span> : <Mark className="size-9 text-gold" />}
      </div>
      <dl className="relative mt-7 grid grid-cols-2 gap-x-6 gap-y-4 text-[12px]">
        <div>
          <dt className="text-ink-3">On behalf of</dt>
          <dd className="mt-0.5 font-medium">{principalName}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Runtime</dt>
          <dd className="mt-0.5 font-medium">{passport.runtime}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Identity</dt>
          <dd className="tabular mt-0.5">{shortId(passport.id)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Valid until</dt>
          <dd className="mt-0.5 font-medium">{formatDate(passport.expiresAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="flex items-center gap-1.5 text-ink-3">
            <Fingerprint className="size-3" /> Key fingerprint
          </dt>
          <dd className="tabular mt-0.5 tracking-wider">{print || '···· ···· ···· ····'}</dd>
        </div>
      </dl>
    </div>
  )
}

export function ruleText(rule: ProductRule): string {
  switch (rule.kind) {
    case 'requirePassport':
      return 'Valid product passport required'
    case 'maxCarbon':
      return `Carbon footprint at most ${rule.kgCO2ePerUnit} kg CO₂e per unit`
    case 'minRecycled':
      return `Recycled content at least ${rule.percent}%`
    case 'originIn':
      return `Origin: ${rule.countries.length > 4 ? `Türkiye and ${rule.countries.length - 1} EU countries` : rule.countries.join(', ')}`
    case 'requireCertification':
      return `Certification: ${rule.anyOf.join(' or ')}`
    case 'minRepairScore':
      return `Repairability at least ${rule.score}/10`
  }
}

export function useIntact(ws: Workspace, product: ProductPassport | undefined) {
  const [intact, setIntact] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    setIntact(null)
    if (product) isProductIntact(ws, product).then((ok) => !cancelled && setIntact(ok))
    return () => {
      cancelled = true
    }
  }, [ws, product])
  return intact
}

export function SignatureBadge({ intact }: { intact: boolean | null }) {
  if (intact === null) return <Badge>Verifying</Badge>
  return intact ? (
    <Badge tone="allow">
      <ShieldCheck /> Signature valid
    </Badge>
  ) : (
    <Badge tone="deny">
      <ShieldAlert /> Signature invalid
    </Badge>
  )
}

const MATERIAL_COLORS = ['#c9a24b', '#22c08a', '#6aa2f2', '#e3a52b', '#666d7b']

export function CompositionBar({ product }: { product: ProductPassport }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {product.composition.map((m, i) => (
          <div key={m.material} style={{ width: `${m.percent}%`, background: MATERIAL_COLORS[i % MATERIAL_COLORS.length] }} title={`${m.material} ${m.percent}%`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {product.composition.map((m, i) => (
          <li key={m.material} className="flex items-center gap-2 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: MATERIAL_COLORS[i % MATERIAL_COLORS.length] }} />
            <span className="flex-1">{m.material}</span>
            {m.recycledPercent > 0 && <span className="text-[12px] text-ink-3">{m.recycledPercent}% recycled</span>}
            <span className="tabular w-10 text-right">{m.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function productSummary(product: ProductPassport) {
  return { recycled: Math.round(recycledShare(product) * 10) / 10 }
}

/** All the agent ever receives: a narrow, short-lived virtual card. */
export function CredentialCard({ credential, sellerName }: { credential: OneTimeCredential; sellerName: string }) {
  const used = credential.usedAt !== null
  return (
    <div className="flex flex-col gap-3 rounded-md bg-gradient-to-br from-[#191d24] to-onyx p-4 text-ink ring-1 ring-gold/25 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <CreditCard className="size-5 text-gold" />
        <p className="tabular text-[15px] tracking-[0.14em]">•••• •••• •••• {credential.last4}</p>
      </div>
      <dl className="grid grid-cols-3 gap-4 text-[11px]">
        <div>
          <dt className="text-ink-3">Cap</dt>
          <dd className="tabular mt-0.5 text-[13px]">{formatEuro(credential.maxAmount)}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Locked to</dt>
          <dd className="mt-0.5 text-[13px] font-medium">{sellerName}</dd>
        </div>
        <div>
          <dt className="text-ink-3">Status</dt>
          <dd className="mt-0.5 text-[13px] font-medium">{used ? 'Used' : 'Valid 10 min'}</dd>
        </div>
      </dl>
    </div>
  )
}

/** The approval screen on the owner's phone. */
export function PhoneApproval({ purchase, offer, agentName, sellerName, onDecide, resolved }: { purchase: Purchase; offer: Offer; agentName: string; sellerName: string; onDecide?: (approve: boolean) => void; resolved: 'pending' | 'approved' | 'rejected' }) {
  const { request } = purchase
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] bg-onyx p-2 shadow-lift ring-1 ring-line-strong">
      <div className="rounded-[1.6rem] bg-surface px-4 pb-4 pt-3">
        <div className="mx-auto mb-4 h-1 w-14 rounded-full bg-line-strong" />
        <div className="flex items-center gap-2">
          <Mark className="size-4 text-gold" />
          <span className="text-[12px] font-semibold">Saign</span>
          <span className="ml-auto text-[11px] text-ink-3">now</span>
        </div>
        <p className="font-display mt-3 text-[16px] leading-snug">{agentName} needs your approval</p>
        <div className="mt-3 rounded-md bg-onyx p-3 ring-1 ring-line">
          <p className="text-[13px] font-medium">{offer.title}</p>
          <p className="tabular text-[12px] text-ink-3">
            {request.quantity} × {formatEuro(request.unitPrice)}
          </p>
          <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ink-3">Seller</dt>
              <dd className="font-medium">{sellerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Cap</dt>
              <dd className="tabular">{formatEuro(request.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">Product passport</dt>
              <dd className="flex items-center gap-1 font-medium text-allow">
                <ShieldCheck className="size-3" /> Verified
              </dd>
            </div>
          </dl>
        </div>
        {resolved === 'pending' ? (
          <div className="mt-3 flex flex-col gap-2">
            <Button className="w-full" onClick={() => onDecide?.(true)}>
              <Lock /> Approve
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onDecide?.(false)}>
              Reject
            </Button>
          </div>
        ) : (
          <div className={cn('animate-stamp mt-3 rounded-sm py-2.5 text-center text-[13px] font-semibold', resolved === 'approved' ? 'bg-allow-soft text-allow' : 'bg-deny-soft text-deny')}>
            {resolved === 'approved' ? 'Approved' : 'Rejected'}
          </div>
        )}
      </div>
    </div>
  )
}
