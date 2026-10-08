import { useCallback, useRef, useState } from 'react'
import { signPurchaseRequest } from '@/core/issue'
import type { OneTimeCredential } from '@/core/credential'
import { formatEuro, scheduleText, type Category, type Offer } from '@/core/types'
import { authorize, findAgent, findSeller, latestMandate, resolveApproval, restoreProduct, settingsOf, settle, tamperProduct, updateMandate, type Purchase, type Workspace } from '@/core/workspace'
import { SELLER } from '@/data/seed'
import { useStore } from './store'

/** Product types the agent can search for. */
export interface Task {
  id: string
  label: string
  category: Category
  /** Text looked for in the offer title. */
  match: string
  unit: string
}

export const TASKS: Task[] = [
  { id: 'towel', label: 'Bath towel', category: 'home-textiles', match: 'Towel', unit: 'units' },
  { id: 'duvet', label: 'Duvet set', category: 'home-textiles', match: 'Duvet', unit: 'sets' },
  { id: 'battery', label: 'LFP battery module', category: 'battery', match: 'LFP', unit: 'modules' },
  { id: 'controller', label: 'Charge controller', category: 'electronics', match: 'Controller', unit: 'units' },
]

export interface Preset {
  id: string
  title: string
  description: string
  agentName: string
  taskId: string
  quantity: number
  /** Tamper with this manufacturer's passport before the run. */
  tamperSeller?: string
  /** Give the agent working hours that exclude the current hour before the run. */
  offHours?: boolean
}

export const PRESETS: Preset[] = [
  { id: 'compliant', title: 'Finding a compliant offer', description: 'Three denials, allowed on the fourth.', agentName: 'Cartwright', taskId: 'towel', quantity: 300 },
  { id: 'approval', title: 'Approval from the phone', description: 'Above the €1,500 threshold.', agentName: 'Cartwright', taskId: 'towel', quantity: 500 },
  { id: 'limit', title: 'Over the limit', description: 'Above the €2,000 transaction limit.', agentName: 'Cartwright', taskId: 'towel', quantity: 700 },
  { id: 'tampered', title: 'Tampered passport', description: 'The value passes; the signature does not.', agentName: 'Cartwright', taskId: 'duvet', quantity: 40, tamperSeller: SELLER.loomhouse },
  { id: 'battery', title: 'Battery purchase', description: 'Carbon, recycled content, repairability.', agentName: 'Ampera', taskId: 'battery', quantity: 4 },
  { id: 'hours', title: 'Outside working hours', description: 'An order placed outside the allowed window.', agentName: 'Cartwright', taskId: 'towel', quantity: 300, offHours: true },
  { id: 'revoked', title: 'Revoked agent', description: 'An agent with a revoked passport.', agentName: 'Tally', taskId: 'towel', quantity: 100 },
]

export type StepTone = 'neutral' | 'allow' | 'review' | 'deny'

export type Step = { key: number; tone: StepTone; title: string; body?: string } & (
  | { kind: 'note' }
  | { kind: 'offers'; offers: Offer[] }
  | { kind: 'decision'; purchase: Purchase; offer: Offer }
  | { kind: 'approval'; purchase: Purchase; offer: Offer; resolved: 'pending' | 'approved' | 'rejected' }
  | { kind: 'credential'; credential: OneTimeCredential; sellerName: string }
  | { kind: 'receipt'; purchase: Purchase; sellerName: string }
)

type StepInput = Step extends infer S ? (S extends Step ? Omit<S, 'key'> : never) : never

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Is the denial about this offer, or about the agent itself? In the second case trying another offer changes nothing. */
const OFFER_SPECIFIC = (id: string) => id.startsWith('product.') || id === 'mandate.seller'

export function useScenario() {
  const { apply, reset } = useStore()
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)
  const counter = useRef(0)
  const runId = useRef(0)
  const approval = useRef<((approved: boolean) => void) | null>(null)

  const push = useCallback((step: StepInput) => {
    const key = ++counter.current
    setSteps((s) => [...s, { ...step, key } as Step])
    return key
  }, [])

  const decide = useCallback((approved: boolean) => {
    approval.current?.(approved)
    approval.current = null
  }, [])

  const stop = useCallback(() => {
    runId.current++
    approval.current = null
    setRunning(false)
  }, [])

  const run = useCallback(
    async (input: { agent: { id: string } | { name: string }; task: Task; quantity: number; tamperSeller?: string; offHours?: boolean; cleanStart?: boolean }) => {
      const id = ++runId.current
      const alive = () => id === runId.current
      setSteps([])
      setRunning(true)

      let tamperedId: string | null = null
      try {
        // Presets start from a clean workspace so earlier runs do not count toward limits
        if (input.cleanStart) await reset()
        if (!alive()) return
        let ws: Workspace = await apply((w) => w)
        const wanted = input.agent
        const agent = 'id' in wanted ? findAgent(ws, wanted.id) : ws.agents.find((a) => a.passport.name === wanted.name)

        if (agent && input.offHours) {
          const current = latestMandate(ws, agent.passport.id)
          if (current) {
            const hour = new Date().getHours()
            const schedule = { days: [0, 1, 2, 3, 4, 5, 6], fromHour: (hour + 2) % 24, toHour: (hour + 3) % 24 }
            ws = await apply((w) => updateMandate(w, agent.passport.id, { ...settingsOf(current), schedule }, Date.now()))
            push({ kind: 'note', tone: 'neutral', title: 'Setup: working hours narrowed', body: scheduleText(schedule) })
            await wait(700)
          }
        }

        const mandate = agent && latestMandate(ws, agent.passport.id)
        if (!agent || !mandate) {
          push({ kind: 'note', tone: 'deny', title: 'Scenario could not start', body: 'Agent or mandate not found.' })
          return
        }

        const offers = ws.offers.filter((o) => o.category === input.task.category && o.title.includes(input.task.match)).sort((a, b) => a.unitPrice - b.unitPrice)

        if (input.tamperSeller) {
          tamperedId = offers.find((o) => o.sellerId === input.tamperSeller)?.productId ?? null
          if (tamperedId) {
            const target = tamperedId
            ws = await apply((w) => tamperProduct(w, target))
            push({ kind: 'note', tone: 'deny', title: 'Setup: passport tampered', body: `${findSeller(ws, input.tamperSeller)?.name} lowered its carbon figure after signing.` })
            await wait(700)
          }
        }
        if (!alive()) return

        push({ kind: 'note', tone: 'neutral', title: `Task: ${input.quantity} ${input.task.unit} · ${input.task.label}`, body: `${agent.passport.name} · ${mandate.label} · starts from the lowest price` })
        await wait(700)
        if (!alive()) return
        push({ kind: 'offers', tone: 'neutral', title: `${offers.length} offers found`, offers })
        await wait(900)

        for (const offer of offers) {
          if (!alive()) return
          const sellerName = findSeller(ws, offer.sellerId)?.name ?? offer.sellerId
          if (input.quantity < offer.minQuantity) {
            push({ kind: 'note', tone: 'neutral', title: `${sellerName} skipped`, body: `Minimum order ${offer.minQuantity} ${input.task.unit}.` })
            await wait(500)
            continue
          }

          const now = Date.now()
          const request = await signPurchaseRequest({ id: agent.passport.id, privateKey: agent.privateKey }, mandate.id, offer, input.quantity, now)
          let purchase!: Purchase
          ws = await apply(async (w) => {
            const result = await authorize(w, request, now)
            purchase = result.purchase
            return result.ws
          })
          if (!alive()) return
          push({ kind: 'decision', tone: purchase.decision.verdict, title: `${sellerName} · ${formatEuro(request.total)}`, purchase, offer })
          await wait(1000)

          if (purchase.decision.verdict === 'deny') {
            const failed = purchase.decision.checks.filter((c) => !c.passed)
            if (failed.some((c) => !OFFER_SPECIFIC(c.id))) {
              push({ kind: 'note', tone: 'deny', title: 'Agent stops', body: "The denial concerns the agent's authority, not the offer." })
              return
            }
            continue
          }

          if (purchase.decision.verdict === 'review') {
            const stepKey = push({ kind: 'approval', tone: 'review', title: 'Waiting for the owner', purchase, offer, resolved: 'pending' })
            const approved = await new Promise<boolean>((resolve) => (approval.current = resolve))
            if (!alive()) return
            ws = await apply(async (w) => {
              const result = await resolveApproval(w, request.id, approved, Date.now())
              purchase = result.purchase
              return result.ws
            })
            setSteps((s) => s.map((st) => (st.key === stepKey && st.kind === 'approval' ? { ...st, resolved: approved ? 'approved' : 'rejected', tone: approved ? 'allow' : 'deny', title: approved ? 'Owner approved' : 'Owner rejected' } : st)))
            await wait(600)
            if (!approved) {
              push({ kind: 'note', tone: 'deny', title: 'Agent stops', body: 'No credential was minted.' })
              return
            }
          }

          if (!alive() || !purchase.credential) return
          push({ kind: 'credential', tone: 'allow', title: 'Single-use credential minted', credential: purchase.credential, sellerName })
          await wait(1100)
          if (!alive()) return

          let settled!: { purchase: Purchase; ok: boolean; reason: string }
          ws = await apply(async (w) => {
            const result = await settle(w, request.id, Date.now())
            settled = result
            return result.ws
          })
          if (!alive()) return
          if (settled.ok) push({ kind: 'receipt', tone: 'allow', title: 'Seller verified and charged', purchase: settled.purchase, sellerName })
          else push({ kind: 'note', tone: 'deny', title: 'Charge refused', body: settled.reason })
          return
        }

        if (alive()) push({ kind: 'note', tone: 'deny', title: 'No compliant offer found', body: 'Nothing was spent.' })
      } finally {
        if (tamperedId) {
          const target = tamperedId
          await apply((w) => restoreProduct(w, target))
          if (id === runId.current) push({ kind: 'note', tone: 'neutral', title: 'Cleanup', body: 'Passport restored to its signed original.' })
        }
        if (id === runId.current) setRunning(false)
      }
    },
    [apply, push, reset],
  )

  return { steps, running, run, decide, stop }
}
