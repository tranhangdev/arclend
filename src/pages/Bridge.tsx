import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, ExternalLink } from 'lucide-react'
import { createPublicClient, erc20Abi, formatUnits, http, type Chain, type EIP1193Provider } from 'viem'
import { arbitrumSepolia, arcTestnet, baseSepolia, sepolia } from 'viem/chains'
import { useAccount } from 'wagmi'
import type { BridgeParams, BridgeResult } from '@circle-fin/app-kit'
import { Card, ConnectGate, PageTitle } from '@/components/ui'
import { TokenUSDC } from '@web3icons/react'
import { adapterForChain, appKit, errorMessage } from '@/lib/appkit'
import { fmtToken } from '@/lib/format'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { usdcDecimalsFor } from '@/onchain-money'

type ChainName = BridgeParams['from']['chain']

interface BridgeChain {
  key: string
  name: ChainName
  label: string
  chain: Chain
}

const CHAINS: BridgeChain[] = [
  { key: 'arc', name: 'Arc_Testnet', label: 'Arc Testnet', chain: arcTestnet },
  { key: 'base', name: 'Base_Sepolia', label: 'Base Sepolia', chain: baseSepolia },
  { key: 'eth', name: 'Ethereum_Sepolia', label: 'Ethereum Sepolia', chain: sepolia },
  { key: 'arb', name: 'Arbitrum_Sepolia', label: 'Arbitrum Sepolia', chain: arbitrumSepolia },
]
const ALL_CHAINS = CHAINS.map((c) => c.chain)

const STEP_LABELS: Record<string, string> = {
  'bridge.approve': 'Approved USDC',
  'bridge.burn': 'Burned on source chain',
  'bridge.fetchAttestation': 'Attestation received',
  'bridge.mint': 'Minted on destination',
}

export default function Bridge() {
  const { isConnected, address, connector } = useAccount()
  const [fromKey, setFromKey] = useState('arc')
  const [toKey, setToKey] = useState('base')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<'quote' | 'bridge'>()
  const [error, setError] = useState<string>()
  const [fee, setFee] = useState<{ label: string; value: string }[]>()
  const [reviewedKey, setReviewedKey] = useState<string>()
  const [steps, setSteps] = useState<string[]>([])
  const [result, setResult] = useState<BridgeResult>()

  const from = CHAINS.find((c) => c.key === fromKey)!
  const to = CHAINS.find((c) => c.key === toKey)!
  const usdc = getUsdc(from.chain.id)
  const decimals = usdcDecimalsFor(from.chain.id)

  const balance = useQuery({
    queryKey: ['bridge-balance', address, from.chain.id],
    enabled: Boolean(address && usdc),
    refetchInterval: 15_000,
    queryFn: async () => {
      const client = createPublicClient({ chain: from.chain, transport: http() })
      return client.readContract({ address: usdc!.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address!] })
    },
  })

  const inputKey = `${fromKey}|${toKey}|${amount}|${address}`
  const reviewed = reviewedKey === inputKey

  // Live step updates from the kit while a transfer is running.
  useEffect(() => {
    const handlers = Object.keys(STEP_LABELS).map((action) => {
      const handler = () => setSteps((s) => [...s, STEP_LABELS[action]])
      appKit.on(action as 'bridge.approve', handler)
      return [action, handler] as const
    })
    return () => handlers.forEach(([action, h]) => appKit.off(action as 'bridge.approve', h))
  }, [])

  const bal = balance.data ?? 0n
  const validAmount = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0
  const over = validAmount && Number(amount) > Number(formatUnits(bal, decimals))

  const flip = () => {
    setFromKey(toKey)
    setToKey(fromKey)
  }

  const onFrom = (key: string) => {
    setFromKey(key)
    if (key === toKey) setToKey(CHAINS.find((c) => c.key !== key)!.key)
  }
  const onTo = (key: string) => {
    setToKey(key)
    if (key === fromKey) setFromKey(CHAINS.find((c) => c.key !== key)!.key)
  }

  const getAdapter = async () => {
    if (!connector) throw new Error('Wallet not connected')
    const provider = (await connector.getProvider()) as EIP1193Provider
    return adapterForChain(provider, from.chain, ALL_CHAINS)
  }

  const review = async () => {
    setError(undefined)
    setResult(undefined)
    setBusy('quote')
    try {
      const adapter = await getAdapter()
      const est = await appKit.estimateBridge({
        from: { adapter, chain: from.name },
        to: { adapter, chain: to.name },
        amount,
      })
      const rows: { label: string; value: string }[] = []
      est.gasFees.forEach((g) => g.fees && rows.push({ label: `Gas on ${g.blockchain}`, value: `${g.fees.fee} ${g.token}` }))
      est.fees.forEach((f) => f.amount && rows.push({ label: `${f.type} fee`, value: `${f.amount} ${f.token}` }))
      setFee(rows)
      setReviewedKey(inputKey)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(undefined)
    }
  }

  const bridge = async () => {
    if (!reviewed) return
    setError(undefined)
    setSteps([])
    setBusy('bridge')
    try {
      const adapter = await getAdapter()
      const res = await appKit.bridge({
        from: { adapter, chain: from.name },
        to: { adapter, chain: to.name },
        amount,
      })
      setResult(res)
      if (res.state === 'error') {
        const failed = res.steps.find((s) => s.state === 'error')
        setError(`Bridge stopped at ${failed?.name ?? 'a step'}. Funds already burned are safe; retry from the same transfer.`)
      } else {
        setAmount('')
      }
      void balance.refetch()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <>
      <PageTitle sub="Move USDC between Arc Testnet and other testnets with Circle CCTP.">Bridge</PageTitle>
      {!isConnected ? (
        <ConnectGate body="Connect your wallet to bridge USDC." />
      ) : (
        <Card className="mx-auto max-w-[520px] p-5">
          <div className="rounded-xl border border-line bg-raised/60 p-4">
            <div className="flex items-center justify-between font-mono text-[12px] text-muted">
              <span>From</span>
              <span className="tnum">Balance: {fmtToken(bal, decimals)} USDC</span>
            </div>
            <ChainSelect value={fromKey} onChange={onFrom} disabled={Boolean(busy)} />
            <div className="mt-3 flex items-center gap-3">
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
                onClick={() => setAmount(formatUnits(bal, decimals))}
                disabled={Boolean(busy) || bal === 0n}
              >
                MAX
              </button>
              <div className="flex items-center gap-2 font-mono text-[14px] font-semibold">
                <TokenUSDC variant="branded" size={26} /> USDC
              </div>
            </div>
          </div>

          <div className="relative z-10 -my-3 grid place-items-center">
            <button
              onClick={flip}
              disabled={Boolean(busy)}
              className="grid size-11 place-items-center rounded-xl border border-line bg-panel text-cream transition hover:bg-raised"
              aria-label="Swap direction"
            >
              <ArrowDownUp size={18} />
            </button>
          </div>

          <div className="rounded-xl border border-line bg-raised/60 p-4">
            <div className="font-mono text-[12px] text-muted">To</div>
            <ChainSelect value={toKey} onChange={onTo} disabled={Boolean(busy)} />
            <div className="mt-3 font-mono text-[12px] text-muted">Recipient: your connected wallet</div>
          </div>

          {reviewed && fee && fee.length > 0 && (
            <dl className="mt-4 space-y-2 font-mono text-[13px]">
              {fee.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="tnum">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {busy === 'bridge' && (
            <ul className="mt-4 space-y-1 font-mono text-[13px] text-muted">
              {steps.map((s, i) => (
                <li key={i} className="text-good">
                  {s}
                </li>
              ))}
              <li>Waiting for the next step. Keep this tab open and confirm any wallet prompts.</li>
            </ul>
          )}

          {error && <p className="mt-4 rounded-lg border border-bad/30 bg-bad/10 p-3 text-[15px] text-bad">{error}</p>}

          {result && result.state === 'success' && (
            <div className="mt-4 rounded-lg border border-good/30 bg-good/10 p-3 text-[15px]">
              <p className="text-good">Bridge complete.</p>
              <ul className="mt-1 space-y-1">
                {result.steps
                  .filter((s) => s.txHash)
                  .map((s) => (
                    <li key={s.name} className="font-mono text-[13px]">
                      <a
                        className="inline-flex items-center gap-1.5 underline underline-offset-4"
                        href={s.explorerUrl ?? buildTxExplorerUrl(from.chain.id, s.txHash!)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.name} <ExternalLink size={12} />
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {reviewed ? (
            <button
              onClick={() => void bridge()}
              disabled={busy === 'bridge'}
              className="mt-5 min-h-12 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink transition hover:bg-white disabled:opacity-50"
            >
              {busy === 'bridge' ? 'Bridging...' : `Bridge ${amount} USDC to ${to.label}`}
            </button>
          ) : (
            <button
              onClick={() => void review()}
              disabled={!validAmount || over || busy === 'quote'}
              className="mt-5 min-h-12 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'quote' ? 'Estimating fees...' : !validAmount ? 'Enter an amount' : over ? 'Insufficient balance' : 'Review transfer'}
            </button>
          )}

          <p className="mt-4 text-[14px] text-muted">
            Bridging burns USDC on the source chain and mints it on the destination. Your wallet switches networks and asks for approvals. Testnet only.
          </p>
        </Card>
      )}
    </>
  )
}

function ChainSelect({ value, onChange, disabled }: { value: string; onChange: (key: string) => void; disabled: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="mt-2 min-h-11 w-full rounded-lg border border-line bg-panel px-3 font-mono text-[14px] text-cream focus:outline-none"
    >
      {CHAINS.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  )
}
