import { generateKeyPair, newId, sign, type KeyPairJwk } from './crypto'
import type {
  AgentPassport,
  AgentPassportBody,
  Mandate,
  MandateBody,
  Offer,
  ProductPassport,
  ProductPassportBody,
  PurchaseRequest,
  PurchaseRequestBody,
} from './types'

const DAY = 24 * 60 * 60 * 1000

export interface IssuedAgent {
  passport: AgentPassport
  /** The agent's private key. In a real deployment it stays in the agent's runtime and never reaches the server. */
  privateKey: JsonWebKey
}

export async function issueAgentPassport(
  input: Pick<AgentPassportBody, 'name' | 'purpose' | 'runtime' | 'principalId'> & { validDays?: number },
  principalKey: JsonWebKey,
  now: number,
): Promise<IssuedAgent> {
  const keys: KeyPairJwk = await generateKeyPair()
  const body: AgentPassportBody = {
    type: 'AgentPassport',
    id: newId('agent'),
    name: input.name,
    purpose: input.purpose,
    runtime: input.runtime,
    principalId: input.principalId,
    publicKey: keys.publicKey,
    issuedAt: now,
    expiresAt: now + (input.validDays ?? 365) * DAY,
  }
  return { passport: await sign(body, input.principalId, principalKey, now), privateKey: keys.privateKey }
}

export type MandateInput = Omit<MandateBody, 'type' | 'id' | 'validFrom' | 'expiresAt'> & { validDays: number }

export async function issueMandate(input: MandateInput, principalKey: JsonWebKey, now: number): Promise<Mandate> {
  const { validDays, ...rest } = input
  const body: MandateBody = { type: 'Mandate', id: newId('mandate'), ...rest, validFrom: now, expiresAt: now + validDays * DAY }
  return sign(body, input.principalId, principalKey, now)
}

export type ProductInput = Omit<ProductPassportBody, 'type' | 'id' | 'issuedAt'>

export async function issueProductPassport(input: ProductInput, sellerKey: JsonWebKey, now: number): Promise<ProductPassport> {
  const body: ProductPassportBody = { type: 'ProductPassport', id: newId('product'), ...input, issuedAt: now }
  return sign(body, input.manufacturerId, sellerKey, now)
}

/** The agent builds a purchase request for an offer and signs it with its own key. */
export async function signPurchaseRequest(
  agent: { id: string; privateKey: JsonWebKey },
  mandateId: string,
  offer: Offer,
  quantity: number,
  now: number,
): Promise<PurchaseRequest> {
  const body: PurchaseRequestBody = {
    type: 'PurchaseRequest',
    id: newId('request'),
    agentId: agent.id,
    mandateId,
    offerId: offer.id,
    sellerId: offer.sellerId,
    productId: offer.productId,
    category: offer.category,
    quantity,
    unitPrice: offer.unitPrice,
    total: offer.unitPrice * quantity,
    requestedAt: now,
  }
  return sign(body, agent.id, agent.privateKey, now)
}
