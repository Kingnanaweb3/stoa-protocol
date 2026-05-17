# Stoa Protocol

Stoa is a permissionless coordination layer that enables AI agents on different blockchains to find each other, agree on work, lock payment in escrow, verify execution, and settle instantly in USDC on Arc without bridges, wrappers, or human intermediaries. Built for the Agora Agents Hackathon by Canteen x Circle.

## The Problem

AI agents are becoming autonomous market participants. A trading agent on Base detects an arbitrage opportunity but needs a specialized execution agent on another chain to act on it. Right now there is no trustless way for these agents to hire each other. They cannot verify work was done, enforce payment, or build reputation. Stoa introduces economic accountability between agents that have never met.

## How It Works

Agent A (Scout) lives on Base Sepolia. It reads live Chainlink ETH/USD price feeds and compares them against Binance spot prices in real time. When it detects a profitable spread, it posts a funded arbitrage job to Arc. Agent B (Executor) lives on Arc, polls the job board every five seconds, accepts matching jobs, executes real swaps on Base Sepolia MockDEX, and submits transaction hashes as cryptographic proof back to the Settlement contract. Agent C (Validator) independently verifies execution happened on Base Sepolia via RPC and calls verifyAndComplete on Arc only after all checks pass. Agent D (Monitor) tracks all activity in real time including opportunities detected, jobs completed, execution times, and USDC volume settled.

The four on-chain contracts are StoaRegistry for agent registration, StoaReputation for permanent on-chain reputation scores with stake slashing, StoaSettlement for Validator-gated payment release, and StoaEscrow for USDC escrow with CCTP V2 hook support. A full cycle from Scout detection to USDC settlement takes approximately 20 seconds on Arc Testnet.

## Circle Tools

USDC on Arc is the native currency for every bounty, stake, and payment in the system with no volatile gas tokens anywhere. CCTP V2 is integrated at the contract level — StoaEscrow implements IMessageTransmitterHook so agents on Base can fund jobs on Arc atomically. Live CCTP burn on Base Sepolia: 0xbd17432abc82522f4df107b0e4c143657b09f8844998cc4b649e03e38f272fc9. Circle Gateway Nanopayments via x402 powers the Stoa Reputation API where agents pay $0.000001 USDC per reputation query with zero per-query gas. Gateway deposit confirmed on Base Sepolia: 0x88d5383fecb366e4ff08e197b454e45cea8c7c66074e1f1a39744af83d43d6ac

## Deployed Contracts

StoaReputation — 0xA52BEc120f502221314E1dB6F66e519d9B99648b. StoaRegistry — 0xA9209c628D8F72aa0D611e8979ad0A7380d5f683. StoaSettlement — 0x039DC48d87d0353fD480F96A0F4EE319Cd546bd0. StoaEscrow — 0x59b73332323Bf31515D0A8B5c54aDC8B0361CC5f. MockDEX on Base Sepolia — 0xFd5A828ED02763a770d9BA698e5FD87197637F9C.

## Live Transactions

Job posted on Arc — 0xfff40ae86dc1d3ac9628e5056e01791edb762df63d79f5a93b6a8e428f70af88. Swap on Base Sepolia — 0x29b41b085f3b18efe3384e9d253a76f408b3636e30d3062ef48c62833f8dbccc. Validator confirmed on Arc — 0x405d4df9f3475392f35179da6a0b70af25af88272f96260592b81be86ceab025. Payment released on Arc — 0x1a094baec717dac13f5ffdb2df9b9e4a3fa9de7627d1e0a8823d83fac290023b.

## Running the Protocol

Clone the repo, install dependencies, copy .env.example and fill in your private key, Arc RPC URL, Base Sepolia RPC URL, and the contract addresses above. Then start all four agents in separate terminals using npx tsx on each agent file in agents/monitor, agents/validator, agents/executor, and agents/scout in that order. The Scout detects a live price spread and the full loop runs automatically.

Built by Almond (AlmondWeb3) — Agora Agents Hackathon, Canteen x Circle x Arc, May 2026.

## Verify On-Chain

All Arc Testnet transactions are verifiable at testnet.arcscan.app. All Base Sepolia transactions are verifiable at sepolia.basescan.org. Search any transaction hash above directly in the explorer. The deployed contract addresses on Arc can be inspected at testnet.arcscan.app/address followed by the contract address.
