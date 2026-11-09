import { Layout } from '@/components/Layout'
import { useRoute } from '@/lib/router'
import Dashboard from '@/pages/Dashboard'
import Markets from '@/pages/Markets'
import Assets from '@/pages/Assets'
import History from '@/pages/History'
import Swap from '@/pages/Swap'
import Bridge from '@/pages/Bridge'
import Docs from '@/pages/Docs'

export default function App() {
  const route = useRoute()

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
