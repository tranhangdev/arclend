import { useEffect, useState } from 'react'
import { CheckCheck, ExternalLink } from 'lucide-react'
import { useBlockNumber } from 'wagmi'
import { Link, type RoutePath } from '@/lib/router'
import { CHAIN_ID, POOL_ADDRESS, TOKENS } from '@/lib/pool'
import { buildAddressExplorerUrl, requireChain } from '@/onchain-facts'

const EXPLORER = requireChain(CHAIN_ID).explorerBase

const PAGES: { to: RoutePath; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/markets', label: 'Markets' },
  { to: '/deposit', label: 'Deposit' },
  { to: '/borrow', label: 'Borrow' },
  { to: '/swap', label: 'Swap' },
  { to: '/bridge', label: 'Bridge' },
  { to: '/history', label: 'History' },
]

const linkClass = 'inline-flex min-h-8 items-center gap-1.5 text-muted transition hover:text-cream'

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <ExternalLink size={12} className="opacity-60" />
    </a>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-cream/60">{title}</h3>
      <ul className="flex flex-col font-mono text-[14px]">{children}</ul>
    </div>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function Footer() {
  const time = useClock()
  const { data: block } = useBlockNumber({ chainId: CHAIN_ID, query: { refetchInterval: 20_000 } })

  return (
    <footer className="mt-16 overflow-hidden border-t border-line">
      <div
        className="relative px-6 pb-5 pt-10 md:px-10"
        style={{
          background:
            'radial-gradient(900px 260px at 15% 0%, rgba(125,160,150,0.18), transparent 70%), radial-gradient(700px 240px at 90% 100%, rgba(150,140,110,0.14), transparent 70%), rgba(255,255,255,0.03)',
        }}
      >
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
          <Column title="Pages">
            {PAGES.map((p) => (
              <li key={p.to}>
                <Link to={p.to} className={linkClass}>
                  {p.label}
                </Link>
              </li>
            ))}
          </Column>

          <Column title="Explorer">
            <li>
              <External href={EXPLORER}>Overview</External>
            </li>
            <li>
              <External href={buildAddressExplorerUrl(CHAIN_ID, POOL_ADDRESS)}>Lending contract</External>
            </li>
            {TOKENS.map((t) => (
              <li key={t.symbol}>
                <External href={buildAddressExplorerUrl(CHAIN_ID, t.address)}>{t.symbol} token</External>
              </li>
            ))}
          </Column>

          <Column title="Tools">
            <li>
              <External href="https://faucet.circle.com">Testnet faucet</External>
            </li>
            <li>
              <Link to="/swap" className={linkClass}>
                Swap USDC / EURC
              </Link>
            </li>
            <li>
              <Link to="/bridge" className={linkClass}>
                Bridge USDC
              </Link>
            </li>
            <li>
              <Link to="/history" className={linkClass}>
                Transaction history
              </Link>
            </li>
          </Column>

          <Column title="Resources">
            <li>
              <Link to="/docs" className={linkClass}>
                Docs
              </Link>
            </li>
            <li>
              <External href="https://docs.arc.io">Arc docs</External>
            </li>
            <li>
              <External href="https://developers.circle.com">Circle developers</External>
            </li>
            <li>
              <External href="https://faucet.circle.com">Faucet</External>
            </li>
          </Column>
        </div>

        <div className="mx-auto mt-8 flex max-w-[1180px] items-center justify-between font-mono text-[12px] text-muted">
          <span className="tnum">{block !== undefined ? `Arc Testnet · block ${block.toString()}` : 'Arc Testnet'}</span>
          <span className="tnum inline-flex items-center gap-2 text-cream/80">
            {time}
            <CheckCheck size={16} className="text-good" aria-label="Connected to Arc Testnet" />
          </span>
        </div>
      </div>
    </footer>
  )
}
