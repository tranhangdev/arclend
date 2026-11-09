import { useEffect, useMemo, useState } from 'react'
import { maxUint256, parseUnits } from 'viem'
import { useModal } from 'connectkit'
import { useDisconnect } from 'wagmi'
import { ExternalLink, X } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { useTxFlow, type PoolAction } from '@/hooks/useTxFlow'
import { CHAIN_ID, tokenByAddress, type Reserve, type UserAccount, type UserPosition } from '@/lib/pool'
import { fmtHealth, fmtPct, fmtToken, healthTone } from '@/lib/format'
import { TokenIcon } from '@/components/ui'

const TITLES: Record<PoolAction, string> = { supply: 'Supply', withdraw: 'Withdraw', borrow: 'Borrow', repay: 'Repay' }

interface Props {
  action: PoolAction
  symbol: string
  reserve: Reserve
  position: UserPosition
  account?: UserAccount
  onClose: () => void
  onDone: () => void
}

export function ActionDialog({ action, symbol, reserve, position, account, onClose, onDone }: Props) {
  const [value, setValue] = useState('')
  const { status, error, hash, run, reset } = useTxFlow(onDone)
  const token = tokenByAddress(reserve.token)
  const { disconnectAsync } = useDisconnect()
  const { setOpen } = useModal()
  const needsReconnect = Boolean(error?.includes('Reconnect your wallet'))

  const reconnect = async () => {
    await disconnectAsync()
    onClose()
    setOpen(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Largest amount the user can act on, in token units.
  const max = useMemo(() => {
    const priceScaled = reserve.priceUsd8 === 0n ? 1n : reserve.priceUsd8
    switch (action) {
      case 'supply':
        return position.walletBalance
      case 'withdraw': {
        const free = position.supplied < reserve.availableLiquidity ? position.supplied : reserve.availableLiquidity
        return free
      }
      case 'borrow': {
        const cap = account ? (account.borrowCapacityUsd8 * 10n ** BigInt(reserve.decimals)) / priceScaled : 0n
        const safe = (cap * 98n) / 100n
        return safe < reserve.availableLiquidity ? safe : reserve.availableLiquidity
      }
      case 'repay':
        return position.borrowed < position.walletBalance ? position.borrowed : position.walletBalance
    }
  }, [account, action, position, reserve])

  let amount = 0n
  let invalid = ''
  try {
    amount = value ? parseUnits(value, reserve.decimals) : 0n
  } catch {
    invalid = 'Enter a valid amount'
  }
  if (!invalid && amount > max) invalid = action === 'borrow' ? 'Exceeds what you can safely borrow' : 'Exceeds available balance'

  const busy = status === 'approving' || status === 'wallet' || status === 'confirming'
  const usingMax = (action === 'withdraw' || action === 'repay') && max > 0n && amount === max

  const submit = () => {
    if (amount === 0n || invalid) return
    // Max withdraw or repay sends the sentinel so no dust is left behind.
    const sent = usingMax && ((action === 'withdraw' && position.supplied <= reserve.availableLiquidity) || (action === 'repay' && position.borrowed <= position.walletBalance)) ? maxUint256 : amount
    void run({
      action,
      token: reserve.token,
      amount: sent,
      allowance: position.allowance,
      approveAmount: action === 'repay' ? amount + amount / 1000n + 1n : amount,
    })
  }

  const label =
    status === 'approving'
      ? 'Approve in wallet...'
      : status === 'wallet'
        ? 'Confirm in wallet...'
        : status === 'confirming'
          ? 'Confirming on Arc...'
          : amount === 0n
            ? 'Enter an amount'
            : invalid || `${TITLES[action]} ${symbol}`

  const apr = action === 'borrow' || action === 'repay' ? reserve.borrowRateBps : reserve.supplyRateBps

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${TITLES[action]} ${symbol}`}
        className="w-full max-w-[460px] rounded-t-3xl border border-line bg-panel p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[26px] font-semibold">
            {TITLES[action]} {symbol}
          </h2>
          <button onClick={onClose} className="grid size-11 place-items-center rounded-lg text-muted hover:text-cream" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {status === 'success' ? (
          <div className="py-8 text-center">
            <p className="font-serif text-[22px] font-semibold">Transaction confirmed</p>
            <p className="mt-1 text-muted">
              {TITLES[action]} of {fmtToken(amount === maxUint256 ? max : amount, reserve.decimals, 4)} {symbol} is onchain.
            </p>
            {hash && (
              <a
                className="mt-4 inline-flex items-center gap-1.5 font-mono text-[13px] text-cream underline underline-offset-4"
                href={buildTxExplorerUrl(CHAIN_ID, hash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on explorer <ExternalLink size={14} />
              </a>
            )}
            <button onClick={onClose} className="mt-6 block min-h-11 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-line bg-raised/60 p-4">
              <div className="flex items-center gap-3">
                <input
                  inputMode="decimal"
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value.replace(/[^0-9.]/g, ''))
                    if (status === 'error') reset()
                  }}
                  placeholder="0.00"
                  disabled={busy}
                  className="tnum min-w-0 flex-1 bg-transparent font-serif text-[34px] font-semibold text-cream placeholder:text-muted/50 focus:outline-none"
                />
                <div className="flex items-center gap-2 font-mono text-[14px] font-semibold">
                  <TokenIcon symbol={symbol} size={26} /> {symbol}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[12px] text-muted">
                <span className="tnum">
                  {action === 'supply' ? 'Wallet' : action === 'borrow' ? 'Available' : action === 'withdraw' ? 'Withdrawable' : 'Debt'}:{' '}
                  {fmtToken(action === 'repay' ? position.borrowed : max, reserve.decimals, 4)}
                </span>
                <button disabled={busy || max === 0n} onClick={() => setValue(formatMax(max, reserve.decimals))} className="rounded px-2 py-1 text-cream hover:bg-line disabled:opacity-40">
                  MAX
                </button>
              </div>
            </div>

            <dl className="mt-4 space-y-2 font-mono text-[13px]">
              <Row k={action === 'borrow' || action === 'repay' ? 'Borrow APR' : 'Supply APR'} v={fmtPct(apr)} />
              {account && (
                <Row k="Health factor" v={fmtHealth(account.healthFactorWad)} tone={healthTone(account.healthFactorWad)} />
              )}
              {(action === 'supply' || action === 'repay') && position.allowance < amount && amount > 0n && (
                <Row k="Approval" v={`Required for ${symbol}`} />
              )}
            </dl>

            {(error || status === 'error') && <p className="mt-4 rounded-lg border border-bad/30 bg-bad/10 p-3 text-[15px] text-bad">{error}</p>}
            {needsReconnect && (
              <button
                onClick={() => void reconnect()}
                className="mt-3 min-h-11 w-full rounded-lg border border-line font-mono text-[14px] font-semibold text-cream hover:bg-raised"
              >
                Reconnect wallet
              </button>
            )}
            {token && action === 'borrow' && max === 0n && (
              <p className="mt-4 text-[15px] text-muted">Supply collateral first to unlock borrowing.</p>
            )}

            <button
              onClick={submit}
              disabled={busy || amount === 0n || Boolean(invalid)}
              className="mt-5 min-h-12 w-full rounded-lg bg-cream font-mono text-[15px] font-semibold text-ink transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {label}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ k, v, tone = '' }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={`tnum ${tone}`}>{v}</dd>
    </div>
  )
}

function formatMax(raw: bigint, decimals: number): string {
  const s = raw.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, s.length - decimals)
  const frac = s.slice(s.length - decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}
