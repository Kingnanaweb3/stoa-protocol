import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent A — The Scout
// Reads real Chainlink ETH/USD on Base Sepolia
// Compares against Binance spot price (real CEX/DEX discrepancy)
// Posts arbitrage job directly on Arc when spread exceeds threshold

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL!;
const CHAINLINK_ETH_USD_BASE = "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1";
const SPREAD_THRESHOLD = 0.001;

const chainlinkAbi = [
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function description() view returns (string)",
];

const escrowAbi = [
  "function postJob(string memory task, uint256 bounty, string memory requiredCapability, uint256 minReputation, uint256 deadlineInSeconds) external returns (bytes32)",
  "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
];

const usdcAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

async function getBinancePrice(): Promise<number> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
  const data = await res.json() as { price: string };
  return parseFloat(data.price);
}

async function main() {
  console.log("Agent A (Scout) starting...");
  console.log("----------------------------");

  // Base Sepolia — price feed
  const baseProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const priceFeed = new ethers.Contract(CHAINLINK_ETH_USD_BASE, chainlinkAbi, baseProvider);

  // Arc — job posting
  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const arcWallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);
  const escrow = new ethers.Contract(CONFIG.contracts.escrow, escrowAbi, arcWallet);
  const usdc = new ethers.Contract(CONFIG.usdcAddress, usdcAbi, arcWallet);

  console.log("Scout wallet:", arcWallet.address);

  const arcBalance = await usdc.balanceOf(arcWallet.address);
  console.log("USDC balance on Arc:", ethers.formatUnits(arcBalance, 6), "USDC");

  // Read real Chainlink price on Base Sepolia
  console.log("\nReading Chainlink ETH/USD on Base Sepolia...");
  const roundData = await priceFeed.latestRoundData();
  const description = await priceFeed.description();
  const chainlinkPrice = Number(roundData[1]) / 1e8;
  const updatedAt = new Date(Number(roundData[3]) * 1000).toISOString();

  console.log("Feed:", description);
  console.log("Chainlink price:", chainlinkPrice.toFixed(4), "USD");
  console.log("Last updated:", updatedAt);

  // Read real Binance spot price
  console.log("\nReading Binance ETH/USDT spot price...");
  const binancePrice = await getBinancePrice();
  console.log("Binance spot price:", binancePrice.toFixed(4), "USD");

  // Calculate real spread between CEX and oracle
  const spread = ((binancePrice - chainlinkPrice) / chainlinkPrice) * 100;
  const absSpread = Math.abs(spread);
  console.log("\nSpread (Binance vs Chainlink):", spread.toFixed(4), "%");
  console.log("Threshold:", SPREAD_THRESHOLD, "%");

  if (absSpread < SPREAD_THRESHOLD) {
    console.log("Spread below threshold. No arbitrage opportunity. Exiting.");
    process.exit(0);
  }

  const direction = spread > 0 ? "BUY on Chainlink venue, SELL on Binance" : "BUY on Binance, SELL on Chainlink venue";
  console.log("Arbitrage direction:", direction);
  console.log("Posting job to Arc...");

  // Approve USDC for escrow
  const bounty = ethers.parseUnits("2.0", 6);
  const approveTx = await usdc.approve(CONFIG.contracts.escrow, bounty);
  await approveTx.wait();
  console.log("USDC approved");

  // Post job on Arc
  const task = `Arbitrage ETH/USDC: Chainlink=$${chainlinkPrice.toFixed(2)} Binance=$${binancePrice.toFixed(2)} spread=${spread.toFixed(4)}% direction=${direction} execute on Base Sepolia MockDEX`;
  const tx = await escrow.postJob(
    task,
    bounty,
    "arbitrage-execution",
    40,
    3600
  );

  console.log("\nJob posted. Arc tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  const event = receipt.logs.find((log: any) => {
    try {
      return escrow.interface.parseLog(log)?.name === "JobPosted";
    } catch { return false; }
  });

  if (event) {
    const parsed = escrow.interface.parseLog(event);
    console.log("Job ID:", parsed?.args[0]);
    console.log("Task:", task);
    console.log("Bounty: 1.0 USDC");
    console.log("Arc explorer: https://testnet.arcscan.app/tx/" + tx.hash);
  }

  console.log("\nWaiting for Executor to pick up job...");

  // Listen for completion via polling
  setInterval(async () => {
    try {
      const jobs = await escrow.queryFilter(
        escrow.filters.JobPosted(),
        receipt.blockNumber,
        "latest"
      );
      if (jobs.length > 0) {
        console.log("Job active on Arc. Executor polling...");
      }
    } catch {}
  }, 10000);
}

main().catch((error) => {
  console.error("Agent A error:", error);
  process.exit(1);
});
