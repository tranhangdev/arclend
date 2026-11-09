import { formatUnits, maxUint256 } from 'viem'

const nf = (min: number, max: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max })

export function fmtToken(raw: bigint, decimals: number, requestedDp = 2): string {
  // Small-unit assets such as BTC need more precision to be readable.
  const maxDp = decimals > 6 ? Math.max(requestedDp, 6) : requestedDp
  const n = Number(formatUnits(raw, decimals))
  if (n > 0 && n < 10 ** -maxDp) return `<${(10 ** -maxDp).toFixed(maxDp)}`
  return nf(0, maxDp).format(n)
}

export function fmtUsd8(raw: bigint): string {
  const n = Number(formatUnits(raw, 8))
  return `$${nf(2, 2).format(n)}`
}

export function fmtPct(bps: bigint): string {
  return `${nf(2, 2).format(Number(bps) / 100)}%`
}

export function fmtHealth(wad: bigint): string {
  if (wad >= maxUint256 / 2n) return '∞'
  return nf(2, 2).format(Number(formatUnits(wad, 18)))
}

export function healthTone(wad: bigint): string {
  if (wad >= maxUint256 / 2n) return 'text-good'
  const n = Number(formatUnits(wad, 18))
  if (n < 1.1) return 'text-bad'
  if (n < 1.5) return 'text-[#e6c36a]'
  return 'text-good'
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function timeAgo(tsSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - tsSeconds)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function parseOnchainError(error: unknown): string {
  const e = error as { message?: string; shortMessage?: string; code?: number } | undefined
  const msg = (e?.shortMessage ?? e?.message ?? '').toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied') || e?.code === 4001) return 'Transaction cancelled.'
  if (msg.includes('not been authorized') || msg.includes('unauthorized') || e?.code === 4100)
    return 'Your wallet has not authorized this app. Reconnect your wallet and try again.'
  if (msg.includes('insufficientliquidity')) return 'Not enough liquidity in the pool for this amount.'
  if (msg.includes('insufficientcollateral') || msg.includes('healthfactor') || msg.includes('unhealthy'))
    return 'This would put your position below a safe health factor.'
  if (msg.includes('insufficient funds')) return 'Not enough USDC to cover gas.'
  if (msg.includes('exceeds balance') || msg.includes('transfer amount')) return 'Insufficient token balance.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check the amount and try again.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network issue. Please retry.'
  const detail = (e?.shortMessage ?? e?.message ?? '').split('\n')[0].slice(0, 140)
  return detail ? `Transaction failed: ${detail}` : 'Something went wrong. Please try again.'
}
