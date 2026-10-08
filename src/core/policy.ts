import { verify } from './crypto'
import {
  CATEGORY_LABEL,
  formatEuro,
  isWithinSchedule,
  recycledShare,
  scheduleText,
  type AgentPassport,
  type Cents,
  type Mandate,
  type ProductPassport,
  type ProductRule,
  type PurchaseRequest,
} from './types'

export type CheckGroup = 'agent' | 'mandate' | 'budget' | 'product'

export interface Check {
  id: string
  group: CheckGroup
  label: string
  passed: boolean
  detail: string
}

export type Verdict = 'allow' | 'review' | 'deny'

export interface Decision {
  verdict: Verdict
  checks: Check[]
  /** For a denial, the first failed check; for a review, the threshold that triggered it. */
  reason: string
  evaluatedAt: number
}

/** Maps identities to public keys. Signatures are only ever verified against keys found here. */
export interface TrustRegistry {
  principals: Record<string, JsonWebKey>
  sellers: Record<string, JsonWebKey>
}

export interface PolicyInput {
  request: PurchaseRequest
  passport: AgentPassport | undefined
  mandate: Mandate | undefined
  /** The passport the seller presents for this offer. */
  product: ProductPassport | undefined
  trust: TrustRegistry
  revokedAgents: ReadonlySet<string>
  /** What this agent has already spent, excluding this request. */
  spent: { today: Cents; month: Cents }
  now: number
}

const check = (id: string, group: CheckGroup, label: string, passed: boolean, detail: string): Check => ({ id, group, label, passed, detail })
const day = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Only called for passports whose signature has been verified. */
function evaluateProductRule(rule: ProductRule, product: ProductPassport): Check {
  switch (rule.kind) {
    case 'requirePassport':
      return check('product.passport', 'product', 'Product passport required', true, 'A signed passport was presented.')
    case 'maxCarbon':
      return check('product.carbon', 'product', `Carbon footprint at most ${rule.kgCO2ePerUnit} kg CO₂e`, product.carbonKgCO2e <= rule.kgCO2ePerUnit, `Passport states ${product.carbonKgCO2e} kg CO₂e; limit is ${rule.kgCO2ePerUnit} kg.`)
    case 'minRecycled': {
      const share = Math.round(recycledShare(product) * 10) / 10
      return check('product.recycled', 'product', `Recycled content at least ${rule.percent}%`, share >= rule.percent, `Passport states ${share}% recycled content; minimum is ${rule.percent}%.`)
    }
    case 'originIn':
      return check('product.origin', 'product', 'Origin in an allowed country', rule.countries.includes(product.manufacturedIn), `Made in ${product.manufacturedIn}; allowed: ${rule.countries.join(', ')}.`)
    case 'requireCertification': {
      const found = product.certifications.filter((c) => rule.anyOf.includes(c))
      return check('product.certification', 'product', `Certification: ${rule.anyOf.join(' or ')}`, found.length > 0, found.length ? `Found: ${found.join(', ')}.` : `None of the required certifications present: ${rule.anyOf.join(', ')}.`)
    }
    case 'minRepairScore': {
      const score = product.repairScore
      return check('product.repair', 'product', `Repairability at least ${rule.score}/10`, score !== null && score >= rule.score, score === null ? 'Passport has no repairability score.' : `Passport states ${score}/10; minimum is ${rule.score}/10.`)
    }
  }
}

/**
 * Evaluates a purchase request. A single failed check produces "deny"; every check still runs
 * so the decision report is complete. Any unexpected error also produces "deny" (fail-closed).
 */
export async function evaluate(input: PolicyInput): Promise<Decision> {
  const { request, passport, mandate, product, trust, revokedAgents, spent, now } = input
  try {
    const checks: Check[] = []

    // --- Agent: is the sender really the holder of the passport? ---
    const principalKey = passport ? trust.principals[passport.principalId] : undefined
    const passportValid = !!passport && passport.id === request.agentId && passport.proof.issuer === passport.principalId && (await verify(passport, principalKey))
    checks.push(check('agent.passport', 'agent', 'Agent passport valid', passportValid, passportValid ? `Passport signed by ${passport!.principalId}.` : 'No passport, or its signature does not match the trust registry.'))

    const requestSigned = passportValid && request.proof.issuer === passport!.id && (await verify(request, passport!.publicKey))
    checks.push(check('agent.signature', 'agent', "Request signed with the agent's key", requestSigned, requestSigned ? 'Request signature matches the key in the passport.' : 'Request was not signed with the key in the passport.'))

    const notRevoked = !revokedAgents.has(request.agentId)
    checks.push(check('agent.status', 'agent', 'Agent not revoked', notRevoked, notRevoked ? 'Agent is active.' : 'This agent passport has been revoked.'))

    const passportFresh = !!passport && now < passport.expiresAt
    checks.push(check('agent.expiry', 'agent', 'Passport not expired', passportFresh, passport ? `Valid until ${day(passport.expiresAt)}.` : 'No passport.'))

    // --- Mandate: did the owner authorise this agent to do this? ---
    const mandateValid =
      !!mandate &&
      mandate.id === request.mandateId &&
      mandate.agentId === request.agentId &&
      !!passport &&
      mandate.principalId === passport.principalId &&
      mandate.proof.issuer === mandate.principalId &&
      (await verify(mandate, trust.principals[mandate.principalId]))
    checks.push(check('mandate.signature', 'mandate', 'Mandate valid', mandateValid, mandateValid ? `"${mandate!.label}" is signed by its owner.` : 'No mandate, a mandate issued to another agent, or an invalid signature.'))

    const inWindow = !!mandate && now >= mandate.validFrom && now < mandate.expiresAt
    checks.push(check('mandate.window', 'mandate', 'Mandate in force', inWindow, mandate ? `Valid until ${day(mandate.expiresAt)}.` : 'No mandate.'))

    if (mandate?.schedule) {
      checks.push(check('mandate.hours', 'mandate', 'Within working hours', isWithinSchedule(mandate.schedule, now), `Allowed window: ${scheduleText(mandate.schedule)}.`))
    }

    const sellerKnown = !!trust.sellers[request.sellerId]
    const merchantAllowed = !!mandate && sellerKnown && (mandate.merchants === null || mandate.merchants.includes(request.sellerId))
    checks.push(
      check(
        'mandate.seller',
        'mandate',
        'Seller allowed',
        merchantAllowed,
        !sellerKnown ? 'Seller is not a verified manufacturer.' : merchantAllowed ? 'Seller is in scope.' : "Seller is not on this mandate's allow list.",
      ),
    )

    const categoryAllowed = !!mandate && mandate.categories.includes(request.category)
    checks.push(check('mandate.category', 'mandate', 'Category allowed', categoryAllowed, `Requested category: ${CATEGORY_LABEL[request.category]}.`))

    // --- Budget ---
    const arithmeticOk = Number.isInteger(request.quantity) && request.quantity > 0 && request.total === request.quantity * request.unitPrice
    checks.push(check('budget.amount', 'budget', 'Amount consistent', arithmeticOk, `${request.quantity} × ${formatEuro(request.unitPrice)} = ${formatEuro(request.total)}.`))

    const limits = mandate?.limits
    const withinTx = !!limits && request.total <= limits.perTransaction
    checks.push(check('budget.transaction', 'budget', 'Transaction limit', withinTx, limits ? `${formatEuro(request.total)} of ${formatEuro(limits.perTransaction)}.` : 'No limit defined.'))

    const withinDay = !!limits && spent.today + request.total <= limits.daily
    checks.push(check('budget.daily', 'budget', 'Daily limit', withinDay, limits ? `${formatEuro(spent.today)} spent today; with this, ${formatEuro(spent.today + request.total)} of ${formatEuro(limits.daily)}.` : 'No limit defined.'))

    const withinMonth = !!limits && spent.month + request.total <= limits.monthly
    checks.push(check('budget.monthly', 'budget', 'Monthly limit', withinMonth, limits ? `${formatEuro(spent.month)} spent this month; with this, ${formatEuro(spent.month + request.total)} of ${formatEuro(limits.monthly)}.` : 'No limit defined.'))

    // --- Product: does the passport really come from the manufacturer, and does it meet the rules? ---
    const productTrusted =
      !!product &&
      product.id === request.productId &&
      product.manufacturerId === request.sellerId &&
      product.proof.issuer === product.manufacturerId &&
      (await verify(product, trust.sellers[product.manufacturerId]))
    if (product && !productTrusted) {
      checks.push(check('product.signature', 'product', 'Product passport signature valid', false, 'Passport content does not match its signature, or the manufacturer is unverified. The data may have been altered.'))
    } else if (product) {
      checks.push(check('product.signature', 'product', 'Product passport signature valid', true, `Passport signed by ${product.manufacturerId}.`))
    }

    const rules = mandate?.productRules ?? []
    if (rules.length > 0 && !productTrusted) {
      // Without a verified passport no rule can be tested; record one denial instead of repeating it per rule
      checks.push(check('product.passport', 'product', 'Product passport required', false, `Seller presented no valid passport; ${rules.length} product rules could not be verified.`))
    } else {
      for (const rule of rules) checks.push(evaluateProductRule(rule, product!))
    }

    const failed = checks.find((c) => !c.passed)
    if (failed) return { verdict: 'deny', checks, reason: `${failed.label}: ${failed.detail}`, evaluatedAt: now }

    const threshold = mandate!.approvalAbove
    if (threshold !== null && request.total > threshold) {
      return { verdict: 'review', checks, reason: `Amount is above the ${formatEuro(threshold)} approval threshold.`, evaluatedAt: now }
    }
    return { verdict: 'allow', checks, reason: 'All checks passed.', evaluatedAt: now }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return {
      verdict: 'deny',
      checks: [check('system.error', 'mandate', 'Evaluation could not complete', false, detail)],
      reason: `Evaluation could not complete; request denied: ${detail}`,
      evaluatedAt: now,
    }
  }
}
