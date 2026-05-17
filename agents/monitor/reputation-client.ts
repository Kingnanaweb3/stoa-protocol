import { GatewayClient } from "@circle-fin/x402-batching/client";
import { CONFIG } from "../config.js";

// Reputation query client — pays $0.000001 USDC per query
// Used by Agent B to check Executor reputation before accepting jobs

const REPUTATION_API = "http://localhost:4021";

export async function queryReputation(agentAddress: string): Promise<any> {
  const client = new GatewayClient({
    chain: "baseSepolia",
    privateKey: CONFIG.privateKey as `0x${string}`,
  });

  console.log("Querying reputation for:", agentAddress);
  console.log("Paying $0.000001 USDC via Circle Nanopayments...");

  try {
    const response = await client.pay(
      `${REPUTATION_API}/reputation/${agentAddress}`
    );

    console.log("Payment confirmed. Reputation data received.");
    return response.data;
  } catch (error) {
    console.error("Reputation query failed:", error);
    throw error;
  }
}

// Standalone test
async function main() {
  const testAddress = "0x0514E3b0eA3C16ADa117ecf1892b050df3C2F273";
  const data = await queryReputation(testAddress);
  console.log("\nReputation data:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
