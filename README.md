# Arc Lend

Arc Lend is a money market on [Arc](https://docs.arc.io) Testnet. Deposit USDC, EURC or cirBTC to earn interest, borrow against your deposits, repay, withdraw, swap, bridge USDC to other testnets, and review every transaction you have made.

> Testnet demo. Assets have no real value, asset prices are fixed reference prices set by the contract owner, and the contracts have not had an independent audit. Do not use this code with real funds.

## Contents

- [Features](#features)
- [Markets and risk parameters](#markets-and-risk-parameters)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Contract](#contract)
- [Deployed addresses](#deployed-addresses)
- [Testnet funds](#testnet-funds)
- [Known limitations](#known-limitations)

## Features

| Page | What you can do |
| --- | --- |
| Dashboard | See your collateral, debt, remaining borrow capacity and health factor, plus your supplied and borrowed assets |
| Markets | Compare supply and borrow rates, totals, utilization and max LTV for every asset |
| Deposit | Supply or withdraw an asset and switch it on or off as collateral |
| Borrow | Borrow or repay an asset, with the maximum safe amount calculated for you |
| Swap | Swap between USDC and EURC on Arc Testnet after reviewing a quote |
| Bridge | Move USDC between Arc Testnet and Base, Ethereum and Arbitrum Sepolia with Circle CCTP |
| History | Your deposits, withdrawals, borrows, repayments and liquidations, each linked to the explorer |
| Docs | A plain-language guide to the protocol, with contract addresses |

The app also has a footer with quick links, explorer links and the latest Arc Testnet block.

## Markets and risk parameters

| Asset | Decimals | Max LTV | Liquidation threshold | Liquidation bonus |
| --- | --- | --- | --- | --- |
| USDC | 6 | 75% | 80% | 5% |
| EURC | 6 | 75% | 80% | 5% |
| cirBTC | 8 | 50% | 65% | 8% |

- No supply or borrow caps are set.
- A liquidator can repay at most 50% of a single debt per liquidation.
- Initial reference prices: USDC 1.00, EURC 1.119, cirBTC 74,400 (USD).

## How it works

**Earning.** Deposits earn the supply rate. Your balance grows every second, so withdrawing later returns your deposit plus interest.

**Borrowing.** Your borrow capacity is the value of your collateral times each asset's max LTV, minus your existing debt. Interest on loans accrues every second.

**Interest rates.** Borrow rates follow pool utilization (the share of a pool that is borrowed). The curve rises gently up to an optimal utilization of 80%, then steeply:

| Utilization | Borrow APR |
| --- | --- |
| 0% | 0% |
| 80% | 4% |
| 100% | 64% |

The supply rate is the borrow rate times utilization. There is no protocol fee, so all interest goes to depositors.

**Health factor.** The health factor compares the value of your collateral, weighted by each liquidation threshold, with your debt. Above 1 your position is safe. At or below 1 anyone can repay part of your debt and take your collateral plus the liquidation bonus. If a pool has lent out the collateral asset, the liquidator receives your deposit position instead of tokens, so liquidations never get stuck.

**Gas.** Gas on Arc is paid in USDC, so keep a small USDC balance for fees.

## Tech stack

- React 18, Vite and TypeScript
- Tailwind CSS
- wagmi, viem and ConnectKit for wallet connection and onchain reads and writes
- Circle App Kit for the Swap and Bridge pages
- Solidity 0.8.28 and OpenZeppelin, built and tested with Foundry
- Bun as package manager and script runner

## Getting started

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh) (Foundry is only needed to build the contract).

```bash
git clone https://github.com/tranhangdev/arclend.git
cd arclend
bun install
```

Create a `.env` file (see [Environment variables](#environment-variables)), then start the app:

```bash
bun run dev
```

Open http://localhost:5173 and connect a browser wallet. The app asks your wallet to switch to Arc Testnet (chain ID 5042002) when you send a transaction.

Other commands:

```bash
bun run check            # lint and typecheck
bunx vite build          # production build
bun run contracts:build  # compile the contract
bun run contracts:test   # run Foundry tests
```

## Environment variables

Create a `.env` file in the project root. These values are public (they ship to the browser), so never put secrets in them.

| Name | Purpose |
| --- | --- |
| `VITE_ARCLEND_ADDRESS` | Address of the deployed lending contract |
| `VITE_ARCLEND_DEPLOY_BLOCK` | Block the contract was deployed at. History scans start here |
| `VITE_EURC_ADDRESS` | EURC token address on Arc Testnet |
| `VITE_CIRBTC_ADDRESS` | cirBTC token address on Arc Testnet |

Example for the current deployment:

```
VITE_ARCLEND_ADDRESS=0xe4fcb2c63087aaf415441434ecaf7b9a13ef71cc
VITE_ARCLEND_DEPLOY_BLOCK=71541568
VITE_EURC_ADDRESS=0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
VITE_CIRBTC_ADDRESS=0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF
```

If you deploy your own copy of the contract, update the first two values.

## Project structure

```
contracts/ArcLend.sol     Lending contract (Solidity)
src/pages/                One file per page (Dashboard, Markets, Assets, Swap, Bridge, History, Docs)
src/components/           Layout, footer, shared UI, and the deposit/borrow dialog
src/hooks/                Onchain reads, transaction flow, and history loading
src/lib/                  Token list, formatting helpers, router, and Circle App Kit setup
src/contracts/            Contract ABI used by the app
```

Notes for contributors:

- Chain, token and explorer facts come from `src/onchain-facts.ts`, and USDC amount handling from `src/onchain-money.ts`. Use them instead of hardcoding addresses or decimals.
- The contract ABI in `src/contracts/arclendAbi.ts` is generated from the compiled contract. Regenerate it after changing the contract.

## Contract

`ArcLend.sol` is a single contract that holds every market. It is built on OpenZeppelin's `Ownable`, `ReentrancyGuard` and `SafeERC20`.

- Balances use an index-based design, so interest accrues for everyone without per-user updates.
- Supplying, withdrawing, borrowing, repaying and liquidating are all protected against reentrancy.
- Tokens that take a fee on transfer are rejected.
- Markets are listed when the contract is deployed, each with its own LTV, liquidation threshold and bonus.
- The owner can update prices (each update limited to a 10% change), freeze or deactivate a market, and set caps. Withdrawals, repayments and liquidations still work on frozen markets.
- Prices are owner-set reference prices. There is no live oracle.

The contract was reviewed with automated and manual checks before deployment, but it has not had an independent audit.

## Deployed addresses

Arc Testnet (chain ID 5042002):

| Name | Address |
| --- | --- |
| Lending contract | [`0xe4fcb2c63087aaf415441434ecaf7b9a13ef71cc`](https://explorer.testnet.arc.io/address/0xe4fcb2c63087aaf415441434ecaf7b9a13ef71cc) |
| USDC | [`0x3600000000000000000000000000000000000000`](https://explorer.testnet.arc.io/address/0x3600000000000000000000000000000000000000) |
| EURC | [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://explorer.testnet.arc.io/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) |
| cirBTC | [`0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF`](https://explorer.testnet.arc.io/address/0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF) |

An earlier version of the contract at `0x4059200668a0936d4a3db9ad818cc85e1604fcf4` held only USDC and EURC and is no longer used.

## Testnet funds

- USDC and EURC: [faucet.circle.com](https://faucet.circle.com)
- To bridge, you need USDC on the source chain. Get Sepolia USDC from the same faucet.
- cirBTC: no faucet is wired into this app. Obtain it from another source on Arc Testnet.

## Known limitations

- Asset prices are fixed and do not follow the market, so a real market move is not reflected in borrowing power or liquidations.
- The contract owner is a shared deployment wallet, so prices cannot be updated after deployment.
- The History page scans events from the deployment block forward. It will get slower as the chain grows.
- Swap availability for USDC and EURC depends on testnet liquidity. If there is no route, the page says so.
- Not audited. Testnet only.
