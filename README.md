# Arc Lend

A USDC, EURC and cirBTC money market on Arc Testnet. Supply stablecoins to earn interest, borrow against your collateral, repay, withdraw, and review your transaction history.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Solidity (Foundry).

## Pages

- Dashboard: collateral, debt, borrow capacity and health factor
- Markets: live supply and borrow rates per asset
- Deposit: supply, withdraw, and toggle collateral
- Borrow: borrow and repay
- Swap: swap between USDC and EURC on Arc Testnet
- Bridge: move USDC between Arc Testnet and Base, Ethereum and Arbitrum Sepolia
- History: your onchain activity, linked to the explorer
- Docs: a plain-language guide to how Arc Lend works, plus contract addresses
- Footer: quick links, explorer links and the latest Arc Testnet block

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```
bun install
bun run dev
bun run build
bun run contracts:build
bun run contracts:test
```

### Environment variables

- `VITE_ARCLEND_ADDRESS`: address of the deployed lending contract
- `VITE_ARCLEND_DEPLOY_BLOCK`: block the contract was deployed at (where history scans start)
- `VITE_EURC_ADDRESS`: EURC token address on Arc Testnet
- `VITE_CIRBTC_ADDRESS`: cirBTC token address on Arc Testnet
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: optional outside Arc Studio

## Testnet notice

Asset prices (including cirBTC) are fixed owner-set reference prices, not a live oracle feed. This is demo software on a testnet and has not had a third-party audit.
