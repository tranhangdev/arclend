import type { Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const CHAIN_ID = arcTestnet.id

export const POOL_ADDRESS = import.meta.env.VITE_ARCLEND_ADDRESS as Address

function parseBlock(value: string | undefined): bigint {
  return value && /^\d+$/.test(value) ? BigInt(value) : 0n
}
export const DEPLOY_BLOCK = parseBlock(import.meta.env.VITE_ARCLEND_DEPLOY_BLOCK)

/** Names of required public settings that are missing, so the app can explain itself instead of showing a blank page. */
export const MISSING_CONFIG = (
  [
    ['VITE_ARCLEND_ADDRESS', import.meta.env.VITE_ARCLEND_ADDRESS],
    ['VITE_ARCLEND_DEPLOY_BLOCK', import.meta.env.VITE_ARCLEND_DEPLOY_BLOCK],
    ['VITE_EURC_ADDRESS', import.meta.env.VITE_EURC_ADDRESS],
    ['VITE_CIRBTC_ADDRESS', import.meta.env.VITE_CIRBTC_ADDRESS],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([name]) => name)

const usdc = getUsdc(CHAIN_ID)
if (!usdc) throw new Error('USDC is not registered for Arc Testnet')

export interface PoolToken {
  symbol: 'USDC' | 'EURC' | 'cirBTC'
  name: string
  address: Address
  decimals: number
}

export const TOKENS: PoolToken[] = [
  { symbol: 'USDC', name: 'USD Coin', address: usdc.address as Address, decimals: usdc.decimals },
  { symbol: 'EURC', name: 'Euro Coin', address: import.meta.env.VITE_EURC_ADDRESS as Address, decimals: 6 },
  { symbol: 'cirBTC', name: 'Circle Bitcoin', address: import.meta.env.VITE_CIRBTC_ADDRESS as Address, decimals: 8 },
]

export function tokenByAddress(address: string): PoolToken | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
}

export interface Reserve {
  token: Address
  decimals: number
  ltvBps: bigint
  liquidationThresholdBps: bigint
  liquidationBonusBps: bigint
  priceUsd8: bigint
  totalSupply: bigint
  totalBorrow: bigint
  availableLiquidity: bigint
  supplyCap: bigint
  borrowCap: bigint
  supplyRateBps: bigint
  borrowRateBps: bigint
  utilizationBps: bigint
  frozen: boolean
  active: boolean
}

export interface UserPosition {
  supplied: bigint
  borrowed: bigint
  collateralEnabled: boolean
  walletBalance: bigint
  allowance: bigint
}

export interface UserAccount {
  totalCollateralUsd8: bigint
  totalDebtUsd8: bigint
  borrowCapacityUsd8: bigint
  healthFactorWad: bigint
}
