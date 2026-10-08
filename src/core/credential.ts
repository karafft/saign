import { randomToken } from './crypto'
import type { Cents, PurchaseRequestBody } from './types'

/**
 * Single-use payment credential. The agent never sees the real card; it only receives this,
 * valid at one seller, up to one amount, for a short time.
 */
export interface OneTimeCredential {
  id: string
  token: string
  last4: string
  requestId: string
  agentId: string
  sellerId: string
  maxAmount: Cents
  issuedAt: number
  expiresAt: number
  usedAt: number | null
}

export const CREDENTIAL_TTL_MS = 10 * 60 * 1000

export function mintCredential(request: PurchaseRequestBody, now: number): OneTimeCredential {
  const token = randomToken()
  const last4 = String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000))
  return {
    id: `card_${token.slice(0, 10)}`,
    token,
    last4,
    requestId: request.id,
    agentId: request.agentId,
    sellerId: request.sellerId,
    maxAmount: request.total,
    issuedAt: now,
    expiresAt: now + CREDENTIAL_TTL_MS,
    usedAt: null,
  }
}

export type RedeemResult = { ok: true; credential: OneTimeCredential } | { ok: false; reason: string }

/** Called by the seller when charging. Any use outside the credential's scope is refused. */
export function redeemCredential(credential: OneTimeCredential, charge: { sellerId: string; amount: Cents; token: string }, now: number): RedeemResult {
  if (charge.token !== credential.token) return { ok: false, reason: 'Payment credential not recognised.' }
  if (credential.usedAt !== null) return { ok: false, reason: 'Payment credential has already been used.' }
  if (now >= credential.expiresAt) return { ok: false, reason: 'Payment credential has expired.' }
  if (charge.sellerId !== credential.sellerId) return { ok: false, reason: 'Payment credential is locked to another seller.' }
  if (charge.amount > credential.maxAmount) return { ok: false, reason: 'Charge exceeds the approved cap.' }
  return { ok: true, credential: { ...credential, usedAt: now } }
}
