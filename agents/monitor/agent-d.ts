import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent D — The Monitor
// Polls Arc for all protocol events via queryFilter
// Tracks traction metrics judges need to see

const POLL_INTERVAL = 5000;

async function main() {
  console.log("Agent D (Monitor) starting on Arc...");
  console.log("--------------------------------------");

  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const arcWallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);

  console.log("Monitor wallet:", arcWallet.address);

  const escrowAbi = [
    "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
    "event CrossChainJobPosted(bytes32 indexed jobId, address indexed poster, uint32 sourceDomain, uint256 bounty)",
    "event JobAccepted(bytes32 indexed jobId, address indexed fulfiller)",
    "event PaymentReleased(bytes32 indexed jobId, address indexed fulfiller, uint256 amount)",
  ];

  const reputationAbi = [
    "function getReputation(address agent) external view returns (uint256)",
  ];

  const escrow = new ethers.Contract(CONFIG.contracts.escrow, escrowAbi, arcWallet);
  const reputation = new ethers.Contract(CONFIG.contracts.reputation, reputationAbi, arcWallet);

  const metrics = {
    opportunitiesDetected: 0,
    jobsPosted: 0,
    jobsCompleted: 0,
    crossChainJobs: 0,
    totalVolumeUSDC: 0n,
    executionTimes: [] as number[],
    jobStartTimes: new Map<string, number>(),
  };

  let lastBlock = await arcProvider.getBlockNumber();
  console.log("Starting from block:", lastBlock);
  console.log("\nMonitor online. Polling every 5 seconds...");
  console.log("============================================\n");

  setInterval(async () => {
    try {
      const currentBlock = await arcProvider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      // Query all events since last block
      const jobPostedEvents = await escrow.queryFilter(
        escrow.filters.JobPosted(),
        lastBlock + 1,
        currentBlock
      );

      const crossChainEvents = await escrow.queryFilter(
        escrow.filters.CrossChainJobPosted(),
        lastBlock + 1,
        currentBlock
      );

      const acceptedEvents = await escrow.queryFilter(
        escrow.filters.JobAccepted(),
        lastBlock + 1,
        currentBlock
      );

      const releasedEvents = await escrow.queryFilter(
        escrow.filters.PaymentReleased(),
        lastBlock + 1,
        currentBlock
      );

      // Process JobPosted
      for (const e of jobPostedEvents) {
        const parsed = escrow.interface.parseLog(e);
        if (!parsed) continue;
        metrics.jobsPosted++;
        metrics.opportunitiesDetected++;
        metrics.jobStartTimes.set(parsed.args[0], Date.now());
        console.log("[JOB POSTED]");
        console.log("  Job ID:", parsed.args[0]);
        console.log("  Bounty:", ethers.formatUnits(parsed.args[2], 6), "USDC");
      }

      // Process CrossChainJobPosted
      for (const e of crossChainEvents) {
        const parsed = escrow.interface.parseLog(e);
        if (!parsed) continue;
        metrics.jobsPosted++;
        metrics.opportunitiesDetected++;
        metrics.crossChainJobs++;
        metrics.jobStartTimes.set(parsed.args[0], Date.now());
        console.log("[CROSS-CHAIN JOB POSTED via CCTP]");
        console.log("  Job ID:", parsed.args[0]);
        console.log("  Source domain:", parsed.args[2]);
        console.log("  Bounty:", ethers.formatUnits(parsed.args[3], 6), "USDC");
      }

      // Process JobAccepted
      for (const e of acceptedEvents) {
        const parsed = escrow.interface.parseLog(e);
        if (!parsed) continue;
        console.log("[JOB ACCEPTED]");
        console.log("  Job ID:", parsed.args[0]);
        console.log("  Fulfiller:", parsed.args[1]);
      }

      // Process PaymentReleased
      for (const e of releasedEvents) {
        const parsed = escrow.interface.parseLog(e);
        if (!parsed) continue;
        metrics.jobsCompleted++;
        metrics.totalVolumeUSDC += parsed.args[2];

        const startTime = metrics.jobStartTimes.get(parsed.args[0]);
        if (startTime) {
          const execMs = Date.now() - startTime;
          metrics.executionTimes.push(execMs);
          metrics.jobStartTimes.delete(parsed.args[0]);
          console.log("[SETTLEMENT COMPLETE]");
          console.log("  Job ID:", parsed.args[0]);
          console.log("  Amount:", ethers.formatUnits(parsed.args[2], 6), "USDC");
          console.log("  Execution time:", (execMs / 1000).toFixed(1), "seconds");
        }

        try {
          const rep = await reputation.getReputation(parsed.args[1]);
          console.log("  Fulfiller reputation:", rep.toString());
        } catch {}

        printMetrics(metrics);
      }

      lastBlock = currentBlock;
    } catch (err) {
      console.log("Poll error:", err);
    }
  }, POLL_INTERVAL);

  // Print metrics every 30 seconds regardless
  setInterval(() => {
    console.log("\n[PERIODIC REPORT]");
    printMetrics(metrics);
  }, 30000);
}

function printMetrics(metrics: any) {
  const avg = metrics.executionTimes.length > 0
    ? (metrics.executionTimes.reduce((a: number, b: number) => a + b, 0) / metrics.executionTimes.length / 1000).toFixed(1)
    : "N/A";

  const rate = metrics.jobsPosted > 0
    ? ((metrics.jobsCompleted / metrics.jobsPosted) * 100).toFixed(1)
    : "0.0";

  console.log("\n--- STOA PROTOCOL METRICS ---");
  console.log("Opportunities detected:  ", metrics.opportunitiesDetected);
  console.log("Jobs posted:             ", metrics.jobsPosted);
  console.log("  Cross-chain (CCTP):    ", metrics.crossChainJobs);
  console.log("Jobs completed:          ", metrics.jobsCompleted);
  console.log("Success rate:            ", rate + "%");
  console.log("Total volume:            ", ethers.formatUnits(metrics.totalVolumeUSDC, 6), "USDC");
  console.log("Avg execution time:      ", avg, "seconds");
  console.log("-----------------------------\n");
}

main().catch((error) => {
  console.error("Agent D error:", error);
  process.exit(1);
});
