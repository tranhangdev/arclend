import type { ReactNode } from 'react'
import { TokenBTC, TokenEURC, TokenUSDC } from '@web3icons/react'
import { ConnectButton } from '@/components/Layout'

export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-[40px] font-semibold leading-tight tracking-tight text-balance md:text-[48px]">{children}</h1>
      {sub && <p className="mt-1 max-w-[60ch] text-pretty text-[17px] text-muted">{sub}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel ${className}`}>{children}</section>
}

export function ConnectGate({ title = 'Connect your wallet', body }: { title?: string; body: string }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="font-serif text-[24px] font-semibold">{title}</h2>
      <p className="mt-2 max-w-[44ch] text-[17px] text-muted">{body}</p>
      <ConnectButton className="mt-6" />
    </Card>
  )
}

export function TokenIcon({ symbol, size = 32 }: { symbol: string; size?: number }) {
  if (symbol === 'cirBTC') return <TokenBTC variant="branded" size={size} />
  return symbol === 'EURC' ? <TokenEURC variant="branded" size={size} /> : <TokenUSDC variant="branded" size={size} />
}

export function Stat({ label, value, tone = '', hint }: { label: string; value: ReactNode; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-raised/60 p-4">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`tnum mt-2 font-serif text-[30px] font-semibold leading-none ${tone}`}>{value}</div>
      {hint && <div className="mt-2 text-[14px] text-muted">{hint}</div>}
    </div>
  )
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-good border-good/30' : tone === 'bad' ? 'text-bad border-bad/30' : 'text-muted border-line'
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[12px] ${color}`}>{children}</span>
}

export function GhostButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-lg border border-line px-3.5 font-mono text-[13px] font-medium text-cream transition hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function SolidButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-lg bg-cream px-3.5 font-mono text-[13px] font-semibold text-ink transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
