import { generateKeyPair } from '@/core/crypto'
import { signPurchaseRequest, type ProductInput } from '@/core/issue'
import type { Offer, ProductRule, Seller } from '@/core/types'
import { addAgent, addProduct, authorize, findAgent, latestMandate, revokeAgent, settle, type Workspace } from '@/core/workspace'

const DAY = 24 * 60 * 60 * 1000
const euro = (amount: number) => Math.round(amount * 100)

export const EU_AND_TR = ['TR', 'DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'PT', 'GR', 'BG', 'RO', 'AT', 'BE']

/** Ids are fixed so scenarios and links stay the same across resets. */
export const SELLER = {
  cottonKin: 'saign:maker:cotton-kin',
  loomhouse: 'saign:maker:loomhouse',
  halcyon: 'saign:maker:halcyon',
  meridian: 'saign:maker:meridian',
  bargainHarbor: 'saign:maker:bargain-harbor',
} as const

type SeedProduct = { input: ProductInput; price: number; minQuantity: number; leadDays: number }

const PRODUCTS: SeedProduct[] = [
  {
    input: {
      gtin: '8690000100017',
      name: 'Bath Towel 50×90',
      model: 'PH-500 · 500 g/m²',
      category: 'home-textiles',
      manufacturerId: SELLER.cottonKin,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-08',
      composition: [
        { material: 'Organic cotton', percent: 70, recycledPercent: 0 },
        { material: 'Recycled cotton', percent: 30, recycledPercent: 100 },
      ],
      carbonKgCO2e: 3.1,
      certifications: ['OEKO-TEX Standard 100', 'GOTS'],
      repairScore: null,
      endOfLife: 'Single fibre type. Suitable for mechanical recycling; manufacturer take-back programme.',
    },
    price: 3.4,
    minQuantity: 100,
    leadDays: 9,
  },
  {
    input: {
      gtin: '8690000200014',
      name: 'Bath Towel 50×90',
      model: 'LD-450 · 450 g/m²',
      category: 'home-textiles',
      manufacturerId: SELLER.loomhouse,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-07',
      composition: [{ material: 'Cotton', percent: 100, recycledPercent: 5 }],
      carbonKgCO2e: 5.8,
      certifications: ['OEKO-TEX Standard 100'],
      repairScore: null,
      endOfLife: 'Suitable for mechanical recycling.',
    },
    price: 2.9,
    minQuantity: 200,
    leadDays: 7,
  },
  {
    input: {
      gtin: '6290000300011',
      name: 'Towel 50×90 Economy',
      model: 'MT-E40',
      category: 'home-textiles',
      manufacturerId: SELLER.meridian,
      manufacturedIn: 'AE',
      manufacturedAt: '2026-06',
      composition: [
        { material: 'Cotton', percent: 60, recycledPercent: 0 },
        { material: 'Polyester', percent: 40, recycledPercent: 50 },
      ],
      carbonKgCO2e: 4.2,
      certifications: [],
      repairScore: null,
      endOfLife: 'Blended fibre. Limited recyclability.',
    },
    price: 2.6,
    minQuantity: 200,
    leadDays: 21,
  },
  {
    input: {
      gtin: '8690000100024',
      name: 'Duvet Set Double',
      model: 'PN-300 · 300 TC',
      category: 'home-textiles',
      manufacturerId: SELLER.cottonKin,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-08',
      composition: [
        { material: 'Organic cotton', percent: 75, recycledPercent: 0 },
        { material: 'Recycled cotton', percent: 25, recycledPercent: 100 },
      ],
      carbonKgCO2e: 9.4,
      certifications: ['GOTS'],
      repairScore: null,
      endOfLife: 'Buttons and zips are removable. Suitable for mechanical recycling.',
    },
    price: 28,
    minQuantity: 20,
    leadDays: 12,
  },
  {
    input: {
      gtin: '8690000200021',
      name: 'Duvet Set Double',
      model: 'LN-240 · 240 TC',
      category: 'home-textiles',
      manufacturerId: SELLER.loomhouse,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-07',
      composition: [
        { material: 'Cotton', percent: 78, recycledPercent: 0 },
        { material: 'Recycled polyester', percent: 22, recycledPercent: 100 },
      ],
      carbonKgCO2e: 12.5,
      certifications: ['OEKO-TEX Standard 100'],
      repairScore: null,
      endOfLife: 'Blended fibre. Requires chemical recycling.',
    },
    price: 24.5,
    minQuantity: 20,
    leadDays: 8,
  },
  {
    input: {
      gtin: '8690000400018',
      name: 'LFP Battery Module 5 kWh',
      model: 'EH-M5 · 51.2 V',
      category: 'battery',
      manufacturerId: SELLER.halcyon,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-09',
      composition: [
        { material: 'LFP cathode', percent: 38, recycledPercent: 12 },
        { material: 'Graphite anode', percent: 18, recycledPercent: 0 },
        { material: 'Aluminium', percent: 16, recycledPercent: 60 },
        { material: 'Copper', percent: 11, recycledPercent: 40 },
        { material: 'Electrolyte and other', percent: 17, recycledPercent: 0 },
      ],
      carbonKgCO2e: 410,
      certifications: ['UN 38.3', 'IEC 62619'],
      repairScore: 7,
      endOfLife: 'Bolted module; cells are individually replaceable. Manufacturer take-back obligation.',
      battery: { chemistry: 'LiFePO₄', capacityKWh: 5, ratedCycles: 6000 },
    },
    price: 1850,
    minQuantity: 1,
    leadDays: 18,
  },
  {
    input: {
      gtin: '6290000300028',
      name: 'LFP Module 5 kWh',
      model: 'MT-B5',
      category: 'battery',
      manufacturerId: SELLER.meridian,
      manufacturedIn: 'AE',
      manufacturedAt: '2026-05',
      composition: [
        { material: 'LFP cathode', percent: 40, recycledPercent: 0 },
        { material: 'Graphite anode', percent: 20, recycledPercent: 0 },
        { material: 'Aluminium', percent: 15, recycledPercent: 25 },
        { material: 'Copper', percent: 10, recycledPercent: 20 },
        { material: 'Electrolyte and other', percent: 15, recycledPercent: 0 },
      ],
      carbonKgCO2e: 620,
      certifications: ['UN 38.3'],
      repairScore: 3,
      endOfLife: 'Glued casing. Cells cannot be replaced.',
      battery: { chemistry: 'LiFePO₄', capacityKWh: 5, ratedCycles: 3500 },
    },
    price: 1540,
    minQuantity: 2,
    leadDays: 35,
  },
  {
    input: {
      gtin: '8690000400025',
      name: 'Smart Charge Controller',
      model: 'EH-C2',
      category: 'electronics',
      manufacturerId: SELLER.halcyon,
      manufacturedIn: 'TR',
      manufacturedAt: '2026-09',
      composition: [
        { material: 'PCB and components', percent: 46, recycledPercent: 8 },
        { material: 'Aluminium housing', percent: 42, recycledPercent: 70 },
        { material: 'Plastic', percent: 12, recycledPercent: 30 },
      ],
      carbonKgCO2e: 14,
      certifications: ['CE', 'IEC 62619'],
      repairScore: 8,
      endOfLife: 'Screwed housing. Spare parts available for 10 years. Open-source firmware.',
    },
    price: 96,
    minQuantity: 1,
    leadDays: 6,
  },
]

const TEXTILE_RULES: ProductRule[] = [
  { kind: 'requirePassport' },
  { kind: 'maxCarbon', kgCO2ePerUnit: 10 },
  { kind: 'minRecycled', percent: 20 },
  { kind: 'originIn', countries: EU_AND_TR },
  { kind: 'requireCertification', anyOf: ['OEKO-TEX Standard 100', 'GOTS'] },
]

const BATTERY_RULES: ProductRule[] = [
  { kind: 'requirePassport' },
  { kind: 'maxCarbon', kgCO2ePerUnit: 500 },
  { kind: 'minRecycled', percent: 15 },
  { kind: 'minRepairScore', score: 5 },
  { kind: 'requireCertification', anyOf: ['IEC 62619'] },
]

/** Demo workspace. Every company and product is fictional; keys and signatures are real and generated in the browser. */
export async function createDemoWorkspace(now: number): Promise<Workspace> {
  const setup = now - 21 * DAY
  const principalKeys = await generateKeyPair()

  const sellerSpecs: Omit<Seller, 'publicKey'>[] = [
    { id: SELLER.cottonKin, name: 'Cotton & Kin Mills', city: 'Denizli', country: 'TR', sector: 'Towels and home textiles', verified: true },
    { id: SELLER.loomhouse, name: 'Loomhouse Textiles', city: 'Bursa', country: 'TR', sector: 'Weaving and bedding', verified: true },
    { id: SELLER.halcyon, name: 'Halcyon Cell Co.', city: 'Izmir', country: 'TR', sector: 'Energy storage', verified: true },
    { id: SELLER.meridian, name: 'Meridian Supply Co.', city: 'Dubai', country: 'AE', sector: 'Wholesale trade', verified: true },
    { id: SELLER.bargainHarbor, name: 'Bargain Harbor', city: 'Istanbul', country: 'TR', sector: 'Wholesale trade', verified: false },
  ]
  const sellers: Seller[] = []
  const sellerKeys: Record<string, JsonWebKey> = {}
  for (const spec of sellerSpecs) {
    if (!spec.verified) {
      sellers.push(spec)
      continue
    }
    const keys = await generateKeyPair()
    sellers.push({ ...spec, publicKey: keys.publicKey })
    sellerKeys[spec.id] = keys.privateKey
  }

  let ws: Workspace = {
    version: 1,
    principal: { id: 'saign:owner:lumen-loom', name: 'Lumen & Loom', city: 'Hamburg', country: 'DE', publicKey: principalKeys.publicKey },
    principalKey: principalKeys.privateKey,
    sellers,
    sellerKeys,
    agents: [],
    mandates: [],
    products: [],
    productOriginals: {},
    offers: [],
    purchases: [],
    ledger: [],
  }

  for (const p of PRODUCTS) {
    ws = (await addProduct(ws, p.input, { unitPrice: euro(p.price), minQuantity: p.minQuantity, leadDays: p.leadDays }, setup)).ws
  }
  // An offer with no passport: unverified seller, lowest price
  const unlisted: Offer = { id: 'offer_bargain-harbor-towel', sellerId: SELLER.bargainHarbor, productId: null, title: 'Towel 50×90', category: 'home-textiles', unitPrice: euro(2.2), minQuantity: 100, leadDays: 4 }
  ws = { ...ws, offers: [...ws.offers, unlisted] }

  const atlas = await addAgent(
    ws,
    { name: 'Cartwright', purpose: 'Home textile sourcing', runtime: 'Sonnet-class model · MCP' },
    {
      label: 'Home textile purchasing',
      limits: { perTransaction: euro(2000), daily: euro(4000), monthly: euro(20000) },
      merchants: null,
      categories: ['home-textiles'],
      approvalAbove: euro(1500),
      productRules: TEXTILE_RULES,
      schedule: null,
      validDays: 180,
    },
    setup + DAY,
  )
  ws = atlas.ws

  const volt = await addAgent(
    ws,
    { name: 'Ampera', purpose: 'Energy storage sourcing', runtime: 'Opus-class model · MCP' },
    {
      label: 'Battery and power electronics purchasing',
      limits: { perTransaction: euro(12000), daily: euro(12000), monthly: euro(40000) },
      merchants: [SELLER.halcyon, SELLER.meridian],
      categories: ['battery', 'electronics'],
      approvalAbove: euro(3000),
      productRules: BATTERY_RULES,
      schedule: null,
      validDays: 180,
    },
    setup + 2 * DAY,
  )
  ws = volt.ws

  const retired = await addAgent(
    ws,
    { name: 'Tally', purpose: 'Consumables restocking (legacy)', runtime: 'Haiku-class model' },
    {
      label: 'Consumables restocking',
      limits: { perTransaction: euro(500), daily: euro(1000), monthly: euro(4000) },
      merchants: null,
      categories: ['home-textiles'],
      approvalAbove: null,
      productRules: [{ kind: 'requirePassport' }],
      schedule: null,
      validDays: 180,
    },
    setup + 2 * DAY,
  )
  ws = await revokeAgent(retired.ws, retired.agentId, now - 6 * DAY)

  // One completed order in the past, so the dashboard and ledger show a real trail
  const earlier = now - 2 * DAY
  const agent = findAgent(ws, atlas.agentId)!
  const offer = ws.offers.find((o) => o.sellerId === SELLER.cottonKin && o.title.startsWith('Bath Towel'))!
  const request = await signPurchaseRequest({ id: atlas.agentId, privateKey: agent.privateKey }, latestMandate(ws, atlas.agentId)!.id, offer, 120, earlier)
  ws = (await authorize(ws, request, earlier)).ws
  ws = (await settle(ws, request.id, earlier + 40_000)).ws

  return ws
}
