import type { ReactNode } from 'react'
import { CATEGORY_LABEL, DAY_LABELS, type Category, type Mandate, type ProductRule, type Seller } from '@/core/types'
import type { MandateSettings } from '@/core/workspace'
import { EU_AND_TR } from '@/data/seed'
import { cn, Eyebrow, Field, Input, Select } from '@/ui/kit'

/** The form's flat shape. Numbers are kept as text so a field can be edited while empty. */
export interface MandateDraft {
  label: string
  perTransaction: string
  daily: string
  monthly: string
  approvalAbove: string
  validDays: string
  categories: Category[]
  anyMerchant: boolean
  merchants: string[]
  alwaysOn: boolean
  days: number[]
  fromHour: number
  toHour: number
  requirePassport: boolean
  maxCarbon: string
  minRecycled: string
  minRepairScore: string
  euOrigin: boolean
  certifications: string
}

export const EMPTY_DRAFT: MandateDraft = {
  label: '',
  perTransaction: '1000',
  daily: '2500',
  monthly: '10000',
  approvalAbove: '500',
  validDays: '180',
  categories: ['home-textiles'],
  anyMerchant: true,
  merchants: [],
  alwaysOn: true,
  days: [1, 2, 3, 4, 5],
  fromHour: 9,
  toHour: 18,
  requirePassport: true,
  maxCarbon: '',
  minRecycled: '',
  minRepairScore: '',
  euOrigin: false,
  certifications: '',
}

const fromCents = (cents: number) => String(cents / 100)
const toCents = (value: string) => Math.max(0, Math.round(Number(value) * 100))
const positive = (value: string) => Number(value) > 0

/** Opens the mandate in force as an editable draft. */
export function draftFromMandate(mandate: Mandate): MandateDraft {
  const rule = <K extends ProductRule['kind']>(kind: K) => mandate.productRules.find((r) => r.kind === kind) as Extract<ProductRule, { kind: K }> | undefined
  const schedule = mandate.schedule ?? null
  return {
    label: mandate.label,
    perTransaction: fromCents(mandate.limits.perTransaction),
    daily: fromCents(mandate.limits.daily),
    monthly: fromCents(mandate.limits.monthly),
    approvalAbove: mandate.approvalAbove === null ? '' : fromCents(mandate.approvalAbove),
    validDays: '180',
    categories: mandate.categories,
    anyMerchant: mandate.merchants === null,
    merchants: mandate.merchants ?? [],
    alwaysOn: schedule === null,
    days: schedule?.days ?? EMPTY_DRAFT.days,
    fromHour: schedule?.fromHour ?? EMPTY_DRAFT.fromHour,
    toHour: schedule?.toHour ?? EMPTY_DRAFT.toHour,
    requirePassport: !!rule('requirePassport'),
    maxCarbon: rule('maxCarbon') ? String(rule('maxCarbon')!.kgCO2ePerUnit) : '',
    minRecycled: rule('minRecycled') ? String(rule('minRecycled')!.percent) : '',
    minRepairScore: rule('minRepairScore') ? String(rule('minRepairScore')!.score) : '',
    euOrigin: !!rule('originIn'),
    certifications: rule('requireCertification')?.anyOf.join(', ') ?? '',
  }
}

export function draftErrors(draft: MandateDraft): string[] {
  const errors: string[] = []
  if (!positive(draft.perTransaction)) errors.push('Transaction limit must be above zero.')
  if (toCents(draft.daily) < toCents(draft.perTransaction)) errors.push('Daily limit cannot be below the transaction limit.')
  if (toCents(draft.monthly) < toCents(draft.daily)) errors.push('Monthly limit cannot be below the daily limit.')
  if (draft.categories.length === 0) errors.push('Pick at least one category.')
  if (!draft.anyMerchant && draft.merchants.length === 0) errors.push('Pick at least one seller.')
  if (!draft.alwaysOn && draft.days.length === 0) errors.push('Pick at least one day.')
  if (!draft.alwaysOn && draft.fromHour === draft.toHour) errors.push('Start and end hour cannot be the same.')
  if (!positive(draft.validDays)) errors.push('Validity must be at least 1 day.')
  return errors
}

export function draftToSettings(draft: MandateDraft): MandateSettings {
  const productRules: ProductRule[] = []
  if (draft.requirePassport) productRules.push({ kind: 'requirePassport' })
  if (positive(draft.maxCarbon)) productRules.push({ kind: 'maxCarbon', kgCO2ePerUnit: Number(draft.maxCarbon) })
  if (positive(draft.minRecycled)) productRules.push({ kind: 'minRecycled', percent: Math.min(100, Number(draft.minRecycled)) })
  if (positive(draft.minRepairScore)) productRules.push({ kind: 'minRepairScore', score: Math.min(10, Number(draft.minRepairScore)) })
  if (draft.euOrigin) productRules.push({ kind: 'originIn', countries: EU_AND_TR })
  const certifications = draft.certifications
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  if (certifications.length) productRules.push({ kind: 'requireCertification', anyOf: certifications })

  return {
    label: draft.label.trim() || `${draft.categories.map((c) => CATEGORY_LABEL[c]).join(', ')} purchasing`,
    limits: { perTransaction: toCents(draft.perTransaction), daily: toCents(draft.daily), monthly: toCents(draft.monthly) },
    approvalAbove: positive(draft.approvalAbove) ? toCents(draft.approvalAbove) : null,
    categories: draft.categories,
    merchants: draft.anyMerchant ? null : draft.merchants,
    schedule: draft.alwaysOn ? null : { days: [...draft.days].sort(), fromHour: draft.fromHour, toHour: draft.toHour },
    productRules,
    validDays: Math.round(Number(draft.validDays)),
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5">
      <Eyebrow className="text-gold">{title}</Eyebrow>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </fieldset>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-sm px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors', active ? 'bg-gold-soft text-gold ring-gold/50' : 'text-ink-2 ring-line-strong hover:text-ink')}
    >
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 text-[13px]">
      <input type="checkbox" className="size-4 accent-gold" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
const HOURS = Array.from({ length: 25 }, (_, h) => h)
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

export function MandateForm({ draft, onChange, sellers }: { draft: MandateDraft; onChange: (draft: MandateDraft) => void; sellers: Seller[] }) {
  const set = <K extends keyof MandateDraft>(key: K, value: MandateDraft[K]) => onChange({ ...draft, [key]: value })
  const verified = sellers.filter((s) => s.verified)

  return (
    <div className="flex flex-col gap-5">
      <Group title="Mandate">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Name">
            <Input value={draft.label} onChange={(e) => set('label', e.target.value)} placeholder="Home textile purchasing" />
          </Field>
          <Field label="Valid for (days)">
            <Input type="number" min={1} value={draft.validDays} onChange={(e) => set('validDays', e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium">Categories</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <Chip key={c} active={draft.categories.includes(c)} onClick={() => set('categories', toggleIn(draft.categories, c))}>
                {CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Spending limits (€)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Transaction">
            <Input type="number" min={1} value={draft.perTransaction} onChange={(e) => set('perTransaction', e.target.value)} />
          </Field>
          <Field label="Daily">
            <Input type="number" min={1} value={draft.daily} onChange={(e) => set('daily', e.target.value)} />
          </Field>
          <Field label="Monthly">
            <Input type="number" min={1} value={draft.monthly} onChange={(e) => set('monthly', e.target.value)} />
          </Field>
          <Field label="Approval above" hint="Empty: none">
            <Input type="number" min={0} value={draft.approvalAbove} onChange={(e) => set('approvalAbove', e.target.value)} />
          </Field>
        </div>
      </Group>

      <Group title="Working hours">
        <Toggle checked={draft.alwaysOn} onChange={(v) => set('alwaysOn', v)}>
          24 / 7
        </Toggle>
        {!draft.alwaysOn && (
          <>
            <div className="flex flex-wrap gap-2">
              {WEEK.map((d) => (
                <Chip key={d} active={draft.days.includes(d)} onClick={() => set('days', toggleIn(draft.days, d))}>
                  {DAY_LABELS[d]}
                </Chip>
              ))}
            </div>
            <div className="grid max-w-xs grid-cols-2 gap-4">
              <Field label="From">
                <Select value={draft.fromHour} onChange={(e) => set('fromHour', Number(e.target.value))}>
                  {HOURS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="To">
                <Select value={draft.toHour} onChange={(e) => set('toHour', Number(e.target.value))}>
                  {HOURS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        )}
      </Group>

      <Group title="Sellers">
        <Toggle checked={draft.anyMerchant} onChange={(v) => set('anyMerchant', v)}>
          Any verified manufacturer
        </Toggle>
        {!draft.anyMerchant && (
          <div className="flex flex-wrap gap-2">
            {verified.map((s) => (
              <Chip key={s.id} active={draft.merchants.includes(s.id)} onClick={() => set('merchants', toggleIn(draft.merchants, s.id))}>
                {s.name}
              </Chip>
            ))}
          </div>
        )}
      </Group>

      <Group title="Product rules">
        <Toggle checked={draft.requirePassport} onChange={(v) => set('requirePassport', v)}>
          Product passport required
        </Toggle>
        <Toggle checked={draft.euOrigin} onChange={(v) => set('euOrigin', v)}>
          Türkiye and EU origin only
        </Toggle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Max carbon" hint="kg CO₂e per unit · empty: no rule">
            <Input type="number" min={0} step="0.1" value={draft.maxCarbon} onChange={(e) => set('maxCarbon', e.target.value)} />
          </Field>
          <Field label="Min recycled content" hint="% · empty: no rule">
            <Input type="number" min={0} max={100} value={draft.minRecycled} onChange={(e) => set('minRecycled', e.target.value)} />
          </Field>
          <Field label="Min repairability" hint="0–10 · empty: no rule">
            <Input type="number" min={0} max={10} value={draft.minRepairScore} onChange={(e) => set('minRepairScore', e.target.value)} />
          </Field>
        </div>
        <Field label="Required certifications" hint="Comma-separated, any one is enough · empty: no rule">
          <Input value={draft.certifications} onChange={(e) => set('certifications', e.target.value)} placeholder="GOTS, OEKO-TEX Standard 100" />
        </Field>
      </Group>
    </div>
  )
}
