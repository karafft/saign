# Saign

Passports for AI agents and for the products they buy. The trust layer for agentic commerce.

Saign defines **on whose behalf**, **within what limits** and **for which products** an agent may buy, as signed documents, and verifies every purchase request before money moves.

## Running it

```bash
npm install
npm run dev
```

Tests: `npm test` · Production build: `npm run build`

The app has two parts: a landing page (`/`) and a working console (`/console`). No server is needed; key generation, signing and verification run on the browser's WebCrypto API.

## Where the product comes from

| Source | What it says | What it maps to in Saign |
|---|---|---|
| YC Requests for Startups, Fall 2026: *The Best Time to Build in Crypto* | It looks inevitable that agents will use crypto networks as financial rails | The identity and authority layer for agent payments |
| YC RFS, Fall 2026: *Proving You're Human* | The need to verify who is on the other side of a transaction | The same question for an agent: on whose behalf, with what authority? |
| YC RFS, Fall 2026: *AI-Native Compliance Infrastructure* | Compliance infrastructure that checks rules continuously | Product compliance verified by machine at the moment of purchase |
| YC company: Allowance | Single-use virtual cards for agents, limits, approval from the phone | Single-use payment credential and approval flow |
| YC company: Agentic Fabriq (W26) | Identity per agent, scoped authority, audit trail | Agent passport, mandate, audit ledger |
| Hacker News: "OpenAI rogue agent activities found on Wikimedia projects" (272 points, 5 Oct 2026) | What agents without a clear identity do | Denying an agent without a valid passport |
| Hacker News: "Instant Checkout and the Agentic Commerce Protocol" (248 points) | Agentic commerce going mainstream | The market for the product |

Every link is on the **Sources** page in the app and in `src/data/sources.ts`. All were accessed and checked on 6 October 2026.

### Clone and innovation

- **Clone:** Allowance and Agentic Fabriq combined. Agent passport, mandate, spending limits, working hours, human approval, single-use payment credential, audit trail.
- **Innovation:** **product passport rules** written into the mandate. An agent is limited not only in how much it may spend but in what it may buy: carbon footprint, recycled content, origin, certification and repairability rules are verified at purchase against the digital product passport the manufacturer signed.
- **Localisation:** the EU's digital product passport calendar (first obligation: batteries, 18 February 2027) directly affects manufacturers in Türkiye that export to the EU. The demo shows an EU buyer's agents purchasing from manufacturers in Denizli, Bursa and Izmir. The digital product passport is not a YC or Hacker News source; it rests on EU regulation.

## How it works

1. The agent signs the purchase request with its own key.
2. The policy engine checks the request in four groups: agent, mandate, budget, product. One failed check means denial. Any unexpected error also means denial.
3. If the amount is above the approval threshold, the request waits for the owner.
4. If allowed, a single-use credential is minted: locked to one seller, capped at one amount, valid for 10 minutes.
5. Before charging, the seller independently re-verifies the agent passport and the request signature.
6. Every step is written to an audit ledger whose entries are chained by hash.

Everything about an agent's mandate is configurable from the console: spending limits, approval threshold, working days and hours, categories, allowed sellers, validity, and each product rule. Saving issues a new signed mandate; earlier versions are kept.

## Code layout

```
src/core/         Framework-free core. Runs in Node too; the tests use it directly.
  crypto.ts         ECDSA P-256 signing, deterministic JSON, SHA-256
  types.ts          Agent passport, mandate, schedule, product passport, request
  issue.ts          Issuing and signing documents
  policy.ts         Policy engine: request → decision and check report
  credential.ts     Single-use payment credential
  ledger.ts         Hash-chained audit ledger
  workspace.ts      Workspace operations: authorise, approve, settle, revoke, update mandate
src/data/         Demo data and the source list
src/app/          Console: state, scenario runner, mandate form, pages
src/site/         Landing page
src/ui/           Shared UI components
tests/            Core tests (24)
```

Design decisions:

- **A key carried inside a document is never trusted for verification.** The key always comes from the trust registry; otherwise anyone could self-sign a valid document.
- **Amounts are integer euro cents**, so floating-point drift cannot affect limits.
- **Core operations never mutate state**; they return a new workspace. The UI and the tests run the same operations.
- **Workspace operations are queued**, so two concurrent operations cannot fork the ledger chain.

## Limits

- **Agents are simulated.** The scenario agent is a rule-based runner that tries offers from the lowest price up; there is no language model behind it. Identity, signatures, the policy engine, the credential and the ledger are real.
- **There is no real payment.** The credential is a data structure, not connected to a card network.
- **There is no server.** Private keys are kept in the browser's local storage for demonstration. In a real deployment the owner's key lives in a key vault, the agent's key in the agent's runtime, and the policy engine runs server-side.
- **Product passport fields are a subset.** Not every data point of the EU battery passport is modelled.
- **Every company and product in the demo data is fictional.**
