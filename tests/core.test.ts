import { beforeAll, describe, expect, it } from 'vitest'
import { canonicalize, generateKeyPair, sign, verify } from '@/core/crypto'
import { CREDENTIAL_TTL_MS, mintCredential, redeemCredential } from '@/core/credential'
import { signPurchaseRequest } from '@/core/issue'
import { appendEntry, verifyChain, type LedgerEntry } from '@/core/ledger'
import { isWithinSchedule, type Offer } from '@/core/types'
import { authorize, findAgent, latestMandate, resolveApproval, restoreProduct, revokeAgent, settingsOf, settle, tamperProduct, updateMandate, type Workspace } from '@/core/workspace'
import { createDemoWorkspace, SELLER } from '@/data/seed'

// Tuesday 6 October 2026, 10:00 local time
const NOW = new Date('2026-10-06T10:00:00').getTime()

let base: Workspace
const agentByName = (ws: Workspace, name: string) => ws.agents.find((a) => a.passport.name === name)!
const offerOf = (ws: Workspace, sellerId: string, titlePrefix: string): Offer => ws.offers.find((o) => o.sellerId === sellerId && o.title.startsWith(titlePrefix))!

async function request(ws: Workspace, agentName: string, offer: Offer, quantity: number, now = NOW) {
  const agent = agentByName(ws, agentName)
  return signPurchaseRequest({ id: agent.passport.id, privateKey: agent.privateKey }, latestMandate(ws, agent.passport.id)!.id, offer, quantity, now)
}

const failedIds = (ws: Workspace, requestId: string) =>
  ws.purchases
    .find((p) => p.request.id === requestId)!
    .decision.checks.filter((c) => !c.passed)
    .map((c) => c.id)

beforeAll(async () => {
  base = await createDemoWorkspace(NOW)
})

describe('signing', () => {
  it('produces the same canonical text regardless of key order', () => {
    expect(canonicalize({ b: 1, a: { d: [1, 2], c: undefined } })).toBe(canonicalize({ a: { d: [1, 2] }, b: 1 }))
  })

  it('verifies a signed document and rejects it once a field changes', async () => {
    const keys = await generateKeyPair()
    const doc = await sign({ amount: 100, to: 'x' }, 'issuer', keys.privateKey, NOW)
    expect(await verify(doc, keys.publicKey)).toBe(true)
    expect(await verify({ ...doc, amount: 101 }, keys.publicKey)).toBe(false)
  })

  it('fails with another key or with no key', async () => {
    const [a, b] = await Promise.all([generateKeyPair(), generateKeyPair()])
    const doc = await sign({ ok: true }, 'issuer', a.privateKey, NOW)
    expect(await verify(doc, b.publicKey)).toBe(false)
    expect(await verify(doc, undefined)).toBe(false)
  })
})

describe('policy engine', () => {
  it('allows a compliant offer below the threshold and mints a credential', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 300)
    const { purchase } = await authorize(base, req, NOW)
    expect(purchase.decision.verdict).toBe('allow')
    expect(purchase.status).toBe('payment-ready')
    expect(purchase.credential?.maxAmount).toBe(300 * 340)
    expect(purchase.credential?.sellerId).toBe(SELLER.cottonKin)
  })

  it('sends an amount above the approval threshold to human review', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 500)
    const { purchase } = await authorize(base, req, NOW)
    expect(purchase.decision.verdict).toBe('review')
    expect(purchase.credential).toBeNull()
  })

  it('denies a request above the transaction limit', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 700)
    const { ws } = await authorize(base, req, NOW)
    expect(failedIds(ws, req.id)).toEqual(['budget.transaction'])
  })

  it('denies a product with no passport from an unverified seller', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.bargainHarbor, 'Towel'), 300)
    const { ws } = await authorize(base, req, NOW)
    expect(failedIds(ws, req.id)).toEqual(expect.arrayContaining(['mandate.seller', 'product.passport']))
  })

  it('applies product rules to the passport data', async () => {
    const lidya = await request(base, 'Cartwright', offerOf(base, SELLER.loomhouse, 'Bath Towel'), 300)
    expect(failedIds((await authorize(base, lidya, NOW)).ws, lidya.id)).toEqual(['product.recycled'])

    const meridian = await request(base, 'Cartwright', offerOf(base, SELLER.meridian, 'Towel'), 300)
    expect(failedIds((await authorize(base, meridian, NOW)).ws, meridian.id)).toEqual(['product.origin', 'product.certification'])
  })

  it('denies a passport altered after signing even when its values now satisfy the rule', async () => {
    const offer = offerOf(base, SELLER.loomhouse, 'Duvet')
    const honest = await request(base, 'Cartwright', offer, 40)
    expect(failedIds((await authorize(base, honest, NOW)).ws, honest.id)).toEqual(['product.carbon'])

    const tampered = tamperProduct(base, offer.productId!)
    const req = await request(tampered, 'Cartwright', offer, 40)
    const failed = failedIds((await authorize(tampered, req, NOW)).ws, req.id)
    expect(failed).toContain('product.signature')
    expect(failed).toContain('product.passport')

    const restored = restoreProduct(tampered, offer.productId!)
    const again = await request(restored, 'Cartwright', offer, 40)
    expect(failedIds((await authorize(restored, again, NOW)).ws, again.id)).toEqual(['product.carbon'])
  })

  it('denies a revoked agent', async () => {
    const req = await request(base, 'Tally', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 100)
    const { ws } = await authorize(base, req, NOW)
    expect(failedIds(ws, req.id)).toEqual(['agent.status'])
  })

  it("denies a request signed with another agent's key", async () => {
    const atlas = agentByName(base, 'Cartwright')
    const volt = agentByName(base, 'Ampera')
    const forged = await signPurchaseRequest({ id: atlas.passport.id, privateKey: volt.privateKey }, latestMandate(base, atlas.passport.id)!.id, offerOf(base, SELLER.cottonKin, 'Bath Towel'), 100, NOW)
    const { ws } = await authorize(base, forged, NOW)
    expect(failedIds(ws, forged.id)).toEqual(['agent.signature'])
  })

  it("does not let an agent use another agent's mandate", async () => {
    const atlas = agentByName(base, 'Cartwright')
    const volt = agentByName(base, 'Ampera')
    const req = await signPurchaseRequest({ id: atlas.passport.id, privateKey: atlas.privateKey }, latestMandate(base, volt.passport.id)!.id, offerOf(base, SELLER.halcyon, 'LFP'), 1, NOW)
    const { ws } = await authorize(base, req, NOW)
    expect(failedIds(ws, req.id)).toEqual(['mandate.signature'])
  })

  it('denies a request whose amount was changed after signing', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 300)
    const { ws } = await authorize(base, { ...req, quantity: 100, total: 100 * 340 }, NOW)
    expect(failedIds(ws, req.id)).toContain('agent.signature')
  })

  it('denies a request made under an expired mandate', async () => {
    const later = NOW + 400 * 24 * 60 * 60 * 1000
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 300, later)
    const { ws } = await authorize(base, req, later)
    expect(failedIds(ws, req.id)).toEqual(expect.arrayContaining(['agent.expiry', 'mandate.window']))
  })

  it('counts earlier allowances from the same day toward the daily limit', async () => {
    const offer = offerOf(base, SELLER.cottonKin, 'Bath Towel')
    let ws = base
    for (const _ of [1, 2, 3]) {
      const req = await request(ws, 'Cartwright', offer, 400) // 3 × €1,360 = €4,080 > €4,000
      ws = (await authorize(ws, req, NOW)).ws
    }
    const verdicts = ws.purchases.slice(-3).map((p) => p.decision.verdict)
    expect(verdicts).toEqual(['allow', 'allow', 'deny'])
    expect(failedIds(ws, ws.purchases.at(-1)!.request.id)).toEqual(['budget.daily'])
  })
})

describe('working hours', () => {
  it('handles days and hour windows, including windows that cross midnight', () => {
    expect(isWithinSchedule({ days: [1, 2, 3, 4, 5], fromHour: 9, toHour: 18 }, NOW)).toBe(true)
    expect(isWithinSchedule({ days: [1, 2, 3, 4, 5], fromHour: 10, toHour: 11 }, NOW)).toBe(true)
    expect(isWithinSchedule({ days: [1, 2, 3, 4, 5], fromHour: 11, toHour: 18 }, NOW)).toBe(false)
    expect(isWithinSchedule({ days: [0, 6], fromHour: 0, toHour: 24 }, NOW)).toBe(false)
    expect(isWithinSchedule({ days: [2], fromHour: 22, toHour: 6 }, NOW)).toBe(false)
    expect(isWithinSchedule({ days: [2], fromHour: 22, toHour: 11 }, NOW)).toBe(true)
  })

  it('applies the new schedule after a mandate update and denies requests outside it', async () => {
    const atlas = agentByName(base, 'Cartwright')
    const settings = settingsOf(latestMandate(base, atlas.passport.id)!, 30)
    const offer = offerOf(base, SELLER.cottonKin, 'Bath Towel')

    const closed = await updateMandate(base, atlas.passport.id, { ...settings, schedule: { days: [1, 2, 3, 4, 5], fromHour: 13, toHour: 18 } }, NOW)
    const blocked = await request(closed, 'Cartwright', offer, 300)
    expect(failedIds((await authorize(closed, blocked, NOW)).ws, blocked.id)).toEqual(['mandate.hours'])

    const open = await updateMandate(closed, atlas.passport.id, { ...settings, schedule: { days: [2], fromHour: 9, toHour: 12 } }, NOW + 1)
    const allowed = await request(open, 'Cartwright', offer, 300)
    expect((await authorize(open, allowed, NOW + 2)).purchase.decision.verdict).toBe('allow')
  })
})

describe('approval and settlement', () => {
  it('mints a credential for an approved request and lets the seller charge it', async () => {
    const req = await request(base, 'Ampera', offerOf(base, SELLER.halcyon, 'LFP'), 4)
    let { ws, purchase } = await authorize(base, req, NOW)
    expect(purchase.status).toBe('awaiting-approval')
    ;({ ws, purchase } = await resolveApproval(ws, req.id, true, NOW + 1000))
    expect(purchase.credential).not.toBeNull()
    const result = await settle(ws, req.id, NOW + 2000)
    expect(result.ok).toBe(true)
    expect(result.purchase.status).toBe('settled')
  })

  it('mints nothing for a rejected approval', async () => {
    const req = await request(base, 'Ampera', offerOf(base, SELLER.halcyon, 'LFP'), 4)
    const { ws } = await authorize(base, req, NOW)
    const { purchase } = await resolveApproval(ws, req.id, false, NOW + 1000)
    expect(purchase.status).toBe('approval-rejected')
    expect(purchase.credential).toBeNull()
  })

  it('refuses a credential at another seller, for a higher amount, after expiry or on second use', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 300)
    const credential = mintCredential(req, NOW)
    const charge = { sellerId: SELLER.cottonKin, amount: req.total, token: credential.token }
    expect(redeemCredential(credential, { ...charge, sellerId: SELLER.loomhouse }, NOW).ok).toBe(false)
    expect(redeemCredential(credential, { ...charge, amount: req.total + 1 }, NOW).ok).toBe(false)
    expect(redeemCredential(credential, charge, NOW + CREDENTIAL_TTL_MS).ok).toBe(false)
    expect(redeemCredential(credential, { ...charge, token: 'wrong' }, NOW).ok).toBe(false)
    const first = redeemCredential(credential, charge, NOW)
    expect(first.ok).toBe(true)
    expect(first.ok && redeemCredential(first.credential, charge, NOW).ok).toBe(false)
  })

  it('stops the seller charging an agent revoked after it was allowed', async () => {
    const req = await request(base, 'Cartwright', offerOf(base, SELLER.cottonKin, 'Bath Towel'), 300)
    let { ws } = await authorize(base, req, NOW)
    ws = await revokeAgent(ws, findAgent(ws, req.agentId)!.passport.id, NOW + 500)
    const result = await settle(ws, req.id, NOW + 1000)
    expect(result.ok).toBe(false)
    expect(result.ws.ledger.at(-1)!.kind).toBe('payment.refused')
  })
})

describe('audit ledger', () => {
  it('has a valid chain in the demo workspace', async () => {
    expect(base.ledger.length).toBeGreaterThan(10)
    expect(await verifyChain(base.ledger)).toEqual({ valid: true })
  })

  it('breaks at the entry that was changed', async () => {
    const forged = base.ledger.map((e, i) => (i === 3 ? { ...e, summary: 'changed' } : e))
    expect(await verifyChain(forged)).toEqual({ valid: false, brokenAt: 3 })
  })

  it('notices an entry removed from the middle', async () => {
    let chain: LedgerEntry[] = []
    for (const n of [1, 2, 3]) chain = await appendEntry(chain, { kind: 'request.allowed', actor: 'a', subject: `s${n}`, summary: `entry ${n}` }, NOW + n)
    expect(await verifyChain([chain[0], chain[2]])).toEqual({ valid: false, brokenAt: 1 })
  })
})
