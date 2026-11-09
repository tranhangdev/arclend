import { Layout } from '@/components/Layout'
import { useRoute } from '@/lib/router'
import Dashboard from '@/pages/Dashboard'
import Markets from '@/pages/Markets'
import Assets from '@/pages/Assets'
import History from '@/pages/History'
import Swap from '@/pages/Swap'
import Bridge from '@/pages/Bridge'
import Docs from '@/pages/Docs'
import { MISSING_CONFIG } from '@/lib/pool'

export default function App() {
  const route = useRoute()

  if (MISSING_CONFIG.length > 0) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-[520px] rounded-2xl border border-line bg-panel p-6">
          <h1 className="font-serif text-[28px] font-semibold">Setup needed</h1>
          <p className="mt-2 text-[17px] text-muted">These settings are missing, so the app cannot find the lending contract:</p>
          <ul className="mt-3 list-disc pl-5 font-mono text-[14px]">
            {MISSING_CONFIG.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-3 text-[15px] text-muted">Add them to your environment (see the README) and redeploy.</p>
        </div>
      </main>
    )
  }

  return (
    <Layout route={route}>
      {route === '/' && <Dashboard />}
      {route === '/markets' && <Markets />}
      {route === '/deposit' && <Assets mode="deposit" />}
      {route === '/borrow' && <Assets mode="borrow" />}
      {route === '/swap' && <Swap />}
      {route === '/bridge' && <Bridge />}
      {route === '/history' && <History />}
      {route === '/docs' && <Docs />}
    </Layout>
  )
}
