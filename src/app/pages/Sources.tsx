import { ArrowUpRight } from 'lucide-react'
import { SOURCES, type SourceKind } from '@/data/sources'
import { Card, Eyebrow } from '@/ui/kit'
import { PageHeader } from '../ConsoleLayout'

const ORDER: SourceKind[] = ['YC RFS', 'YC company', 'Hacker News', 'Regulation']

export function SourceList() {
  return (
    <div className="flex flex-col gap-10">
      {ORDER.map((kind) => (
        <section key={kind}>
          <div className="mb-4 flex items-center gap-4">
            <Eyebrow className="text-gold">{kind}</Eyebrow>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line md:grid-cols-2">
            {SOURCES.filter((s) => s.kind === kind).map((s) => (
              <a key={s.url + s.title} href={s.url} target="_blank" rel="noreferrer" className="group flex flex-col gap-2 bg-surface p-6 transition-colors hover:bg-sunken">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-[18px] leading-snug">{s.title}</p>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-3 transition-colors group-hover:text-gold" />
                </div>
                <p className="text-[12px] text-ink-3">{s.meta}</p>
                <p className="text-[13px] leading-relaxed text-ink-2">{s.takeaway}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function Sources() {
  return (
    <>
      <PageHeader title="Sources" />
      <Card className="mb-10 grid gap-0 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-7">
          <Eyebrow>Clone</Eyebrow>
          <p className="font-display mt-3 text-[22px] leading-snug">Allowance and Agentic Fabriq</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">Agent passport, mandate, single-use payment, human approval, audit trail.</p>
        </div>
        <div className="p-7">
          <Eyebrow className="text-gold">Innovation</Eyebrow>
          <p className="font-display mt-3 text-[22px] leading-snug">Product passport rules</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">Carbon, recycled content, origin and certification, verified at purchase against the passport the manufacturer signed.</p>
        </div>
      </Card>
      <SourceList />
    </>
  )
}
