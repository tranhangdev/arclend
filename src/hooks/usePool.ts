import { useMemo } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { arcLendAbi } from '@/contracts/arclendAbi'
import { CHAIN_ID, POOL_ADDRESS, TOKENS, type Reserve, type UserAccount, type UserPosition } from '@/lib/pool'

const REFRESH_MS = 12_000

export function useReserves() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: TOKENS.map((t) => ({
      address: POOL_ADDRESS,
      abi: arcLendAbi,
      functionName: 'getReserveData' as const,
      args: [t.address] as const,
      chainId: CHAIN_ID,
    })),
    query: { refetchInterval: REFRESH_MS },
  })

  const reserves = useMemo(() => {
    const out: Record<string, Reserve> = {}
    data?.forEach((res, i) => {
      if (res.status === 'success') {
        const r = res.result
        out[TOKENS[i].symbol] = {
          token: r.token,
          decimals: r.decimals,
          ltvBps: r.ltvBps,
          liquidationThresholdBps: r.liquidationThresholdBps,
          liquidationBonusBps: r.liquidationBonusBps,
          priceUsd8: r.priceUsd8,
          totalSupply: r.totalSupply,
          totalBorrow: r.totalBorrow,
          availableLiquidity: r.availableLiquidity,
          supplyCap: r.supplyCap,
          borrowCap: r.borrowCap,
          supplyRateBps: r.supplyRateBps,
          borrowRateBps: r.borrowRateBps,
          utilizationBps: r.utilizationBps,
          frozen: r.frozen,
          active: r.active,
        }
      }
    })
    return out
  }, [data])

  return { reserves, isLoading, refetch }
}

export function useUserData() {
  const { address } = useAccount()
  const enabled = Boolean(address)

  const calls = useMemo(() => {
    if (!address) return []
    const perToken = TOKENS.flatMap((t) => [
      { address: POOL_ADDRESS, abi: arcLendAbi, functionName: 'getUserReserveData' as const, args: [t.address, address] as const, chainId: CHAIN_ID },
      { address: t.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address] as const, chainId: CHAIN_ID },
      { address: t.address, abi: erc20Abi, functionName: 'allowance' as const, args: [address, POOL_ADDRESS] as const, chainId: CHAIN_ID },
    ])
    return [
      ...perToken,
      { address: POOL_ADDRESS, abi: arcLendAbi, functionName: 'getUserAccount' as const, args: [address] as const, chainId: CHAIN_ID },
    ]
  }, [address])

  const { data, isLoading, refetch } = useReadContracts({
    contracts: calls,
    query: { enabled, refetchInterval: REFRESH_MS },
  })

  const { positions, account } = useMemo(() => {
    const positions: Record<string, UserPosition> = {}
    let account: UserAccount | undefined
    if (!data) return { positions, account }
    TOKENS.forEach((t, i) => {
      const reserveData = data[i * 3]
      const balance = data[i * 3 + 1]
      const allowance = data[i * 3 + 2]
      positions[t.symbol] = {
        supplied: reserveData?.status === 'success' ? (reserveData.result as readonly [bigint, bigint, boolean])[0] : 0n,
        borrowed: reserveData?.status === 'success' ? (reserveData.result as readonly [bigint, bigint, boolean])[1] : 0n,
        collateralEnabled: reserveData?.status === 'success' ? (reserveData.result as readonly [bigint, bigint, boolean])[2] : false,
        walletBalance: balance?.status === 'success' ? (balance.result as bigint) : 0n,
        allowance: allowance?.status === 'success' ? (allowance.result as bigint) : 0n,
      }
    })
    const acc = data[TOKENS.length * 3]
    if (acc?.status === 'success') {
      const [totalCollateralUsd8, totalDebtUsd8, borrowCapacityUsd8, healthFactorWad] = acc.result as readonly [bigint, bigint, bigint, bigint]
      account = { totalCollateralUsd8, totalDebtUsd8, borrowCapacityUsd8, healthFactorWad }
    }
    return { positions, account }
  }, [data])

  return { positions, account, isLoading: enabled && isLoading, refetch }
}
