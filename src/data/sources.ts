/**
 * The sources this product is built on. All were accessed and checked on 6 October 2026.
 */

export type SourceKind = 'YC RFS' | 'YC company' | 'Hacker News' | 'Regulation'

export interface Source {
  kind: SourceKind
  title: string
  meta: string
  url: string
  /** What this source maps to in the product. */
  takeaway: string
}

export const SOURCES: Source[] = [
  {
    kind: 'YC RFS',
    title: 'The Best Time to Build in Crypto',
    meta: 'Requests for Startups, Fall 2026 · Nemil Dalal',
    url: 'https://www.ycombinator.com/rfs',
    takeaway: 'Calls it inevitable that agents will use crypto networks as financial rails. Saign is the identity and authority layer for those payments, whatever the rail.',
  },
  {
    kind: 'YC RFS',
    title: "Proving You're Human",
    meta: 'Requests for Startups, Fall 2026 · Max Kolysh',
    url: 'https://www.ycombinator.com/rfs',
    takeaway: 'About verifying who is on the other side of a transaction. Saign asks the same of an agent: on whose behalf, and with what authority?',
  },
  {
    kind: 'YC RFS',
    title: 'AI-Native Compliance Infrastructure',
    meta: 'Requests for Startups, Fall 2026 · Daivik Goel',
    url: 'https://www.ycombinator.com/rfs',
    takeaway: 'Asks for infrastructure that checks rules continuously. Saign makes product compliance machine-verifiable at the moment of purchase.',
  },
  {
    kind: 'YC company',
    title: 'Allowance: Virtual cards for AI agents',
    meta: 'Y Combinator · Launch YC, 2026',
    url: 'https://www.ycombinator.com/launches/QS4-allowance-virtual-cards-for-ai-agents',
    takeaway: 'Cloned core: a capped, merchant-locked, single-use credential instead of the real card, with approval from the phone.',
  },
  {
    kind: 'YC company',
    title: 'Agentic Fabriq: Okta for Agents',
    meta: 'Y Combinator W26 · Launch YC',
    url: 'https://www.ycombinator.com/launches/OmE-agentic-fabriq-okta-for-agents',
    takeaway: 'Cloned core: an identity per agent, scoped authority on behalf of a user, fail-closed decisions and an audit trail.',
  },
  {
    kind: 'Hacker News',
    title: 'OpenAI "rogue" agent activities found on Wikimedia projects',
    meta: '272 points · 180 comments · 5 Oct 2026',
    url: 'https://news.ycombinator.com/item?id=49968105',
    takeaway: 'A current example of what agents without a clear identity or authority do to open systems.',
  },
  {
    kind: 'Hacker News',
    title: 'Instant Checkout and the Agentic Commerce Protocol',
    meta: '248 points · 362 comments · 29 Sep 2025',
    url: 'https://news.ycombinator.com/item?id=45416080',
    takeaway: 'The moment agents buying directly went mainstream. The discussion centres on trust and authority.',
  },
  {
    kind: 'Hacker News',
    title: 'Claude for Commerce Agents',
    meta: '62 points · 62 comments · 3 Sep 2026',
    url: 'https://news.ycombinator.com/item?id=49547888',
    takeaway: 'Shows model providers turning commerce agents into a product.',
  },
  {
    kind: 'Hacker News',
    title: 'ScopeTrail: audit receipts for multi-hop agent delegation',
    meta: 'Show HN · 22 Sep 2026',
    url: 'https://news.ycombinator.com/item?id=49800563',
    takeaway: 'The idea of audit receipts for agent delegation, tried independently in the community.',
  },
  {
    kind: 'Hacker News',
    title: 'DPP-Flash: Automated Digital Product Passports for EU Compliance',
    meta: 'Show HN · 7 Sep 2026',
    url: 'https://news.ycombinator.com/item?id=49599693',
    takeaway: 'A sign that digital product passports are becoming a startup topic. A low-scoring, early signal.',
  },
  {
    kind: 'Regulation',
    title: 'EU Batteries Regulation (2023/1542): battery passport',
    meta: 'European Commission · 18 February 2027',
    url: 'https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/batteries_en',
    takeaway: 'A digital passport becomes mandatory for EV batteries and industrial batteries above 2 kWh. The basis for the innovation layer.',
  },
]

export const TIMELINE = [
  { date: 'Sep 2025', title: 'Agents start buying from inside the chat' },
  { date: '2026', title: 'YC funds agent identity and agent payments' },
  { date: 'Fall 2026', title: 'YC RFS: agents will run on their own financial rails' },
  { date: '18 Feb 2027', title: 'EU battery passport becomes mandatory' },
]
