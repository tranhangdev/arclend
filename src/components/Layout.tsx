import { useState, type ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { Menu, X } from 'lucide-react'
import { Link, type RoutePath } from '@/lib/router'
import { shortAddr } from '@/lib/format'
import { Footer } from '@/components/Footer'

const NAV: { to: RoutePath; label: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/markets', label: 'Markets' },
  { to: '/deposit', label: 'Deposit' },
  { to: '/borrow', label: 'Borrow' },
  { to: '/swap', label: 'Swap' },
  { to: '/bridge', label: 'Bridge' },
  { to: '/history', label: 'History' },
  { to: '/docs', label: 'Docs' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="14" stroke="#f3ede2" strokeWidth="1.6" />
        <path d="M4 12c4-3 8-3 12 0s8 3 12 0M4 17c4-3 8-3 12 0s8 3 12 0M4 22c4-3 8-3 12 0s8 3 12 0" stroke="#f3ede2" strokeWidth="1.4" fill="none" />
      </svg>
      <span className="font-serif text-[28px] font-medium leading-none tracking-tight">arc lend</span>
    </div>
  )
}

export function ConnectButton({ className = '' }: { className?: string }) {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address }) => (
        <button
          onClick={show}
          className={`min-h-11 rounded-lg bg-cream px-4 font-mono text-[15px] font-semibold text-ink transition hover:bg-white active:scale-[0.98] ${className}`}
        >
          {isConnecting ? 'Connecting...' : isConnected && address ? shortAddr(address) : 'Connect Wallet'}
        </button>
      )}
    </ConnectKitButton.Custom>
  )
}

export function Layout({ route, children }: { route: RoutePath; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="flex flex-col gap-1 font-mono text-[15px] font-medium">
      {NAV.map((item) => {
        const active = item.to === route
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex min-h-10 items-center gap-2 rounded-md px-1 transition ${active ? 'text-cream' : 'text-muted hover:text-cream'}`}
          >
            <span className={`w-2 text-center ${active ? 'opacity-100' : 'opacity-0'}`}>•</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button className="grid size-11 place-items-center rounded-lg text-cream md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[13px] text-muted sm:flex">
            <span className="size-2 rounded-full bg-good" />
            Arc Testnet
          </div>
          <ConnectButton />
        </div>
      </header>

      {open && <div className="border-b border-line bg-ink px-6 pb-4 md:hidden">{nav}</div>}

      <div className="flex">
        <aside className="sticky top-[68px] hidden h-[calc(100dvh-68px)] w-[200px] shrink-0 flex-col justify-between px-6 pb-8 pt-4 md:flex">
          {nav}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
          >
            Testnet faucet
          </a>
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:pl-2 md:pr-10">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
