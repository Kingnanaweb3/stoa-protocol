import { GatewayClient } from "@circle-fin/x402-batching/client";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  console.log("Checking Gateway balance...");
  const balance = await client.getBalance();
  console.log("Current Gateway balance:", balance, "USDC");

  console.log("\nDepositing 1 USDC into Circle Gateway...");
  await client.deposit("1.00");
  console.log("Deposit submitted.");

  const newBalance = await client.getBalance();
  console.log("New Gateway balance:", newBalance, "USDC");
}

main().catch(console.error);
