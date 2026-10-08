import { canonicalize, sha256Hex } from './crypto'

export type LedgerKind =
  | 'agent.issued'
  | 'agent.revoked'
  | 'mandate.issued'
  | 'passport.issued'
  | 'request.allowed'
  | 'request.review'
  | 'request.denied'
  | 'approval.granted'
  | 'approval.rejected'
  | 'payment.credential'
  | 'payment.settled'
  | 'payment.refused'

export interface LedgerEntryBody {
  index: number
  at: number
  kind: LedgerKind
  /** Who acted: an agent, the owner or a seller. */
  actor: string
  /** What it was about: a request, a product or an agent. */
  subject: string
  summary: string
  /** Hash of the previous entry. 64 zeros for the first one. */
  prevHash: string
}

export interface LedgerEntry extends LedgerEntryBody {
  hash: string
}

export const GENESIS_HASH = '0'.repeat(64)

export type NewEntry = Pick<LedgerEntryBody, 'kind' | 'actor' | 'subject' | 'summary'>

/** Appends an entry. Each entry carries the hash of the one before it, so history cannot be changed silently. */
export async function appendEntry(chain: readonly LedgerEntry[], entry: NewEntry, now: number): Promise<LedgerEntry[]> {
  const body: LedgerEntryBody = { ...entry, index: chain.length, at: now, prevHash: chain.at(-1)?.hash ?? GENESIS_HASH }
  return [...chain, { ...body, hash: await sha256Hex(canonicalize(body)) }]
}

export type ChainStatus = { valid: true } | { valid: false; brokenAt: number }

/** Recomputes the whole chain and returns the index of the first inconsistent entry. */
export async function verifyChain(chain: readonly LedgerEntry[]): Promise<ChainStatus> {
  let prevHash = GENESIS_HASH
  for (const [i, entry] of chain.entries()) {
    const { hash, ...body } = entry
    if (body.index !== i || body.prevHash !== prevHash || hash !== (await sha256Hex(canonicalize(body)))) return { valid: false, brokenAt: i }
    prevHash = hash
  }
  return { valid: true }
}
