import { useAccount } from 'wagmi'
import { Card, ConnectGate, PageTitle, Stat, TokenIcon } from '@/components/ui'
import { Link } from '@/lib/router'
import { useReserves, useUserData } from '@/hooks/usePool'
import { TOKENS } from '@/lib/pool'
import { fmtHealth, fmtPct, fmtToken, fmtUsd8, healthTone } from '@/lib/format'

export default function Dashboard() {
  const { isConnected } = useAccount()
  const { reserves } = useReserves()
  const { positions, account, isLoading } = useUserData()

  if (!isConnected) {
    return (
      <>
        <PageTitle>Dashboard</PageTitle>
        <ConnectGate body="Connect your wallet to see your supplied assets, debt and health factor on Arc." />
      </>
    )
  }

  const noHealth = 2n ** 255n
  const supplied = TOKENS.filter((t) => (positions[t.symbol]?.supplied ?? 0n) > 0n)
  const borrowed = TOKENS.filter((t) => (positions[t.symbol]?.borrowed ?? 0n) > 0n)

  return (
    <>
      <PageTitle sub="Your lending position across Arc Lend markets.">Dashboard</PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collateral" value={fmtUsd8(account?.totalCollateralUsd8 ?? 0n)} />
        <Stat label="Debt" value={fmtUsd8(account?.totalDebtUsd8 ?? 0n)} />
        <Stat label="Borrow capacity" value={fmtUsd8(account?.borrowCapacityUsd8 ?? 0n)} />
        <Stat label="Health factor" value={fmtHealth(account?.healthFactorWad ?? noHealth)} tone={healthTone(account?.healthFactorWad ?? noHealth)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PositionCard title="Your supplies" empty="Nothing supplied yet." cta={{ to: '/deposit', label: 'Go to Deposit' }} loading={isLoading}>
          {supplied.map((t) => {
            const r = reserves[t.symbol]
            const p = positions[t.symbol]
            if (!r || !p) return null
            return <Row key={t.symbol} symbol={t.symbol} amount={fmtToken(p.supplied, r.decimals, 4)} rate={`${fmtPct(r.supplyRateBps)} APR`} note={p.collateralEnabled ? 'Collateral' : ''} />
          })}
        </PositionCard>
        <PositionCard title="Your borrows" empty="No active debt." cta={{ to: '/borrow', label: 'Go to Borrow' }} loading={isLoading}>
          {borrowed.map((t) => {
            const r = reserves[t.symbol]
            const p = positions[t.symbol]
            if (!r || !p) return null
            return <Row key={t.symbol} symbol={t.symbol} amount={fmtToken(p.borrowed, r.decimals, 4)} rate={`${fmtPct(r.borrowRateBps)} APR`} note="" />
          })}
        </PositionCard>
      </div>
    </>
  )
}

function PositionCard({
  title,
  empty,
  cta,
  loading,
  children,
}: {
  title: string
  empty: string
  cta: { to: '/deposit' | '/borrow'; label: string }
  loading: boolean
  children: React.ReactNode[]
}) {
  const has = children.some(Boolean)
  return (
    <Card className="p-5">
      <h2 className="font-serif text-[22px] font-semibold">{title}</h2>
      <div className="mt-3 divide-y divide-line/60">{has ? children : null}</div>
      {!has && (
        <div className="py-6">
          <p className="text-muted">{loading ? 'Loading...' : empty}</p>
          <Link to={cta.to} className="mt-3 inline-block font-mono text-[13px] text-cream underline underline-offset-4">
            {cta.label}
          </Link>
        </div>
      )}
    </Card>
  )
}

function Row({ symbol, amount, rate, note }: { symbol: string; amount: string; rate: string; note: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <TokenIcon symbol={symbol} size={30} />
        <div>
          <div className="font-serif text-[18px] font-semibold leading-tight">{symbol}</div>
          <div className="font-mono text-[12px] text-muted">{note || rate}</div>
        </div>
      </div>
      <div className="tnum text-right font-mono text-[15px]">
        {amount}
        {note && <div className="text-[12px] text-muted">{rate}</div>}
      </div>
    </div>
  )
}
