import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, BatteryCharging, ExternalLink, Factory, Leaf, MapPin, Plus, Recycle, Undo2, Wrench, Zap, type LucideIcon } from 'lucide-react'
import { CATEGORY_LABEL, formatEuro, type Category, type ProductPassport } from '@/core/types'
import { addProduct, findProduct, findSeller, restoreProduct, tamperProduct, type Workspace } from '@/core/workspace'
import { Badge, Button, Card, CardHeader, Dialog, Eyebrow, Field, formatDate, Input, Logo, Mono, Select, shortId } from '@/ui/kit'
import { PageHeader, TH } from '../ConsoleLayout'
import { CompositionBar, productSummary, SignatureBadge, useFingerprint, useIntact } from '../parts'
import { useStore } from '../store'

function Row({ ws, product }: { ws: Workspace; product: ProductPassport }) {
  const intact = useIntact(ws, product)
  const seller = findSeller(ws, product.manufacturerId)
  const offer = ws.offers.find((o) => o.productId === product.id)
  return (
    <tr className="hover:bg-sunken/50">
      <td className="px-5 py-3.5">
        <Link to={`/console/products/${encodeURIComponent(product.id)}`} className="font-semibold hover:text-gold">
          {product.name}
        </Link>
        <p className="text-[12px] text-ink-3">{product.model}</p>
      </td>
      <td className="px-5 py-3.5">
        <p>{seller?.name}</p>
        <p className="text-[12px] text-ink-3">
          {seller?.city}, {product.manufacturedIn}
        </p>
      </td>
      <td className="tabular px-5 py-3.5">{product.carbonKgCO2e} kg</td>
      <td className="tabular px-5 py-3.5">{productSummary(product).recycled}%</td>
      <td className="tabular px-5 py-3.5">{offer ? formatEuro(offer.unitPrice) : '—'}</td>
      <td className="px-5 py-3.5">
        <SignatureBadge intact={intact} />
      </td>
    </tr>
  )
}

export function Products() {
  const { ws } = useStore()
  const [creating, setCreating] = useState(false)
  return (
    <>
      <PageHeader
        title="Product passports"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Issue passport
          </Button>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line">
              {['Product', 'Manufacturer', 'CO₂e per unit', 'Recycled', 'Unit price', 'Signature'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ws.products.map((p) => (
              <Row key={p.id} ws={ws} product={p} />
            ))}
          </tbody>
        </table>
      </Card>
      <NewProductDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}

function NewProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ws, apply } = useStore()
  const navigate = useNavigate()
  const issuers = ws.sellers.filter((s) => s.verified && ws.sellerKeys[s.id])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    model: '',
    category: 'home-textiles' as Category,
    manufacturerId: issuers[0]?.id ?? '',
    material: 'Organic cotton',
    recycledMaterial: 'Recycled cotton',
    recycledPercent: '30',
    carbon: '3.5',
    certifications: 'OEKO-TEX Standard 100',
    repairScore: '',
    price: '4',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const recycled = Math.min(100, Math.max(0, Number(form.recycledPercent) || 0))
  const valid = form.name.trim().length > 1 && Number(form.carbon) > 0 && Number(form.price) > 0 && !!form.manufacturerId

  const submit = async () => {
    setBusy(true)
    const seller = findSeller(ws, form.manufacturerId)!
    let created = ''
    await apply(async (w) => {
      const result = await addProduct(
        w,
        {
          gtin: `869${String(Date.now()).slice(-10)}`,
          name: form.name.trim(),
          model: form.model.trim() || 'Standard',
          category: form.category,
          manufacturerId: seller.id,
          manufacturedIn: seller.country,
          manufacturedAt: new Date().toISOString().slice(0, 7),
          composition: [
            ...(recycled < 100 ? [{ material: form.material.trim() || 'Primary material', percent: 100 - recycled, recycledPercent: 0 }] : []),
            ...(recycled > 0 ? [{ material: form.recycledMaterial.trim() || 'Recycled material', percent: recycled, recycledPercent: 100 }] : []),
          ],
          carbonKgCO2e: Number(form.carbon),
          certifications: form.certifications
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          repairScore: form.repairScore === '' ? null : Math.min(10, Math.max(0, Number(form.repairScore))),
          endOfLife: 'No manufacturer statement provided.',
        },
        { unitPrice: Math.round(Number(form.price) * 100), minQuantity: 1, leadDays: 10 },
        Date.now(),
      )
      created = result.productId
      return result.ws
    })
    setBusy(false)
    onClose()
    navigate(`/console/products/${encodeURIComponent(created)}`)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Issue product passport"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? 'Signing' : 'Sign and publish'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Bathrobe" autoFocus />
        </Field>
        <Field label="Model">
          <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="PB-380" />
        </Field>
        <Field label="Manufacturer">
          <Select value={form.manufacturerId} onChange={(e) => set('manufacturerId', e.target.value)}>
            {issuers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.city}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Primary material">
          <Input value={form.material} onChange={(e) => set('material', e.target.value)} />
        </Field>
        <Field label="Recycled material">
          <Input value={form.recycledMaterial} onChange={(e) => set('recycledMaterial', e.target.value)} />
        </Field>
        <Field label="Recycled share (%)">
          <Input type="number" min={0} max={100} value={form.recycledPercent} onChange={(e) => set('recycledPercent', e.target.value)} />
        </Field>
        <Field label="Carbon footprint (kg CO₂e per unit)">
          <Input type="number" min={0} step="0.1" value={form.carbon} onChange={(e) => set('carbon', e.target.value)} />
        </Field>
        <Field label="Certifications" hint="Comma-separated">
          <Input value={form.certifications} onChange={(e) => set('certifications', e.target.value)} />
        </Field>
        <Field label="Repairability (0–10)" hint="Empty: not applicable">
          <Input type="number" min={0} max={10} value={form.repairScore} onChange={(e) => set('repairScore', e.target.value)} />
        </Field>
        <Field label="Unit price (€)">
          <Input type="number" min={0} step="0.1" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-sm bg-onyx p-4 ring-1 ring-line">
      <Icon className="size-4 text-ink-3" />
      <p className="tabular mt-3 text-[22px] leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-ink-3">{label}</p>
    </div>
  )
}

/** The passport view, shared by the console and the public page the QR code opens. */
function PassportView({ ws, product }: { ws: Workspace; product: ProductPassport }) {
  const intact = useIntact(ws, product)
  const seller = findSeller(ws, product.manufacturerId)
  const print = useFingerprint(seller?.publicKey)
  const { recycled } = productSummary(product)
  const [qr, setQr] = useState('')
  const publicUrl = `${window.location.origin}/p/${encodeURIComponent(product.id)}`

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { margin: 0, width: 220, color: { dark: '#06070a', light: '#ece8df' } }).then(setQr)
  }, [publicUrl])

  const battery: Array<[LucideIcon, string, string]> = product.battery
    ? [
        [BatteryCharging, 'Chemistry', product.battery.chemistry],
        [Zap, 'Capacity', `${product.battery.capacityKWh} kWh`],
        [Recycle, 'Rated cycles', product.battery.ratedCycles.toLocaleString('en-US')],
      ]
    : []

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Digital product passport · {CATEGORY_LABEL[product.category]}</Eyebrow>
              <h1 className="font-display mt-2 text-[34px] leading-tight">{product.name}</h1>
              <p className="mt-1 text-[14px] text-ink-2">{product.model}</p>
            </div>
            <SignatureBadge intact={intact} />
          </div>
          {intact === false && <p className="mt-4 rounded-sm bg-deny-soft px-4 py-3 text-[13px] text-deny">Content does not match the manufacturer's signature.</p>}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Leaf} label="kg CO₂e per unit" value={String(product.carbonKgCO2e)} />
            <Fact icon={Recycle} label="recycled content" value={`${recycled}%`} />
            <Fact icon={Wrench} label="repairability" value={product.repairScore === null ? '—' : `${product.repairScore}/10`} />
            <Fact icon={MapPin} label="made in" value={product.manufacturedIn} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Material composition" />
          <div className="p-5">
            <CompositionBar product={product} />
          </div>
        </Card>

        {battery.length > 0 && (
          <Card>
            <CardHeader title="Battery" />
            <dl className="grid grid-cols-3 divide-x divide-line">
              {battery.map(([Icon, label, value]) => (
                <div key={label} className="p-5">
                  <Icon className="size-4 text-ink-3" />
                  <dd className="tabular mt-2 text-[16px]">{value}</dd>
                  <dt className="text-[12px] text-ink-3">{label}</dt>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader title="Certifications and end of life" />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-1.5">
              {product.certifications.length ? product.certifications.map((c) => <Badge key={c} tone="info">{c}</Badge>) : <span className="text-[13px] text-ink-3">None declared</span>}
            </div>
            <p className="text-[14px] leading-relaxed text-ink-2">{product.endOfLife}</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          {qr ? <img src={qr} alt="Passport QR code" className="size-[180px] rounded-sm" /> : <div className="size-[180px] animate-pulse rounded-sm bg-sunken" />}
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-gold hover:underline">
            Public page <ExternalLink className="size-3.5" />
          </a>
        </Card>

        <Card className="p-5">
          <Eyebrow>Issued by</Eyebrow>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-sm bg-sunken">
              <Factory className="size-5 text-ink-2" />
            </span>
            <div>
              <p className="text-[14px] font-semibold">{seller?.name}</p>
              <p className="text-[12px] text-ink-3">
                {seller?.city} · {seller?.sector}
              </p>
            </div>
          </div>
          <dl className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 text-[12px]">
            {[
              ['Passport id', shortId(product.id)],
              ['GTIN', product.gtin],
              ['Manufacturer key', print],
              ['Signature (ES256)', `${product.proof.signature.slice(0, 40)}…`],
              ['Signed', formatDate(product.proof.signedAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-3">{k}</dt>
                <dd className="break-all">
                  <Mono>{v}</Mono>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}

export function ProductDetail() {
  const { id = '' } = useParams()
  const { ws, apply } = useStore()
  const product = findProduct(ws, decodeURIComponent(id))
  const intact = useIntact(ws, product)
  if (!product) return <Navigate to="/console/products" replace />

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/console/products" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-gold">
          <ArrowLeft className="size-3.5" /> Product passports
        </Link>
        {intact === false ? (
          <Button variant="secondary" size="sm" onClick={() => apply((w) => restoreProduct(w, product.id))}>
            <Undo2 /> Restore signed original
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={() => apply((w) => tamperProduct(w, product.id))} title="Lowers the carbon figure without re-signing">
            Demo: tamper with data
          </Button>
        )}
      </div>
      <PassportView ws={ws} product={product} />
    </>
  )
}

/** The page the QR code opens: no console chrome, only the passport. */
export function PublicPassport() {
  const { id = '' } = useParams()
  const { ws } = useStore()
  const product = findProduct(ws, decodeURIComponent(id))
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        <Badge>Verification</Badge>
      </header>
      {product ? (
        <PassportView ws={ws} product={product} />
      ) : (
        <Card className="p-10 text-center">
          <p className="font-display text-[24px]">Passport not found</p>
        </Card>
      )}
    </div>
  )
}
