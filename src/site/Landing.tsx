import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Fingerprint, X } from 'lucide-react'
import { TIMELINE } from '@/data/sources'
import { SourceList } from '@/app/pages/Sources'
import { Button, cn, Eyebrow, Logo, Mark } from '@/ui/kit'
import { TickerTape, type Tick } from '@/ui/TickerTape'

const SAMPLE_TICKS: Tick[] = [
  { pair: 'Cartwright → Cotton & Kin Mills', amount: '€1,020', verdict: 'allow' },
  { pair: 'Cartwright → Loomhouse Textiles', amount: '€870', verdict: 'deny' },
  { pair: 'Ampera → Halcyon Cell Co.', amount: '€7,400', verdict: 'review' },
  { pair: 'Cartwright → Bargain Harbor', amount: '€660', verdict: 'deny' },
  { pair: 'Cartwright → Cotton & Kin Mills', amount: '€1,120', verdict: 'allow' },
  { pair: 'Ampera → Meridian Supply Co.', amount: '€6,160', verdict: 'deny' },
]

const SECTIONS = [
  { id: 'problem', label: 'Problem' },
  { id: 'system', label: 'System' },
  { id: 'product-passport', label: 'Product passport' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sources', label: 'Sources' },
]

/** Scrolls to a section of this page without touching the URL. */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-10 px-5">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
          <Logo />
        </button>
        <nav className="hidden flex-1 items-center gap-8 text-[13px] font-medium text-ink-2 md:flex">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => scrollToSection(s.id)} className="transition-colors hover:text-gold">
              {s.label}
            </button>
          ))}
        </nav>
        <Link to="/console" className="ml-auto">
          <Button size="sm">
            Console <ArrowRight />
          </Button>
        </Link>
      </div>
    </header>
  )
}

function HeroArt() {
  return (
    <div className="h-[320px] min-[440px]:h-[410px] sm:h-[500px]">
      <div className="relative h-[500px] w-[460px] origin-top-left scale-[0.62] min-[440px]:scale-[0.8] sm:mx-auto sm:scale-100">
        <div className="absolute left-0 top-2 w-[300px] -rotate-3 rounded-md bg-gradient-to-br from-[#161a21] to-onyx p-6 shadow-lift ring-1 ring-gold/30">
          <div className="flex items-start justify-between">
            <div>
              <Eyebrow className="text-gold">Agent passport</Eyebrow>
              <p className="font-display mt-2 text-[34px] leading-none">Cartwright</p>
              <p className="mt-1.5 text-[12px] text-ink-2">Home textile sourcing</p>
            </div>
            <Mark className="size-9 text-gold" />
          </div>
          <dl className="mt-7 flex flex-col gap-2.5 text-[12px]">
            <div className="flex justify-between"><dt className="text-ink-3">On behalf of</dt><dd>Lumen & Loom</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Transaction limit</dt><dd className="tabular">€2,000</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Approval above</dt><dd className="tabular">€1,500</dd></div>
          </dl>
          <p className="tabular mt-6 flex items-center gap-1.5 text-[11px] tracking-wider text-ink-3">
            <Fingerprint className="size-3" /> 7F3A 9C21 B40E 55D8
          </p>
        </div>

        <div className="absolute right-0 top-[252px] w-[290px] rotate-2 rounded-md bg-surface p-5 shadow-lift ring-1 ring-line-strong">
          <Eyebrow>Digital product passport</Eyebrow>
          <p className="font-display mt-2 text-[22px] leading-tight">Bath Towel 50×90</p>
          <p className="text-[12px] text-ink-3">Cotton & Kin Mills · Denizli</p>
          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full">
            <div className="w-[70%] bg-gold" />
            <div className="w-[30%] bg-allow" />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['3.1 kg', 'CO₂e'],
              ['30%', 'recycled'],
              ['GOTS', 'certified'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-sm bg-onyx py-2 ring-1 ring-line">
                <dd className="tabular text-[13px]">{v}</dd>
                <dt className="mt-0.5 text-[10px] text-ink-3">{l}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-stamp absolute bottom-10 left-2 flex items-center gap-2.5 rounded-sm border border-allow bg-onyx px-4 py-2.5 text-[12px] font-semibold text-allow [animation-delay:400ms]">
          <span className="text-[8px]">▲</span> 18 of 18 checks · Allowed
        </div>
      </div>
    </div>
  )
}

function Section({ id, index, eyebrow, title, children, className }: { id: string; index: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-16 py-24 sm:py-32', className)}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex items-center gap-4">
          <span className="tabular text-[12px] text-gold">{index}</span>
          <span className="h-px w-10 bg-gold/50" />
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h2 className="font-display mt-6 max-w-3xl text-[34px] leading-[1.08] sm:text-[50px]">{title}</h2>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  )
}

const BOARD = [
  { value: '18', label: 'Checks per request' },
  { value: 'ES256', label: 'Signature algorithm' },
  { value: '10 min', label: 'Credential lifetime' },
  { value: '18 Feb 2027', label: 'EU battery passport' },
]

const PROBLEMS = [
  { title: 'An agent should never see your card', body: 'Hand an agent your card number and it has no spending limit.' },
  { title: 'A seller should know who is asking', body: 'Nothing tells an authorised agent apart from a stray bot.' },
  { title: 'A claim should be provable', body: 'An agent can neither read nor verify a carbon figure in a PDF.' },
]

const STEPS = [
  { title: 'Sign', body: 'The agent signs the request with its own key.' },
  { title: 'Check', body: 'Agent, mandate, budget, product. One failure means denial.' },
  { title: 'Approve', body: 'Amounts above the threshold go to your phone.' },
  { title: 'Pay', body: 'One seller, one amount, one use.' },
]

const CHECKS: Array<[string, boolean]> = [
  ['Agent passport valid', true],
  ["Request signed with the agent's key", true],
  ['Seller allowed', true],
  ['Transaction limit · €870 of €2,000', true],
  ['Product passport signature valid', true],
  ['Recycled content at least 20%', false],
]

export function Landing() {
  return (
    <div className="bg-paper">
      <TickerTape ticks={SAMPLE_TICKS} />
      <Nav />

      <section className="bg-grid overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="animate-rise">
            <p className="font-display text-[15px] font-medium text-gold">Trust, signed.</p>
            <h1 className="font-display mt-6 text-[46px] leading-[1] sm:text-[76px]">
              Your agent has
              <br />
              your wallet.
              <br />
              <span className="text-gold">Give it rules.</span>
            </h1>
            <p className="mt-8 max-w-md text-[16px] leading-relaxed text-ink-2">Signed identity. Signed limits. Signed products. Every purchase is verified before a cent moves.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/console/scenario">
                <Button size="lg">
                  Live scenario <ArrowRight />
                </Button>
              </Link>
              <Button size="lg" variant="secondary" onClick={() => scrollToSection('system')}>
                How it works
              </Button>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      <div className="hairline-gold" />
      <section className="bg-onyx">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-5 md:grid-cols-4 md:divide-x">
          {BOARD.map((b) => (
            <div key={b.label} className="px-2 py-8 md:px-8">
              <dd className="tabular text-[26px] text-ink sm:text-[30px]">{b.value}</dd>
              <dt className="mt-2 text-[12px] text-ink-3">{b.label}</dt>
            </div>
          ))}
        </dl>
      </section>
      <div className="hairline-gold" />

      <Section id="problem" index="01" eyebrow="Problem" title="Agents are buying. Nothing knows who they are.">
        <div className="grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line md:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <div key={p.title} className="bg-surface p-8">
              <span className="tabular text-[12px] text-gold">0{i + 1}</span>
              <h3 className="font-display mt-6 text-[22px] leading-tight">{p.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="system" index="02" eyebrow="System" title="Three documents, one decision." className="border-y border-line bg-onyx">
        <ol className="grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-surface p-7">
              <span className="font-display text-[40px] leading-none text-gold">{i + 1}</span>
              <h3 className="font-display mt-5 text-[17px]">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-md bg-surface ring-1 ring-line">
            <div className="border-b border-line px-5 py-3 text-[12px] text-ink-3">mandate.json</div>
            <pre className="overflow-x-auto p-5 font-sans text-[13px] leading-[1.75] text-ink-2">
{`{
  "type": "Mandate",
  "agentId": "saign:agent:7f3a9c21",
  "limits": { "perTransaction": 200000, "daily": 400000 },
  "approvalAbove": 150000,
  "categories": ["home-textiles"],
  "schedule": { "days": [1, 2, 3, 4, 5], "fromHour": 9, "toHour": 18 },
  "productRules": [
    { "kind": "requirePassport" },
    { "kind": "maxCarbon", "kgCO2ePerUnit": 10 },
    { "kind": "minRecycled", "percent": 20 }
  ],
  "proof": { "alg": "ES256", "signature": "kQ3v…" }
}`}
            </pre>
          </div>
          <div className="rounded-md bg-surface p-6 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-ink-2">Cartwright → Loomhouse Textiles</p>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-deny">
                <span className="text-[8px]">▼</span> Denied
              </span>
            </div>
            <p className="tabular mt-2 text-[34px] leading-none">€870</p>
            <ul className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
              {CHECKS.map(([label, ok]) => (
                <li key={label} className="flex items-center gap-3 text-[14px]">
                  <span className={cn('flex size-[16px] items-center justify-center rounded-full', ok ? 'bg-allow-soft text-allow' : 'bg-deny text-onyx')}>
                    {ok ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className={cn(ok ? 'text-ink-2' : 'font-medium text-deny')}>{label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-[12px] text-ink-3">Passport states 5% · minimum is 20%</p>
          </div>
        </div>
      </Section>

      <Section id="product-passport" index="03" eyebrow="Product passport" title="Not only how much. Which.">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-md bg-surface p-8 ring-1 ring-line lg:col-span-2">
            <h3 className="font-display text-[24px] leading-tight">A manufacturer with a passport becomes buyable by agents.</h3>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">The EU is making the digital product passport mandatory one product group at a time. Batteries come first: 18 February 2027.</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-sm bg-line ring-1 ring-line sm:grid-cols-3">
              {[
                ['Denizli', 'Home textiles'],
                ['Bursa', 'Weaving'],
                ['Izmir', 'Energy storage'],
              ].map(([city, sector]) => (
                <div key={city} className="bg-onyx p-5">
                  <p className="font-display text-[20px]">{city}</p>
                  <p className="mt-1 text-[12px] text-ink-3">{sector}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-md bg-gradient-to-br from-[#161a21] to-onyx p-8 ring-1 ring-gold/30">
            <Eyebrow className="text-gold">Tamper-evident</Eyebrow>
            <h3 className="font-display mt-4 text-[24px] leading-tight">Change one digit and the signature fails.</h3>
            <Link to="/console/products" className="mt-auto inline-flex items-center gap-2 pt-8 text-[13px] font-semibold text-gold hover:underline">
              View passports <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </Section>

      <Section id="timeline" index="04" eyebrow="Timeline" title="Two calendars meet in the same year." className="border-y border-line bg-onyx">
        <ol className="grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line md:grid-cols-4">
          {TIMELINE.map((t) => (
            <li key={t.date} className="bg-surface p-7">
              <p className="tabular text-[12px] text-gold">{t.date}</p>
              <h3 className="font-display mt-5 text-[19px] leading-snug">{t.title}</h3>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="sources" index="05" eyebrow="Sources" title="Y Combinator. Hacker News.">
        <SourceList />
      </Section>

      <div className="hairline-gold" />
      <section className="bg-onyx">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-24 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-[38px] leading-[1.05] sm:text-[56px]">
            Seven scenarios.
            <br />
            <span className="text-gold">Real signatures.</span>
          </h2>
          <Link to="/console/scenario">
            <Button size="lg">
              Open console <ArrowRight />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Logo />
          <p className="text-[12px] text-ink-3">Trust, signed. · Demo data is fictional</p>
        </div>
      </footer>
    </div>
  )
}
