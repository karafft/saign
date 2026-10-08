import { verify } from './crypto'
import { mintCredential, redeemCredential, type OneTimeCredential } from './credential'
import { issueAgentPassport, issueMandate, issueProductPassport, type MandateInput, type ProductInput } from './issue'
import { appendEntry, type LedgerEntry, type NewEntry } from './ledger'
import { evaluate, type Decision, type TrustRegistry } from './policy'
import {
  formatEuro,
  type AgentPassport,
  type AgentPassportBody,
  type Category,
  type Cents,
  type Mandate,
  type Offer,
  type Principal,
  type ProductPassport,
  type PurchaseRequest,
  type Seller,
} from './types'

export interface AgentRecord {
  passport: AgentPassport
  privateKey: JsonWebKey
  revokedAt: number | null
}

export type PurchaseStatus = 'denied' | 'awaiting-approval' | 'approval-rejected' | 'payment-ready' | 'settled'

export interface Purchase {
  request: PurchaseRequest
  decision: Decision
  status: PurchaseStatus
  credential: OneTimeCredential | null
  settledAt: number | null
}

/**
 * The full state of a workspace. Operations in this file never mutate it; each returns
 * a new workspace, so the UI and the tests exercise exactly the same code.
 */
export interface Workspace {
  version: 1
  principal: Principal
  principalKey: JsonWebKey
  sellers: Seller[]
  sellerKeys: Record<string, JsonWebKey>
  agents: AgentRecord[]
  mandates: Mandate[]
  products: ProductPassport[]
  /** Signed originals, kept for the tampering demonstration. */
  productOriginals: Record<string, ProductPassport>
  offers: Offer[]
  purchases: Purchase[]
  ledger: LedgerEntry[]
}

export type MandateSettings = Omit<MandateInput, 'agentId' | 'principalId'>

export function trustOf(ws: Workspace): TrustRegistry {
  const sellers: Record<string, JsonWebKey> = {}
  for (const s of ws.sellers) if (s.verified && s.publicKey) sellers[s.id] = s.publicKey
  return { principals: { [ws.principal.id]: ws.principal.publicKey }, sellers }
}

export const findAgent = (ws: Workspace, id: string) => ws.agents.find((a) => a.passport.id === id)
export const findSeller = (ws: Workspace, id: string) => ws.sellers.find((s) => s.id === id)
export const findProduct = (ws: Workspace, id: string | null) => (id ? ws.products.find((p) => p.id === id) : undefined)
export const findOffer = (ws: Workspace, id: string) => ws.offers.find((o) => o.id === id)

/** The newest mandate in force for this agent and category. */
export function activeMandate(ws: Workspace, agentId: string, category: Category, now: number): Mandate | undefined {
  return ws.mandates
    .filter((m) => m.agentId === agentId && m.categories.includes(category) && now >= m.validFrom && now < m.expiresAt)
    .sort((a, b) => b.validFrom - a.validFrom)[0]
}

/** The most recently issued mandate for this agent, even if expired; a request always cites a mandate. */
export function latestMandate(ws: Workspace, agentId: string): Mandate | undefined {
  return ws.mandates.filter((m) => m.agentId === agentId).sort((a, b) => b.validFrom - a.validFrom)[0]
}

/** Turns an issued mandate back into editable settings. */
export function settingsOf(mandate: Mandate, validDays = 180): MandateSettings {
  return {
    label: mandate.label,
    limits: mandate.limits,
    merchants: mandate.merchants,
    categories: mandate.categories,
    approvalAbove: mandate.approvalAbove,
    productRules: mandate.productRules,
    schedule: mandate.schedule ?? null,
    validDays,
  }
}

const COMMITTED: PurchaseStatus[] = ['awaiting-approval', 'payment-ready', 'settled']

/** Spend that counts toward limits: settled purchases, issued credentials and pending approvals. */
export function spentBy(ws: Workspace, agentId: string, now: number, excludeRequestId?: string): { today: Cents; month: Cents } {
  const date = new Date(now)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
  let today = 0
  let month = 0
  for (const p of ws.purchases) {
    if (p.request.agentId !== agentId || p.request.id === excludeRequestId || !COMMITTED.includes(p.status)) continue
    if (p.request.requestedAt >= monthStart) month += p.request.total
    if (p.request.requestedAt >= dayStart) today += p.request.total
  }
  return { today, month }
}

async function log(ws: Workspace, entry: NewEntry, now: number): Promise<Workspace> {
  return { ...ws, ledger: await appendEntry(ws.ledger, entry, now) }
}

const replacePurchase = (ws: Workspace, next: Purchase): Workspace => ({
  ...ws,
  purchases: ws.purchases.map((p) => (p.request.id === next.request.id ? next : p)),
})

// ---------- Issuing ----------

export async function addAgent(
  ws: Workspace,
  agent: Pick<AgentPassportBody, 'name' | 'purpose' | 'runtime'>,
  mandate: MandateSettings,
  now: number,
): Promise<{ ws: Workspace; agentId: string }> {
  const issued = await issueAgentPassport({ ...agent, principalId: ws.principal.id }, ws.principalKey, now)
  const agentId = issued.passport.id
  const signedMandate = await issueMandate({ ...mandate, agentId, principalId: ws.principal.id }, ws.principalKey, now)
  let next: Workspace = {
    ...ws,
    agents: [...ws.agents, { passport: issued.passport, privateKey: issued.privateKey, revokedAt: null }],
    mandates: [...ws.mandates, signedMandate],
  }
  next = await log(next, { kind: 'agent.issued', actor: ws.principal.id, subject: agentId, summary: `Agent passport issued for "${agent.name}".` }, now)
  next = await log(next, { kind: 'mandate.issued', actor: ws.principal.id, subject: agentId, summary: `Mandate "${mandate.label}" granted (transaction limit ${formatEuro(mandate.limits.perTransaction)}).` }, now)
  return { ws: next, agentId }
}

/** Issues a new mandate for an agent. The old one is kept; the newest is the one in force. */
export async function updateMandate(ws: Workspace, agentId: string, mandate: MandateSettings, now: number): Promise<Workspace> {
  const agent = findAgent(ws, agentId)
  if (!agent) throw new Error('No such agent.')
  const signed = await issueMandate({ ...mandate, agentId, principalId: ws.principal.id }, ws.principalKey, now)
  const next = { ...ws, mandates: [...ws.mandates, signed] }
  return log(next, { kind: 'mandate.issued', actor: ws.principal.id, subject: agentId, summary: `Mandate for "${agent.passport.name}" updated: "${mandate.label}" (transaction limit ${formatEuro(mandate.limits.perTransaction)}).` }, now)
}

export async function revokeAgent(ws: Workspace, agentId: string, now: number): Promise<Workspace> {
  const agent = findAgent(ws, agentId)
  if (!agent || agent.revokedAt !== null) return ws
  const next = { ...ws, agents: ws.agents.map((a) => (a.passport.id === agentId ? { ...a, revokedAt: now } : a)) }
  return log(next, { kind: 'agent.revoked', actor: ws.principal.id, subject: agentId, summary: `Passport for "${agent.passport.name}" revoked. All further requests are denied.` }, now)
}

export async function addProduct(ws: Workspace, input: ProductInput, offer: Pick<Offer, 'unitPrice' | 'minQuantity' | 'leadDays'>, now: number): Promise<{ ws: Workspace; productId: string }> {
  const key = ws.sellerKeys[input.manufacturerId]
  if (!key) throw new Error('This manufacturer has no signing key and cannot issue passports.')
  const passport = await issueProductPassport(input, key, now)
  const newOffer: Offer = { id: `offer_${passport.id.split(':')[2]}`, sellerId: input.manufacturerId, productId: passport.id, title: input.name, category: input.category, ...offer }
  const next = { ...ws, products: [...ws.products, passport], productOriginals: { ...ws.productOriginals, [passport.id]: passport }, offers: [...ws.offers, newOffer] }
  return { ws: await log(next, { kind: 'passport.issued', actor: input.manufacturerId, subject: passport.id, summary: `Digital product passport issued for "${input.name}".` }, now), productId: passport.id }
}

/**
 * Demonstration only: lowers the carbon figure without re-signing.
 * Nothing is logged, because a real attacker would leave no trace either; signature verification catches it.
 */
export function tamperProduct(ws: Workspace, productId: string): Workspace {
  return { ...ws, products: ws.products.map((p) => (p.id === productId ? { ...p, carbonKgCO2e: Math.round(p.carbonKgCO2e * 0.4 * 10) / 10 } : p)) }
}

export function restoreProduct(ws: Workspace, productId: string): Workspace {
  const original = ws.productOriginals[productId]
  return original ? { ...ws, products: ws.products.map((p) => (p.id === productId ? original : p)) } : ws
}

export async function isProductIntact(ws: Workspace, product: ProductPassport): Promise<boolean> {
  return verify(product, trustOf(ws).sellers[product.manufacturerId])
}

// ---------- Purchase flow ----------

/** Runs the agent's request through the policy engine, logs the decision and mints a credential if allowed. */
export async function authorize(ws: Workspace, request: PurchaseRequest, now: number): Promise<{ ws: Workspace; purchase: Purchase }> {
  const agent = findAgent(ws, request.agentId)
  const decision = await evaluate({
    request,
    passport: agent?.passport,
    mandate: ws.mandates.find((m) => m.id === request.mandateId),
    product: findProduct(ws, request.productId),
    trust: trustOf(ws),
    revokedAgents: new Set(ws.agents.filter((a) => a.revokedAt !== null).map((a) => a.passport.id)),
    spent: spentBy(ws, request.agentId, now),
    now,
  })

  const seller = findSeller(ws, request.sellerId)?.name ?? request.sellerId
  const what = `${seller} · ${request.quantity} units · ${formatEuro(request.total)}`
  let purchase: Purchase
  let next = ws

  if (decision.verdict === 'deny') {
    purchase = { request, decision, status: 'denied', credential: null, settledAt: null }
    next = await log(next, { kind: 'request.denied', actor: request.agentId, subject: request.id, summary: `${what}. Denied: ${decision.reason}` }, now)
  } else if (decision.verdict === 'review') {
    purchase = { request, decision, status: 'awaiting-approval', credential: null, settledAt: null }
    next = await log(next, { kind: 'request.review', actor: request.agentId, subject: request.id, summary: `${what}. ${decision.reason}` }, now)
  } else {
    const credential = mintCredential(request, now)
    purchase = { request, decision, status: 'payment-ready', credential, settledAt: null }
    next = await log(next, { kind: 'request.allowed', actor: request.agentId, subject: request.id, summary: `${what}. All ${decision.checks.length} checks passed.` }, now)
    next = await log(next, { kind: 'payment.credential', actor: ws.principal.id, subject: request.id, summary: `Single-use credential minted (•••• ${credential.last4}, cap ${formatEuro(credential.maxAmount)}, ${seller} only).` }, now)
  }
  return { ws: { ...next, purchases: [...next.purchases, purchase] }, purchase }
}

/** Human approval. Approving mints a credential; the request is not re-evaluated, but it is dropped if the agent was revoked meanwhile. */
export async function resolveApproval(ws: Workspace, requestId: string, approve: boolean, now: number): Promise<{ ws: Workspace; purchase: Purchase }> {
  const current = ws.purchases.find((p) => p.request.id === requestId)
  if (!current || current.status !== 'awaiting-approval') throw new Error('No such request is awaiting approval.')
  const revoked = findAgent(ws, current.request.agentId)?.revokedAt != null

  if (!approve || revoked) {
    const purchase: Purchase = { ...current, status: 'approval-rejected' }
    const summary = revoked ? 'Pending approval dropped because the agent was revoked.' : `Request for ${formatEuro(current.request.total)} rejected by the owner.`
    return { ws: await log(replacePurchase(ws, purchase), { kind: 'approval.rejected', actor: ws.principal.id, subject: requestId, summary }, now), purchase }
  }

  const credential = mintCredential(current.request, now)
  const purchase: Purchase = { ...current, status: 'payment-ready', credential }
  let next = await log(replacePurchase(ws, purchase), { kind: 'approval.granted', actor: ws.principal.id, subject: requestId, summary: `Request for ${formatEuro(current.request.total)} approved by the owner.` }, now)
  next = await log(next, { kind: 'payment.credential', actor: ws.principal.id, subject: requestId, summary: `Single-use credential minted (•••• ${credential.last4}, cap ${formatEuro(credential.maxAmount)}).` }, now)
  return { ws: next, purchase }
}

/**
 * Seller-side settlement. The seller independently verifies the agent passport and the request
 * signature, then redeems the credential. Without `charge`, the request's own amount is charged.
 */
export async function settle(ws: Workspace, requestId: string, now: number, charge?: { sellerId: string; amount: Cents }): Promise<{ ws: Workspace; purchase: Purchase; ok: boolean; reason: string }> {
  const current = ws.purchases.find((p) => p.request.id === requestId)
  if (!current?.credential || current.status !== 'payment-ready') throw new Error('No redeemable credential for this request.')
  const { request, credential } = current
  const agent = findAgent(ws, request.agentId)

  const fail = async (reason: string) => ({
    ws: await log(ws, { kind: 'payment.refused', actor: charge?.sellerId ?? request.sellerId, subject: requestId, summary: `Charge refused: ${reason}` }, now),
    purchase: current,
    ok: false,
    reason,
  })

  const passportOk = !!agent && agent.revokedAt === null && (await verify(agent.passport, trustOf(ws).principals[agent.passport.principalId]))
  if (!passportOk) return fail('Agent passport could not be verified or has been revoked.')
  if (!(await verify(request, agent.passport.publicKey))) return fail('Request signature does not match the passport.')

  const result = redeemCredential(credential, { sellerId: charge?.sellerId ?? request.sellerId, amount: charge?.amount ?? request.total, token: credential.token }, now)
  if (!result.ok) return fail(result.reason)

  const purchase: Purchase = { ...current, status: 'settled', credential: result.credential, settledAt: now }
  const seller = findSeller(ws, request.sellerId)?.name ?? request.sellerId
  const next = await log(replacePurchase(ws, purchase), { kind: 'payment.settled', actor: request.sellerId, subject: requestId, summary: `${seller} charged ${formatEuro(request.total)}. Credential used and closed.` }, now)
  return { ws: next, purchase, ok: true, reason: 'Settled.' }
}
