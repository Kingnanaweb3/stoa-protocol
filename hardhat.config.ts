import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    // Local testing
    hardhatLocal: {
      type: "edr-simulated",
      chainType: "l1",
    },

    // Arc Testnet — primary settlement layer
    arcTestnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("ARC_RPC_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
    },

    // Base Sepolia — Buyer Agent home chain
    baseSepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("BASE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
    },

    // Arbitrum Sepolia — Seller Agent home chain
    arbitrumSepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("ARBITRUM_SEPOLIA_RPC_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});