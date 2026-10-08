import type { Signed } from './crypto'

/** Amounts are integer euro cents so limits never suffer floating-point drift. */
export type Cents = number

export type Category = 'home-textiles' | 'battery' | 'electronics'

export const CATEGORY_LABEL: Record<Category, string> = {
  'home-textiles': 'Home textiles',
  battery: 'Battery',
  electronics: 'Electronics',
}

/** The person or company an agent acts on behalf of. */
export interface Principal {
  id: string
  name: string
  city: string
  country: string
  publicKey: JsonWebKey
}

/** A manufacturer that issues product passports and sells. */
export interface Seller {
  id: string
  name: string
  city: string
  country: string
  sector: string
  /** Only verified manufacturers have a key in the trust registry. */
  verified: boolean
  publicKey?: JsonWebKey
}

// ---------- Agent passport ----------

export interface AgentPassportBody {
  type: 'AgentPassport'
  id: string
  name: string
  purpose: string
  /** The model or framework running the agent; informational only. */
  runtime: string
  principalId: string
  /** The agent's own key. The agent signs every request with it. */
  publicKey: JsonWebKey
  issuedAt: number
  expiresAt: number
}

export type AgentPassport = Signed<AgentPassportBody>

// ---------- Mandate ----------

export type ProductRule =
  | { kind: 'requirePassport' }
  | { kind: 'maxCarbon'; kgCO2ePerUnit: number }
  | { kind: 'minRecycled'; percent: number }
  | { kind: 'originIn'; countries: string[] }
  | { kind: 'requireCertification'; anyOf: string[] }
  | { kind: 'minRepairScore'; score: number }

/** Days and hours an agent may transact. Hours are local time; the end hour is exclusive. */
export interface Schedule {
  /** 0: Sunday … 6: Saturday */
  days: number[]
  fromHour: number
  toHour: number
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function isWithinSchedule(schedule: Schedule, at: number): boolean {
  const date = new Date(at)
  const hour = date.getHours()
  if (!schedule.days.includes(date.getDay())) return false
  // Windows that cross midnight (e.g. 22–06) are supported
  return schedule.fromHour <= schedule.toHour ? hour >= schedule.fromHour && hour < schedule.toHour : hour >= schedule.fromHour || hour < schedule.toHour
}

export function scheduleText(schedule: Schedule | null | undefined): string {
  if (!schedule) return '24 / 7'
  const days = schedule.days.length === 7 ? 'Every day' : [1, 2, 3, 4, 5, 6, 0].filter((d) => schedule.days.includes(d)).map((d) => DAY_LABELS[d]).join(', ')
  const pad = (h: number) => String(h).padStart(2, '0')
  return `${days} · ${pad(schedule.fromHour)}:00–${pad(schedule.toHour)}:00`
}

export interface MandateBody {
  type: 'Mandate'
  id: string
  agentId: string
  principalId: string
  label: string
  limits: { perTransaction: Cents; daily: Cents; monthly: Cents }
  /** null: any verified seller. Array: only those listed. */
  merchants: string[] | null
  categories: Category[]
  /** Amounts above this need human approval. null: no approval step. */
  approvalAbove: Cents | null
  productRules: ProductRule[]
  /** null: no restriction. */
  schedule: Schedule | null
  validFrom: number
  expiresAt: number
}

export type Mandate = Signed<MandateBody>

// ---------- Digital product passport ----------

export interface MaterialShare {
  material: string
  percent: number
  /** Share of this material that comes from recycled sources. */
  recycledPercent: number
}

export interface ProductPassportBody {
  type: 'ProductPassport'
  id: string
  gtin: string
  name: string
  model: string
  category: Category
  manufacturerId: string
  manufacturedIn: string
  manufacturedAt: string
  composition: MaterialShare[]
  /** Cradle-to-gate carbon footprint per unit. */
  carbonKgCO2e: number
  certifications: string[]
  /** Repairability score from 0 to 10; null when not applicable. */
  repairScore: number | null
  endOfLife: string
  battery?: { chemistry: string; capacityKWh: number; ratedCycles: number }
  issuedAt: number
}

export type ProductPassport = Signed<ProductPassportBody>

export interface Offer {
  id: string
  sellerId: string
  /** Id of the passport the seller presents for this product; null when there is none. */
  productId: string | null
  title: string
  category: Category
  unitPrice: Cents
  minQuantity: number
  leadDays: number
}

// ---------- Purchase ----------

export interface PurchaseRequestBody {
  type: 'PurchaseRequest'
  id: string
  agentId: string
  mandateId: string
  offerId: string
  sellerId: string
  productId: string | null
  category: Category
  quantity: number
  unitPrice: Cents
  total: Cents
  requestedAt: number
}

/** Signed with the agent's own key and verified against the key in its passport. */
export type PurchaseRequest = Signed<PurchaseRequestBody>

export function recycledShare(passport: ProductPassportBody): number {
  return passport.composition.reduce((sum, m) => sum + (m.percent * m.recycledPercent) / 100, 0)
}

/** "€1,020", or "€3.40" when there are cents. */
export function formatEuro(cents: Cents): string {
  const digits = cents % 100 === 0 ? 0 : 2
  return `€${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
