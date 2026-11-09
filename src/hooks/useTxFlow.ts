import { useCallback, useState } from 'react'
import { erc20Abi, type Address, type Hash } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { arcLendAbi } from '@/contracts/arclendAbi'
import { CHAIN_ID, POOL_ADDRESS } from '@/lib/pool'
import { parseOnchainError } from '@/lib/format'

export type TxStatus = 'idle' | 'approving' | 'wallet' | 'confirming' | 'success' | 'error'

export type PoolAction = 'supply' | 'withdraw' | 'borrow' | 'repay'

interface RunArgs {
  action: PoolAction
  token: Address
  amount: bigint
  /** Allowance needed for supply and repay. */
  allowance?: bigint
  /** Amount to approve, when an approval is needed. */
  approveAmount?: bigint
}

export function useTxFlow(onDone?: () => void) {
  const { chainId, address: owner } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const [status, setStatus] = useState<TxStatus>('idle')
  const [error, setError] = useState<string>()
  const [hash, setHash] = useState<Hash>()

  const reset = useCallback(() => {
    setStatus('idle')
    setError(undefined)
    setHash(undefined)
  }, [])

  const run = useCallback(
    async ({ action, token, amount, allowance, approveAmount }: RunArgs) => {
      if (!publicClient) return
      setError(undefined)
      setHash(undefined)
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID })

        const needsApproval = (action === 'supply' || action === 'repay') && (allowance ?? 0n) < (approveAmount ?? amount)
        if (needsApproval) {
          setStatus('approving')
          const approveHash = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: 'approve',
            args: [POOL_ADDRESS, approveAmount ?? amount],
            account: owner,
            chainId: CHAIN_ID,
          })
          const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })
          if (approveReceipt.status !== 'success') throw new Error('Approval reverted')
          // RPC nodes can lag a block behind the receipt, which makes the next call's gas estimate fail.
          // Wait until the new allowance is visible before sending the pool transaction.
          const needed = approveAmount ?? amount
          let visible = false
          for (let i = 0; i < 40 && !visible; i++) {
            const current = await publicClient.readContract({
              address: token,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [owner!, POOL_ADDRESS],
            })
            visible = current >= needed
            if (!visible) await new Promise((r) => setTimeout(r, 500))
          }
          if (!visible) throw new Error('Approval is not visible onchain yet. Please try again.')
        }

        setStatus('wallet')
        const txHash = await writeContractAsync({
          address: POOL_ADDRESS,
          abi: arcLendAbi,
          functionName: action,
          args: [token, amount],
          account: owner,
          chainId: CHAIN_ID,
        })
        setHash(txHash)
        setStatus('confirming')
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
        setStatus('success')
        onDone?.()
      } catch (e) {
        console.error('Pool transaction failed', e)
        const message = parseOnchainError(e)
        if (message === 'Transaction cancelled.') {
          setStatus('idle')
          return
        }
        setError(message)
        setStatus('error')
      }
    },
    [chainId, onDone, owner, publicClient, switchChainAsync, writeContractAsync],
  )

  return { status, error, hash, run, reset }
}
