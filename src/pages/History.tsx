import { useAccount } from 'wagmi'
import { ExternalLink } from 'lucide-react'
import { Card, ConnectGate, PageTitle, Pill, TokenIcon } from '@/components/ui'
import { useHistory } from '@/hooks/useHistory'
import { CHAIN_ID, tokenByAddress } from '@/lib/pool'
import { fmtToken, timeAgo } from '@/lib/format'
import { buildTxExplorerUrl } from '@/onchain-facts'

export default function History() {
  const { isConnected } = useAccount()
  const { data, isLoading, isError, refetch } = useHistory()

  return (
    <>
      <PageTitle>Transaction history</PageTitle>

      {!isConnected ? (
        <ConnectGate body="Connect your wallet to view your transaction history." />
      ) : isLoading ? (
        <Card className="px-6 py-16 text-center text-muted">Reading your activity from Arc Testnet...</Card>
      ) : isError ? (
        <Card className="px-6 py-16 text-center">
          <p className="text-bad">Could not load history from the network.</p>
          <button onClick={() => void refetch()} className="mt-4 min-h-11 rounded-lg bg-cream px-4 font-mono text-[14px] font-semibold text-ink">
            Retry
          </button>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <h2 className="font-serif text-[24px] font-semibold">No transactions yet</h2>
          <p className="mt-2 text-[17px] text-muted">Supply, borrow or repay and your activity shows up here.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
                <th className="px-5 py-4 font-medium">Action</th>
                <th className="px-3 py-4 font-medium">Asset</th>
                <th className="px-3 py-4 font-medium">Amount</th>
                <th className="px-3 py-4 font-medium">When</th>
                <th className="px-5 py-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const t = tokenByAddress(item.token)
                const decimals = t?.decimals ?? 6
                const tone = item.kind === 'Supply' || item.kind === 'Repay' || item.kind === 'Liquidation' ? 'good' : item.kind === 'Liquidated' ? 'bad' : 'muted'
                return (
                  <tr key={`${item.hash}-${item.logIndex}`} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4">
                      <Pill tone={tone}>{item.kind}</Pill>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2 font-mono text-[14px]">
                        <TokenIcon symbol={t?.symbol ?? 'USDC'} size={22} />
                        {t?.symbol ?? 'Token'}
                      </div>
                    </td>
                    <td className="tnum px-3 py-4 font-mono text-[14px]">{item.amount !== undefined ? fmtToken(item.amount, decimals, 4) : '-'}</td>
                    <td className="px-3 py-4 font-mono text-[13px] text-muted">{item.timestamp ? timeAgo(item.timestamp) : '-'}</td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={buildTxExplorerUrl(CHAIN_ID, item.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-grid size-9 place-items-center rounded-md text-muted hover:text-cream"
                        aria-label="View on explorer"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
