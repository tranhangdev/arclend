import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ActionDialog } from '@/components/ActionDialog'
import { Card, ConnectGate, GhostButton, PageTitle, Pill, SolidButton, Stat, TokenIcon } from '@/components/ui'
import { useReserves, useUserData } from '@/hooks/usePool'
import type { PoolAction } from '@/hooks/useTxFlow'
import { CHAIN_ID, POOL_ADDRESS, TOKENS } from '@/lib/pool'
import { fmtHealth, fmtPct, fmtToken, fmtUsd8, healthTone } from '@/lib/format'
import { arcLendAbi } from '@/contracts/arclendAbi'
import { useWriteContract } from 'wagmi'
import { toast } from 'sonner'

type Mode = 'deposit' | 'borrow'

export default function Assets({ mode }: { mode: Mode }) {
  const { isConnected } = useAccount()
  const { reserves, refetch: refetchReserves } = useReserves()
  const { positions, account, refetch: refetchUser } = useUserData()
  const [dialog, setDialog] = useState<{ action: PoolAction; symbol: string }>()
  const { writeContractAsync, isPending: toggling } = useWriteContract()

  const refresh = () => {
    void refetchReserves()
    void refetchUser()
  }

  const toggleCollateral = async (token: `0x${string}`, enabled: boolean) => {
    try {
      await writeContractAsync({ address: POOL_ADDRESS, abi: arcLendAbi, functionName: 'setCollateral', args: [token, enabled], chainId: CHAIN_ID })
      toast.success(`Collateral ${enabled ? 'enabled' : 'disabled'}`)
      setTimeout(refresh, 2500)
    } catch {
      toast.error('Could not update collateral')
    }
  }

  const isDeposit = mode === 'deposit'

  return (
    <>
      <PageTitle sub={isDeposit ? 'Supply stablecoins to earn interest and use them as collateral.' : 'Borrow against your supplied collateral. Keep your health factor above 1.'}>
        {isDeposit ? 'Deposit' : 'Borrow'}
      </PageTitle>

      {!isConnected ? (
        <ConnectGate body={isDeposit ? 'Connect your wallet to deposit USDC or EURC.' : 'Connect your wallet to borrow against your collateral.'} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {isDeposit ? (
              <>
                <Stat label="Your collateral" value={fmtUsd8(account?.totalCollateralUsd8 ?? 0n)} />
                <Stat label="Your debt" value={fmtUsd8(account?.totalDebtUsd8 ?? 0n)} />
                <Stat label="Health factor" value={fmtHealth(account?.healthFactorWad ?? 2n ** 255n)} tone={healthTone(account?.healthFactorWad ?? 2n ** 255n)} />
              </>
            ) : (
              <>
                <Stat label="Borrow capacity" value={fmtUsd8(account?.borrowCapacityUsd8 ?? 0n)} hint="Left to borrow at max LTV" />
                <Stat label="Your debt" value={fmtUsd8(account?.totalDebtUsd8 ?? 0n)} />
                <Stat label="Health factor" value={fmtHealth(account?.healthFactorWad ?? 2n ** 255n)} tone={healthTone(account?.healthFactorWad ?? 2n ** 255n)} />
              </>
            )}
          </div>

          <div className="grid gap-3">
            {TOKENS.map((t) => {
              const r = reserves[t.symbol]
              const p = positions[t.symbol]
              if (!r || !p) return null
              return (
                <Card key={t.symbol} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={t.symbol} size={40} />
                      <div>
                        <div className="font-serif text-[22px] font-semibold leading-tight">{t.symbol}</div>
                        <div className="text-[14px] text-muted">{t.name}</div>
                      </div>
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 font-mono text-[13px] sm:grid-cols-4 md:max-w-[640px]">
                      {isDeposit ? (
                        <>
                          <Metric k="Wallet" v={fmtToken(p.walletBalance, r.decimals)} />
                          <Metric k="Supplied" v={fmtToken(p.supplied, r.decimals, 4)} />
                          <Metric k="Supply APR" v={fmtPct(r.supplyRateBps)} tone="text-good" />
                          <div>
                            <div className="text-muted">Collateral</div>
                            <label className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 accent-[#f3ede2]"
                                checked={p.collateralEnabled}
                                disabled={toggling || p.supplied === 0n}
                                onChange={(e) => void toggleCollateral(t.address, e.target.checked)}
                              />
                              <span>{p.collateralEnabled ? 'On' : 'Off'}</span>
                            </label>
                          </div>
                        </>
                      ) : (
                        <>
                          <Metric k="Available" v={fmtToken(r.availableLiquidity, r.decimals)} />
                          <Metric k="Your debt" v={fmtToken(p.borrowed, r.decimals, 4)} />
                          <Metric k="Borrow APR" v={fmtPct(r.borrowRateBps)} />
                          <Metric k="Utilization" v={fmtPct(r.utilizationBps)} />
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {isDeposit ? (
                        <>
                          <SolidButton onClick={() => setDialog({ action: 'supply', symbol: t.symbol })} disabled={r.frozen || !r.active}>
                            Supply
                          </SolidButton>
                          <GhostButton onClick={() => setDialog({ action: 'withdraw', symbol: t.symbol })} disabled={p.supplied === 0n}>
                            Withdraw
                          </GhostButton>
                        </>
                      ) : (
                        <>
                          <SolidButton onClick={() => setDialog({ action: 'borrow', symbol: t.symbol })} disabled={r.frozen || !r.active}>
                            Borrow
                          </SolidButton>
                          <GhostButton onClick={() => setDialog({ action: 'repay', symbol: t.symbol })} disabled={p.borrowed === 0n}>
                            Repay
                          </GhostButton>
                        </>
                      )}
                    </div>
                  </div>
                  {r.frozen && (
                    <div className="mt-3">
                      <Pill tone="bad">Frozen</Pill>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {Object.values(positions).every((p) => p.walletBalance === 0n) && (
            <p className="mt-5 text-[15px] text-muted">
              Your wallet holds no USDC or EURC yet. Use Get test USDC in the Arc Studio sidebar, or the{' '}
              <a className="underline underline-offset-4" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                Circle faucet
              </a>{' '}
              for EURC.
            </p>
          )}
        </>
      )}

      {dialog && reserves[dialog.symbol] && positions[dialog.symbol] && (
        <ActionDialog
          action={dialog.action}
          symbol={dialog.symbol}
          reserve={reserves[dialog.symbol]}
          position={positions[dialog.symbol]}
          account={account}
          onClose={() => setDialog(undefined)}
          onDone={refresh}
        />
      )}
    </>
  )
}

function Metric({ k, v, tone = '' }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="text-muted">{k}</div>
      <div className={`tnum mt-1 text-[14px] ${tone}`}>{v}</div>
    </div>
  )
}
