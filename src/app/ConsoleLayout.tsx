import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookMarked, Bot, Grid3x3, LayoutDashboard, Menu, PackageCheck, PlayCircle, RotateCcw, ScrollText, X } from 'lucide-react'
import { Button, cn, Logo } from '@/ui/kit'
import { useStore } from './store'
import { Ticker } from './Ticker'

const NAV = [
  { to: '/console', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/console/scenario', label: 'Live scenario', icon: PlayCircle },
  { to: '/console/agents', label: 'Agents', icon: Bot },
  { to: '/console/products', label: 'Product passports', icon: PackageCheck },
  { to: '/console/matrix', label: 'Authority matrix', icon: Grid3x3 },
  { to: '/console/ledger', label: 'Audit ledger', icon: ScrollText },
  { to: '/console/sources', label: 'Sources', icon: BookMarked },
]

export function ConsoleLayout() {
  const { ws, reset } = useStore()
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  const pending = ws.purchases.filter((p) => p.status === 'awaiting-approval').length

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-black/70 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/">
            <Logo />
          </Link>
          <button className="rounded-sm p-1.5 text-ink-3 hover:bg-sunken lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn('flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium transition-colors', isActive ? 'bg-sunken text-gold shadow-[inset_2px_0_0_var(--color-gold)]' : 'text-ink-2 hover:bg-sunken hover:text-ink')
              }
            >
              <item.icon className="size-4" />
              {item.label}
              {item.to === '/console/scenario' && pending > 0 && <span className="tabular ml-auto rounded-full bg-review px-1.5 text-[11px] text-onyx">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <p className="text-[12px] text-ink-3">Workspace</p>
          <p className="mt-1 text-[14px] font-semibold">{ws.principal.name}</p>
          <p className="text-[12px] text-ink-3">{ws.principal.city} · demo</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            disabled={resetting}
            onClick={async () => {
              setResetting(true)
              await reset()
              setResetting(false)
            }}
          >
            <RotateCcw /> {resetting ? 'Resetting' : 'Reset demo'}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <button className="rounded-sm p-1.5 text-ink-2 hover:bg-sunken" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo />
        </div>
        <Ticker />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <h1 className="font-display text-[34px] leading-tight">{title}</h1>
      {action}
    </div>
  )
}

/** Shared table header style. */
export const TH = 'px-5 py-3 text-left text-[12px] font-medium text-ink-3'
