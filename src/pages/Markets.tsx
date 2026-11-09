import { Card, PageTitle, Pill, Stat, TokenIcon } from '@/components/ui'
import { useReserves } from '@/hooks/usePool'
import { TOKENS } from '@/lib/pool'
import { fmtPct, fmtToken, fmtUsd8 } from '@/lib/format'

export default function Markets() {
  const { reserves, isLoading } = useReserves()

  const totals = TOKENS.reduce(
    (acc, t) => {
      const r = reserves[t.symbol]
      if (!r) return acc
      const unit = 10n ** BigInt(r.decimals)
      return {
        supply: acc.supply + (r.totalSupply * r.priceUsd8) / unit,
        borrow: acc.borrow + (r.totalBorrow * r.priceUsd8) / unit,
      }
    },
    { supply: 0n, borrow: 0n },
  )

  return (
    <>
      <PageTitle sub="Live rates for every asset listed on Arc Lend. Rates move with pool utilization.">Markets</PageTitle>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total supplied" value={fmtUsd8(totals.supply)} />
        <Stat label="Total borrowed" value={fmtUsd8(totals.borrow)} />
        <Stat label="Available liquidity" value={fmtUsd8(totals.supply > totals.borrow ? totals.supply - totals.borrow : 0n)} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-line font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
              <th className="px-5 py-4 font-medium">Asset</th>
              <th className="px-3 py-4 font-medium">Supplied</th>
              <th className="px-3 py-4 font-medium">Supply APR</th>
              <th className="px-3 py-4 font-medium">Borrowed</th>
              <th className="px-3 py-4 font-medium">Borrow APR</th>
              <th className="px-3 py-4 font-medium">Utilization</th>
              <th className="px-5 py-4 font-medium">Max LTV</th>
            </tr>
          </thead>
          <tbody>
            {TOKENS.map((t) => {
              const r = reserves[t.symbol]
              return (
                <tr key={t.symbol} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={t.symbol} />
                      <div>
                        <div className="font-serif text-[18px] font-semibold leading-tight">{t.symbol}</div>
                        <div className="text-[14px] text-muted">{t.name}</div>
                      </div>
                    </div>
                  </td>
                  {r ? (
                    <>
                      <td className="tnum px-3 py-4 font-mono text-[14px]">
                        {fmtToken(r.totalSupply, r.decimals)}
                        <div className="text-[12px] text-muted">{fmtUsd8((r.totalSupply * r.priceUsd8) / 10n ** BigInt(r.decimals))}</div>
                      </td>
                      <td className="tnum px-3 py-4 font-mono text-[14px] text-good">{fmtPct(r.supplyRateBps)}</td>
                      <td className="tnum px-3 py-4 font-mono text-[14px]">
                        {fmtToken(r.totalBorrow, r.decimals)}
                        <div className="text-[12px] text-muted">{fmtUsd8((r.totalBorrow * r.priceUsd8) / 10n ** BigInt(r.decimals))}</div>
                      </td>
                      <td className="tnum px-3 py-4 font-mono text-[14px]">{fmtPct(r.borrowRateBps)}</td>
                      <td className="tnum px-3 py-4 font-mono text-[14px]">{fmtPct(r.utilizationBps)}</td>
                      <td className="px-5 py-4">
                        <Pill>{fmtPct(r.ltvBps)}</Pill>
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-3 py-4 text-muted">
                      {isLoading ? 'Loading market data...' : 'Market data unavailable'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 max-w-[70ch] text-[15px] text-muted">
        Testnet note: asset prices (including cirBTC) are fixed owner-set reference prices, not a live oracle feed, and do not follow the market. Do not treat this deployment as production lending.
      </p>
    </>
  )
}
