import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Workspace } from '@/core/workspace'
import { createDemoWorkspace } from '@/data/seed'
import { Mark } from '@/ui/kit'

const STORAGE_KEY = 'saign.workspace.v4'

type Transform = (ws: Workspace) => Workspace | Promise<Workspace>

interface Store {
  ws: Workspace
  /** Applies an operation to the workspace. Operations are queued so the ledger chain can never fork. */
  apply: (transform: Transform) => Promise<Workspace>
  reset: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

function load(): Workspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Workspace) : null
    return parsed?.version === 1 ? parsed : null
  } catch {
    return null
  }
}

function save(ws: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ws))
  } catch {
    /* with storage unavailable the session continues in memory */
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null)
  const current = useRef<Workspace | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const commit = useCallback((next: Workspace) => {
    current.current = next
    setWs(next)
    save(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const existing = load()
    if (existing) commit(existing)
    else createDemoWorkspace(Date.now()).then((demo) => !cancelled && commit(demo))
    return () => {
      cancelled = true
    }
  }, [commit])

  const apply = useCallback(
    (transform: Transform) => {
      const run = queue.current.then(async () => {
        const next = await transform(current.current!)
        commit(next)
        return next
      })
      // Keep the queue running even when one operation throws
      queue.current = run.catch(() => undefined)
      return run
    },
    [commit],
  )

  const reset = useCallback(async () => {
    await apply(() => createDemoWorkspace(Date.now()))
  }, [apply])

  if (!ws) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-ink-3">
        <Mark className="size-10 animate-pulse text-gold" />
        <p className="text-[13px]">Signing</p>
      </div>
    )
  }
  return <StoreContext.Provider value={{ ws, apply, reset }}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside WorkspaceProvider.')
  return store
}
