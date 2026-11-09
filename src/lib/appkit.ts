import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import { numberToHex, type Chain, type EIP1193Provider } from 'viem'

export const appKit = new AppKit()

const isUnrecognizedChain = (error: unknown) => {
  const e = error as { code?: number; data?: { originalError?: { code?: number } } }
  return e?.code === 4902 || e?.data?.originalError?.code === 4902
}

/** Wraps a wallet provider so a chain the wallet lacks is added, then the switch is retried. */
export function withAddChainFallback(provider: EIP1193Provider, chains: readonly Chain[]): EIP1193Provider {
  const send = provider.request.bind(provider) as (args: { method: string; params?: unknown }) => Promise<unknown>
  const request = (async (args: { method: string; params?: unknown }) => {
    try {
      return await send(args)
    } catch (error) {
      if (args.method !== 'wallet_switchEthereumChain' || !isUnrecognizedChain(error)) throw error
      const [{ chainId }] = args.params as [{ chainId: string }]
      const chain = chains.find((c) => c.id === Number(chainId))
      if (!chain) throw error
      await send({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: numberToHex(chain.id),
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [...chain.rpcUrls.default.http],
            blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
          },
        ],
      })
      return send(args)
    }
  }) as EIP1193Provider['request']

  return new Proxy(provider, {
    get(target, prop) {
      if (prop === 'request') return request
      const value = Reflect.get(target, prop, target) as unknown
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
}

/** Switches the wallet to `chain` (adding it if needed) and returns a Viem adapter bound to it. */
export async function adapterForChain(rawProvider: EIP1193Provider, chain: Chain, allChains: readonly Chain[]) {
  const provider = withAddChainFallback(rawProvider, allChains)
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(chain.id) }] })
  return createViemAdapterFromProvider({ provider })
}

export function errorMessage(error: unknown): string {
  const e = error as { message?: string; shortMessage?: string; code?: number } | undefined
  const msg = e?.shortMessage ?? e?.message ?? ''
  const lower = msg.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || e?.code === 4001) return 'Request cancelled in wallet.'
  if (lower.includes('insufficient')) return 'Insufficient balance for this amount plus fees.'
  if (lower.includes('route') || lower.includes('unsupported')) return 'No route is available for this pair right now.'
  return msg ? msg.slice(0, 180) : 'Something went wrong. Please try again.'
}
