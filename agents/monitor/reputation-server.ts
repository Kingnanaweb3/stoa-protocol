import express from "express";
import { ethers } from "ethers";
import { paymentMiddleware } from "@x402/express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { CONFIG } from "../config.js";

// Stoa Reputation API
// Protected by Circle Gateway Nanopayments via x402
// Agents pay $0.000001 USDC per reputation query — gas free

const PORT = 4021;
const SELLER_ADDRESS = (process.env.SELLER_ADDRESS || "0x0514E3b0eA3C16ADa117ecf1892b050df3C2F273") as `0x${string}`;

const reputationAbi = [
  "function getReputation(address agent) external view returns (uint256)",
];

const registryAbi = [
  "function isRegistered(address agent) external view returns (bool)",
  "function getAgent(address agent) external view returns (string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount, bool active)",
];

async function main() {
  const app = express();
  app.use(express.json());

  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const reputation = new ethers.Contract(CONFIG.contracts.reputation, reputationAbi, arcProvider);
  const registry = new ethers.Contract(CONFIG.contracts.registry, registryAbi, arcProvider);

  // Circle Gateway middleware — handles 402 enforcement
  const gateway = createGatewayMiddleware({
    sellerAddress: SELLER_ADDRESS,
  });

  console.log("Stoa Reputation API starting...");
  console.log("Seller:", SELLER_ADDRESS);
  console.log("Price: $0.000001 USDC per query via Circle Nanopayments");

  // Free health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "online",
      protocol: "Stoa Protocol",
      service: "Reputation API",
      payment: "Circle Gateway Nanopayments / x402",
      price: "$0.000001 USDC per query",
      seller: SELLER_ADDRESS,
    });
  });

  // Paid reputation query
  app.get(
    "/reputation/:address",
    gateway.require("$0.000001"),
    async (req, res) => {
      try {
        const agentAddress = req.params.address;
        if (!ethers.isAddress(agentAddress)) {
          return res.status(400).json({ error: "Invalid address" });
        }

        const [repScore, isRegistered] = await Promise.all([
          reputation.getReputation(agentAddress),
          registry.isRegistered(agentAddress),
        ]);

        let agentData = null;
        if (isRegistered) {
          const agent = await registry.getAgent(agentAddress);
          agentData = {
            capabilities: agent[0],
            chainOrigin: agent[1],
            stakedAmount: ethers.formatUnits(agent[2], 6),
            active: agent[3],
          };
        }

        return res.json({
          address: agentAddress,
          reputationScore: repScore.toString(),
          isRegistered,
          agent: agentData,
          queriedAt: new Date().toISOString(),
          settledOn: "Arc Testnet",
          paymentProtocol: "Circle Gateway Nanopayments",
        });
      } catch (error) {
        console.error("Query error:", error);
        return res.status(500).json({ error: "Query failed" });
      }
    }
  );

  // Paid leaderboard
  app.get(
    "/leaderboard",
    gateway.require("$0.000001"),
    async (_req, res) => {
      return res.json({
        protocol: "Stoa Protocol",
        description: "Agent leaderboard — query /reputation/:address for scores",
        settledOn: "Arc Testnet",
        queriedAt: new Date().toISOString(),
      });
    }
  );

  app.listen(PORT, () => {
    console.log(`\nReputation API live at http://localhost:${PORT}`);
    console.log("GET /health            — free");
    console.log("GET /reputation/:addr  — $0.000001 USDC");
    console.log("GET /leaderboard       — $0.000001 USDC");
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
