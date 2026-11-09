import { useQuery } from '@tanstack/react-query'
import { parseAbiItem, type Address, type Hash } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { CHAIN_ID, DEPLOY_BLOCK, POOL_ADDRESS } from '@/lib/pool'

export type HistoryKind = 'Supply' | 'Withdraw' | 'Borrow' | 'Repay' | 'Liquidated' | 'Liquidation' | 'Collateral on' | 'Collateral off'

export interface HistoryItem {
  kind: HistoryKind
  token: Address
  amount?: bigint
  hash: Hash
  blockNumber: bigint
  logIndex: number
  timestamp?: number
}

const supplyEvt = parseAbiItem('event Supply(address indexed user, address indexed token, uint256 amount)')
const withdrawEvt = parseAbiItem('event Withdraw(address indexed user, address indexed token, uint256 amount)')
const borrowEvt = parseAbiItem('event Borrow(address indexed user, address indexed token, uint256 amount)')
const repayEvt = parseAbiItem('event Repay(address indexed user, address indexed token, uint256 amount)')
const toggleEvt = parseAbiItem('event CollateralToggled(address indexed user, address indexed token, bool enabled)')
const liqEvt = parseAbiItem(
  'event Liquidation(address indexed liquidator, address indexed user, address indexed collateralToken, address debtToken, uint256 debtCovered, uint256 collateralSeized)',
)

const CHUNK = 50_000n

export function useHistory() {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })

  return useQuery({
    queryKey: ['history', address],
    enabled: Boolean(address && client),
    refetchInterval: 60_000,
    retry: 3,
    retryDelay: 1500,
    queryFn: async (): Promise<HistoryItem[]> => {
      if (!address || !client) return []
      const head = await client.getBlockNumber()

      // Scan from the pool's deployment block (never block 0), in bounded ranges.
      async function scan<T>(fetchRange: (from: bigint, to: bigint) => Promise<T[]>): Promise<T[]> {
        const out: T[] = []
        for (let from = DEPLOY_BLOCK; from <= head; from += CHUNK) {
          const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n
          out.push(...(await fetchRange(from, to)))
        }
        return out
      }

      const base = { address: POOL_ADDRESS }
      // Sequential on purpose: the public RPC rate-limits bursts of parallel log queries.
      const supplies = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: supplyEvt, args: { user: address }, fromBlock, toBlock }))
      const withdraws = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: withdrawEvt, args: { user: address }, fromBlock, toBlock }))
      const borrows = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: borrowEvt, args: { user: address }, fromBlock, toBlock }))
      const repays = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: repayEvt, args: { user: address }, fromBlock, toBlock }))
      const toggles = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: toggleEvt, args: { user: address }, fromBlock, toBlock }))
      const liqsAsLiquidator = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: liqEvt, args: { liquidator: address }, fromBlock, toBlock }))
      const liqsAsBorrower = await scan((fromBlock, toBlock) => client.getLogs({ ...base, event: liqEvt, args: { user: address }, fromBlock, toBlock }))

      const items: HistoryItem[] = []
      const push = (kind: HistoryKind, token: Address, log: { transactionHash: Hash; blockNumber: bigint; logIndex: number }, amount?: bigint) =>
        items.push({ kind, token, amount, hash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex })

      supplies.forEach((l) => push('Supply', l.args.token!, l, l.args.amount))
      withdraws.forEach((l) => push('Withdraw', l.args.token!, l, l.args.amount))
      borrows.forEach((l) => push('Borrow', l.args.token!, l, l.args.amount))
      repays.forEach((l) => push('Repay', l.args.token!, l, l.args.amount))
      toggles.forEach((l) => push(l.args.enabled ? 'Collateral on' : 'Collateral off', l.args.token!, l))
      liqsAsLiquidator.forEach((l) => push('Liquidation', l.args.debtToken!, l, l.args.debtCovered))
      liqsAsBorrower.forEach((l) => push('Liquidated', l.args.collateralToken!, l, l.args.collateralSeized))

      items.sort((a, b) => (a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1))
      const recent = items.slice(0, 100)

      // Timestamps for display, one lookup per distinct block.
      const blocks = [...new Set(recent.map((i) => i.blockNumber))]
      const stamps = new Map<bigint, number>()
      await Promise.all(
        blocks.map(async (blockNumber) => {
          const b = await client.getBlock({ blockNumber })
          stamps.set(blockNumber, Number(b.timestamp))
        }),
      )
      return recent.map((i) => ({ ...i, timestamp: stamps.get(i.blockNumber) }))
    },
  })
}
