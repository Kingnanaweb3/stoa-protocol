import express from "express";
import { ethers } from "ethers";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { CONFIG } from "../config.js";

// Stoa Reputation API — powered by Circle Nanopayments
// Agents pay $0.000001 USDC per reputation query
// Seller = Agent D wallet, Buyer = any agent querying reputation

const PORT = 4021;
const SELLER_ADDRESS = process.env.SELLER_ADDRESS || "0x0514E3b0eA3C16ADa117ecf1892b050df3C2F273";

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

  // Circle Gateway Nanopayments middleware
  const gateway = createGatewayMiddleware({
    sellerAddress: SELLER_ADDRESS,
  });

  console.log("Stoa Reputation API starting...");
  console.log("----------------------------------");
  console.log("Seller address:", SELLER_ADDRESS);
  console.log("Network: Arc Testnet");
  console.log("Payment: $0.000001 USDC per query via Circle Nanopayments");

  // Free endpoint — health check
  app.get("/health", (req, res) => {
    res.json({
      status: "online",
      protocol: "Stoa Protocol",
      service: "Reputation API",
      payment: "x402 / Circle Nanopayments",
      price: "$0.000001 USDC per query",
    });
  });

  // Paid endpoint — reputation query
  // Requires $0.000001 USDC via Circle Nanopayments before serving data
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
        });
      } catch (error) {
        console.error("Reputation query error:", error);
        return res.status(500).json({ error: "Query failed" });
      }
    }
  );

  // Paid endpoint — all registered agents leaderboard
  app.get(
    "/leaderboard",
    gateway.require("$0.000001"),
    async (req, res) => {
      try {
        return res.json({
          protocol: "Stoa Protocol",
          description: "Top agents by reputation on Arc Testnet",
          note: "Query individual agents via /reputation/:address",
          settledOn: "Arc Testnet",
          queriedAt: new Date().toISOString(),
        });
      } catch (error) {
        return res.status(500).json({ error: "Leaderboard query failed" });
      }
    }
  );

  app.listen(PORT, () => {
    console.log(`\nReputation API live at http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log("  GET /health                  — free");
    console.log("  GET /reputation/:address     — $0.000001 USDC");
    console.log("  GET /leaderboard             — $0.000001 USDC");
    console.log("\nWaiting for paid reputation queries...");
  });
}

main().catch((error) => {
  console.error("Reputation server error:", error);
  process.exit(1);
});
