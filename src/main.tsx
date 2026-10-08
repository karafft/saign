import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import './index.css'
import { ConsoleLayout } from './app/ConsoleLayout'
import { AgentDetail, Agents } from './app/pages/Agents'
import { Ledger } from './app/pages/Ledger'
import { Matrix } from './app/pages/Matrix'
import { Overview } from './app/pages/Overview'
import { ProductDetail, Products, PublicPassport } from './app/pages/Products'
import { Scenario } from './app/pages/Scenario'
import { Sources } from './app/pages/Sources'
import { WorkspaceProvider } from './app/store'
import { Landing } from './site/Landing'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // In recent browsers scrollTo returns a Promise, which must not be returned from an effect
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          element={
            <WorkspaceProvider>
              <ConsoleLayout />
            </WorkspaceProvider>
          }
        >
          <Route path="console" element={<Overview />} />
          <Route path="console/scenario" element={<Scenario />} />
          <Route path="console/agents" element={<Agents />} />
          <Route path="console/agents/:id" element={<AgentDetail />} />
          <Route path="console/products" element={<Products />} />
          <Route path="console/products/:id" element={<ProductDetail />} />
          <Route path="console/matrix" element={<Matrix />} />
          <Route path="console/ledger" element={<Ledger />} />
          <Route path="console/sources" element={<Sources />} />
        </Route>
        <Route
          path="p/:id"
          element={
            <WorkspaceProvider>
              <PublicPassport />
            </WorkspaceProvider>
          }
        />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
