import * as dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  // Arc Testnet — where contracts live
  arcRpc: process.env.ARC_RPC_URL!,

  // Base Sepolia — Scout and MockDEX
  baseRpc: process.env.BASE_SEPOLIA_RPC_URL!,

  // Contracts on Arc
  contracts: {
    reputation: process.env.REPUTATION_CONTRACT!,
    registry:   process.env.REGISTRY_CONTRACT!,
    settlement: process.env.SETTLEMENT_CONTRACT!,
    escrow:     process.env.ESCROW_CONTRACT!,
  },

  // Contracts on Base Sepolia
  baseSepolia: {
    mockDex:  process.env.MOCK_DEX_ADDRESS!,
    usdc:     "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    cctp:     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    chainlink: {
      ethUsd: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    },
  },

  // CCTP
  cctp: {
    arcDomain:  26,
    transmitter: process.env.CCTP_MESSAGE_TRANSMITTER!,
    messenger:   process.env.CCTP_TOKEN_MESSENGER!,
  },

  // Shared private key for demo
  privateKey: process.env.PRIVATE_KEY!,

  // USDC on Arc testnet
  usdcAddress: "0x3600000000000000000000000000000000000000",
};
