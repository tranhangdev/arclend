import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, ExternalLink } from 'lucide-react'
import { erc20Abi, formatUnits, type EIP1193Provider } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import type { SwapEstimate, SwapResult } from '@circle-fin/app-kit'
import { Card, ConnectGate, PageTitle, TokenIcon } from '@/components/ui'
import { adapterForChain, appKit, errorMessage } from '@/lib/appkit'
import { CHAIN_ID, TOKENS } from '@/lib/pool'
import { usdcDecimalsFor } from '@/onchain-money'
import { fmtToken } from '@/lib/format'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { arcTestnet } from 'viem/chains'

type Symbol = 'USDC' | 'EURC'
const SLIPPAGE_BPS = 100
const DEC = usdcDecimalsFor(CHAIN_ID)

export default function Swap() {
  const { isConnected, address, connector } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const [tokenIn, setTokenIn] = useState<Symbol>('USDC')
  const tokenOut: Symbol = tokenIn === 'USDC' ? 'EURC' : 'USDC'
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<{ est: SwapEstimate; amount: string; tokenIn: Symbol; account?: string }>()
  const [busy, setBusy] = useState<'quote' | 'swap'>()
  const [error, setError] = useState<string>()
  const [result, setResult] = useState<SwapResult>()

  const balances = useQuery({
    queryKey: ['swap-balances', address],
    enabled: Boolean(address && client),
    refetchInterval: 15_000,
    queryFn: async () => {
      const out: Record<string, bigint> = {}
      for (const t of TOKENS.filter((x) => x.symbol !== 'cirBTC')) {
        out[t.symbol] = await client!.readContract({ address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [address!] })
      }
      return out
    },
  })

  // A quote is only valid for the exact inputs it was made with.
  const estimate = quote && quote.amount === amount && quote.tokenIn === tokenIn && quote.account === address ? quote : undefined

  const balanceIn = balances.data?.[tokenIn] ?? 0n
  const validAmount = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0
  const overBalance = validAmount && Number(amount) > Number(formatUnits(balanceIn, DEC))

  const getAdapter = async () => {
    if (!connector) throw new Error('Wallet not connected')
    const provider = (await connector.getProvider()) as EIP1193Provider
    return adapterForChain(provider, arcTestnet, [arcTestnet])
  }

  const review = async () => {
    setError(undefined)
    setResult(undefined)
    setBusy('quote')
    try {
      const adapter = await getAdapter()
      const est = await appKit.estimateSwap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn,
        tokenOut,
        amountIn: amount,
        config: { slippageBps: SLIPPAGE_BPS },
      })
      setQuote({ est, amount, tokenIn, account: address })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(undefined)
    }
  }

  const swap = async () => {
    if (!estimate || estimate.account !== address) return
    setError(undefined)
    setBusy('swap')
    try {
      const adapter = await getAdapter()
      const res = await appKit.swap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn: estimate.tokenIn,
        tokenOut: estimate.tokenIn === 'USDC' ? 'EURC' : 'USDC',
        amountIn: estimate.amount,
        config: { slippageBps: SLIPPAGE_BPS },
      })
      setResult(res)
      setQuote(undefined)
      setAmount('')
      void balances.refetch()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <>
      <PageTitle sub="Swap between USDC and EURC on Arc Testnet.">Swap</PageTitle>
      {!isConnected ? (
        <ConnectGate body="Connect your wallet to swap USDC and EURC." />
      ) : (
        <Card className="mx-auto max-w-[520px] p-5">
          <Panel label="You pay" symbol={tokenIn} balance={balanceIn}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              disabled={Boolean(busy)}
              className="tnum min-w-0 flex-1 bg-transparent font-serif text-[34px] font-semibold text-cream placeholder:text-muted/50 focus:outline-none"
            />
            <button
              className="rounded px-2 py-1 font-mono text-[12px] text-cream hover:bg-line"
              onClick={() => setAmount(formatUnits(balanceIn, DEC))}
              disabled={Boolean(busy) || balanceIn === 0n}
            >
              MAX
            </button>
          </Panel>

          <div className="relative z-10 -my-3 grid place-items-center">
            <button
              onClick={() => setTokenIn(tokenOut)}
              disabled={Boolean(busy)}
              className="grid size-11 place-items-center rounded-xl border border-line bg-panel text-cream transition hover:bg-raised"
              aria-label="Flip pair"
            >
              <ArrowDownUp size={18} />
            </button>
          </div>

          <Panel label="You receive (estimate)" symbol={tokenOut} balance={balances.data?.[tokenOut] ?? 0n}>
            <div className="tnum min-w-0 flex-1 font-serif text-[34px] font-semibold text-cream">
              {estimate ? estimate.est.estimatedOutput.amount : <span className="text-muted/50">0.00</span>}
            </div>
          </Panel>

          {estimate && (
            <dl className="mt-4 space-y-2 font-mono text-[13px]">
              <Row k="Minimum received" v={estimate.est.stopLimit ? `${estimate.est.stopLimit.amount} ${estimate.est.stopLimit.token}` : `Slippage ${SLIPPAGE_BPS / 100}%`} />
              {(estimate.est.fees ?? []).map((f, i) => (
                <Row key={i} k={`${f.type} fee`} v={f.amount ? `${f.amount} ${f.token}` : 'n/a'} />
              ))}
            </dl>
          )}

          {error && <p className="mt-4 rounded-lg border border-bad/30 bg-bad/10 p-3 text-[15px] text-bad">{error}</p>}

          {result && (
            <div className="mt-4 rounded-lg border border-good/30 bg-good/10 p-3 text-[15px]">
              <p className="text-good">Swap submitted{result.amountOut ? `, received ${result.amountOut} ${result.tokenOut}` : ''}.</p>
              {result.txHash && (
                <a
                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] underline underline-offset-4"
                  href={buildTxExplorerUrl(CHAIN_ID, result.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on explorer <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {estimate ? (
            <button
              onClick={() => void swap()}
              disabled={busy === 'swap'}
              className="mt-5 min-h-12 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink transition hover:bg-white disabled:opacity-50"
            >
              {busy === 'swap' ? 'Confirm in wallet...' : `Swap ${estimate.amount} ${estimate.tokenIn} to ${tokenOut}`}
            </button>
          ) : (
            <button
              onClick={() => void review()}
              disabled={!validAmount || overBalance || busy === 'quote'}
              className="mt-5 min-h-12 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'quote' ? 'Getting quote...' : !validAmount ? 'Enter an amount' : overBalance ? 'Insufficient balance' : 'Review quote'}
            </button>
          )}

          <p className="mt-4 text-[14px] text-muted">
            Swaps are routed through a swap service provider (a third-party aggregator or Circle) that may vary by route, and you are subject to its terms. Testnet only.
          </p>
        </Card>
      )}
    </>
  )
}

function Panel({ label, symbol, balance, children }: { label: string; symbol: Symbol; balance: bigint; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-raised/60 p-4">
      <div className="flex items-center justify-between font-mono text-[12px] text-muted">
        <span>{label}</span>
        <span className="tnum">Balance: {fmtToken(balance, DEC)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {children}
        <div className="flex shrink-0 items-center gap-2 font-mono text-[14px] font-semibold">
          <TokenIcon symbol={symbol} size={26} /> {symbol}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className="tnum">{v}</dd>
    </div>
  )
}
