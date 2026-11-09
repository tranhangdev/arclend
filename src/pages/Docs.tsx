import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { PageTitle } from '@/components/ui'
import { Link } from '@/lib/router'
import { CHAIN_ID, POOL_ADDRESS, TOKENS } from '@/lib/pool'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { shortAddr } from '@/lib/format'

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'start', title: 'Getting started' },
  { id: 'deposit', title: 'Deposit and earn' },
  { id: 'borrow', title: 'Borrow and repay' },
  { id: 'health', title: 'Health factor and liquidation' },
  { id: 'rates', title: 'Interest rates' },
  { id: 'swap-bridge', title: 'Swap and bridge' },
  { id: 'risks', title: 'Risks and limits' },
  { id: 'contracts', title: 'Contracts' },
  { id: 'faq', title: 'FAQ' },
] as const

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line/60 py-8 first:pt-0 last:border-0">
      <h2 className="font-serif text-[28px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 max-w-[68ch] space-y-3 text-pretty text-[17px] leading-relaxed text-cream/85">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[480px] text-left font-mono text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-[0.08em] text-muted">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className="tnum px-4 py-3">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Docs() {
  return (
    <>
      <PageTitle sub="How Arc Lend works, in plain language. Everything here runs on Arc Testnet.">Documentation</PageTitle>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Documentation sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[13px] lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className="min-h-9 text-left text-muted transition hover:text-cream">
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article>
          <Section id="overview" title="Overview">
            <p>
              Arc Lend is a money market on Arc. You deposit stablecoins and other assets to earn interest, and you can borrow other assets against your deposits.
              Interest is paid by borrowers to depositors, and rates move automatically with how much of each pool is in use.
            </p>
            <p>Three assets are listed: USDC, EURC and cirBTC (Circle's wrapped Bitcoin). Gas on Arc is paid in USDC, so keep a small USDC balance for fees.</p>
          </Section>

          <Section id="start" title="Getting started">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Click Connect Wallet and approve the connection. The app switches your wallet to Arc Testnet when you send a transaction.</li>
              <li>
                Get test funds. Use Get test USDC in the Arc Studio sidebar, or the{' '}
                <a className="underline underline-offset-4" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                  Circle faucet
                </a>{' '}
                for USDC and EURC.
              </li>
              <li>
                Open <Link to="/deposit" className="underline underline-offset-4">Deposit</Link> and supply an asset. You will sign two transactions the first time: an approval, then the deposit.
              </li>
              <li>
                Open <Link to="/borrow" className="underline underline-offset-4">Borrow</Link> to borrow against your deposit, and watch your health factor on the{' '}
                <Link to="/" className="underline underline-offset-4">Dashboard</Link>.
              </li>
            </ol>
          </Section>

          <Section id="deposit" title="Deposit and earn">
            <p>
              Supplied assets earn the supply rate shown on Markets. Your balance grows continuously, so withdrawing later returns your deposit plus interest. You can withdraw any amount as long as the pool has enough
              free liquidity and your position stays healthy.
            </p>
            <p>
              Each deposit can be used as collateral. Use the Collateral switch on the Deposit page to turn it off. You cannot turn collateral off if that would make your health factor drop below 1.
            </p>
          </Section>

          <Section id="borrow" title="Borrow and repay">
            <p>
              Your borrow capacity is the total value of your collateral multiplied by each asset's maximum loan-to-value (LTV), minus what you already owe. The Borrow page shows what is left to borrow right now.
            </p>
            <p>
              Interest on a loan accrues every second. Repay any time from the Borrow page. Choose MAX to repay the full balance including interest, which needs enough of that asset in your wallet.
            </p>
            <Table
              head={['Asset', 'Max LTV', 'Liquidation threshold', 'Liquidation bonus']}
              rows={[
                ['USDC', '75%', '80%', '5%'],
                ['EURC', '75%', '80%', '5%'],
                ['cirBTC', '50%', '65%', '8%'],
              ]}
            />
          </Section>

          <Section id="health" title="Health factor and liquidation">
            <p>
              The health factor compares the value of your collateral, weighted by each liquidation threshold, to your debt. Above 1 your position is safe. At or below 1 anyone can repay part of your debt and take your
              collateral plus a bonus.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Infinity means you have no debt.</li>
              <li>Below 1.5 deserves attention. Below 1.1 is close to liquidation.</li>
              <li>A liquidator can repay at most 50% of one debt per liquidation.</li>
              <li>If the pool has lent out the collateral asset, the liquidator receives your deposit position instead of tokens, so liquidations never get stuck.</li>
            </ul>
            <p>To raise your health factor, repay debt or add collateral.</p>
          </Section>

          <Section id="rates" title="Interest rates">
            <p>
              Borrow rates depend on utilization, the share of a pool that is currently borrowed. Rates rise slowly up to the optimal utilization of 80%, then steeply, which pulls utilization back down.
            </p>
            <Table
              head={['Utilization', 'Borrow APR']}
              rows={[
                ['0%', '0%'],
                ['80% (optimal)', '4%'],
                ['100%', '64%'],
              ]}
            />
            <p>The supply rate equals the borrow rate multiplied by utilization. There is no protocol fee, so all interest goes to depositors. Rates shown in the app are simple annual rates (APR).</p>
          </Section>

          <Section id="swap-bridge" title="Swap and bridge">
            <p>
              <Link to="/swap" className="underline underline-offset-4">Swap</Link> exchanges USDC and EURC on Arc Testnet. You review a quote first, with a 1% slippage limit, then confirm the swap in your wallet. Swaps
              are routed through a swap service provider, and you are subject to its terms.
            </p>
            <p>
              <Link to="/bridge" className="underline underline-offset-4">Bridge</Link> moves USDC between Arc Testnet and Base, Ethereum or Arbitrum Sepolia with Circle's Cross-Chain Transfer Protocol (CCTP). USDC is
              burned on the source chain and minted on the destination chain. The app shows each step as it completes.
            </p>
          </Section>

          <Section id="risks" title="Risks and limits">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-cream">Testnet only.</strong> Assets have no real value and the contracts have not had an independent audit.
              </li>
              <li>
                <strong className="font-semibold text-cream">Fixed prices.</strong> Asset prices are set by the contract owner (USDC 1.00, EURC 1.119, cirBTC 74,400 at deployment) and do not follow the market. There is no
                live oracle feed.
              </li>
              <li>
                <strong className="font-semibold text-cream">Liquidity.</strong> You can only withdraw or borrow what is currently in the pool. If most of a pool is borrowed, withdrawals wait for repayments.
              </li>
              <li>
                <strong className="font-semibold text-cream">Liquidation.</strong> Positions near the threshold can be liquidated. Keep a safety margin.
              </li>
            </ul>
          </Section>

          <Section id="contracts" title="Contracts">
            <p>All contracts are on Arc Testnet (chain ID {CHAIN_ID}).</p>
            <Table
              head={['Name', 'Address']}
              rows={[
                [
                  'Lending pool',
                  <ExplorerLink key="pool" address={POOL_ADDRESS} />,
                ],
                ...TOKENS.map((t) => [`${t.symbol} (${t.decimals} decimals)`, <ExplorerLink key={t.symbol} address={t.address} />]),
              ]}
            />
          </Section>

          <Section id="faq" title="FAQ">
            <Faq q="Why did my deposit ask for two transactions?">
              The first transaction approves the pool to move your tokens. The second makes the deposit. You only approve again when your allowance is used up.
            </Faq>
            <Faq q="Why can't I borrow more?">
              Your borrow capacity is limited by your collateral and the pool's free liquidity. Check the Dashboard for capacity, and Markets for liquidity.
            </Faq>
            <Faq q="My wallet says the app is not authorized.">
              Your wallet lost its permission for this site. Use Reconnect wallet in the dialog, or disconnect and connect again.
            </Faq>
            <Faq q="Where is my transaction history?">
              The History page lists your deposits, withdrawals, borrows, repayments and liquidations, each linked to the explorer.
            </Faq>
          </Section>
        </article>
      </div>
    </>
  )
}

function ExplorerLink({ address }: { address: string }) {
  return (
    <a
      href={buildAddressExplorerUrl(CHAIN_ID, address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 underline underline-offset-4"
      title={address}
    >
      {shortAddr(address)} <ExternalLink size={12} />
    </a>
  )
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-cream">{q}</h3>
      <p className="mt-1">{children}</p>
    </div>
  )
}
