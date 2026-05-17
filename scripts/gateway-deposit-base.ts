import { GatewayClient } from "@circle-fin/x402-batching/client";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const client = new GatewayClient({
    chain: "baseSepolia",
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  console.log("Checking Base Sepolia Gateway balance...");
  const balance = await client.getBalance();
  console.log("Current balance:", balance.formattedAvailable, "USDC");

  if (parseFloat(balance.formattedAvailable) < 0.01) {
    console.log("Depositing 1 USDC into Circle Gateway on Base Sepolia...");
    await client.deposit("1.00");
    console.log("Deposit submitted. Waiting ~15 minutes to credit.");
  } else {
    console.log("Balance sufficient. No deposit needed.");
  }
}

main().catch(console.error);
