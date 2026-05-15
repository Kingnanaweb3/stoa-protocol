import * as dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  // Arc Testnet — where contracts live
  arcRpc: process.env.ARC_RPC_URL!,

  // Base Sepolia — Buyer Agent home
  baseRpc: process.env.BASE_SEPOLIA_RPC_URL!,

  // Contracts on Arc
  contracts: {
    reputation: process.env.REPUTATION_CONTRACT!,
    registry:   process.env.REGISTRY_CONTRACT!,
    settlement: process.env.SETTLEMENT_CONTRACT!,
    escrow:     process.env.ESCROW_CONTRACT!,
  },

  // Shared private key for demo
  privateKey: process.env.PRIVATE_KEY!,

  // USDC on Arc testnet
  usdcAddress: "0x3600000000000000000000000000000000000000",
};