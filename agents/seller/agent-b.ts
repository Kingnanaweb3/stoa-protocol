import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent B — The Seller
// Lives on Arc, discovers and fulfills jobs

async function main() {
  console.log("🤖 Agent B (Seller) starting...");

  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const wallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);

  console.log("Agent B wallet:", wallet.address);

  // ABIs
  const registryAbi = [
    "function register(string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount) external",
    "function isRegistered(address agent) external view returns (bool)",
    "function getAgent(address agent) external view returns (string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount, bool active)",
  ];

  const escrowAbi = [
    "function getOpenJobs() external view returns (bytes32[] memory)",
    "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
    "function acceptJob(bytes32 jobId) external",
    "function releasePayment(bytes32 jobId) external",
    "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
  ];

  const settlementAbi = [
    "function submitOutput(bytes32 jobId, bytes32 outputHash) external",
    "function getSettlement(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 amount, uint8 status, uint256 deadline, bytes32 outputHash)",
  ];

  const registry = new ethers.Contract(
    CONFIG.contracts.registry,
    registryAbi,
    wallet
  );

  const escrow = new ethers.Contract(
    CONFIG.contracts.escrow,
    escrowAbi,
    wallet
  );

  const settlement = new ethers.Contract(
    CONFIG.contracts.settlement,
    settlementAbi,
    wallet
  );

  // Step 1 — Register if not already registered
  const isRegistered = await registry.isRegistered(wallet.address);

  if (!isRegistered) {
    console.log("\nRegistering Agent B on Arc...");
    const capabilities = ["summarization", "research", "analysis"];
    const chainOrigin = "arc";
    const stakeAmount = ethers.parseUnits("0.5", 6); // 0.5 USDC stake

    const tx = await registry.register(capabilities, chainOrigin, stakeAmount);
    await tx.wait();
    console.log("✅ Agent B registered with capabilities:", capabilities);
  } else {
    console.log("✅ Agent B already registered");
  }

  // Step 2 — Scan for open jobs
  console.log("\n🔍 Scanning for open jobs on Arc...");
  const openJobs = await escrow.getOpenJobs();
  console.log("Open jobs found:", openJobs.length);

  if (openJobs.length === 0) {
    console.log("No jobs available. Starting listener...");
  } else {
    // Process first matching job
    for (const jobId of openJobs) {
      const job = await escrow.getJob(jobId);
      console.log("\n📋 Job found:");
      console.log("  Task:", job.task);
      console.log("  Bounty:", ethers.formatUnits(job.bounty, 6), "USDC");
      console.log("  Capability:", job.requiredCapability);

      if (job.fulfiller === ethers.ZeroAddress) {
        await processJob(jobId, job.task, escrow, settlement, wallet);
        break;
      }
    }
  }

  // Step 3 — Poll for new jobs every 5 seconds
  console.log("\n👂 Polling for new jobs every 5 seconds...");
  let knownJobs = new Set(openJobs.map((j: string) => j));

  setInterval(async () => {
    try {
      const currentJobs = await escrow.getOpenJobs();
      for (const jobId of currentJobs) {
        if (!knownJobs.has(jobId)) {
          knownJobs.add(jobId);
          const job = await escrow.getJob(jobId);
          console.log("\n🆕 New job detected!");
          console.log("  Job ID:", jobId);
          console.log("  Task:", job.task);
          console.log("  Bounty:", ethers.formatUnits(job.bounty, 6), "USDC");
          await processJob(jobId, job.task, escrow, settlement, wallet);
        }
      }
    } catch (err) {
      console.log("Poll error:", err);
    }
  }, 5000);
}

async function processJob(
  jobId: string,
  task: string,
  escrow: ethers.Contract,
  settlement: ethers.Contract,
  wallet: ethers.Wallet
) {
  try {
    // Accept the job
    console.log("\n✋ Accepting job...");
    const acceptTx = await escrow.acceptJob(jobId);
    await acceptTx.wait();
    console.log("✅ Job accepted");

    // Execute the task — real work happens here
    console.log("\n⚙️  Executing task:", task);
    const output = await executeTask(task);
    console.log("✅ Task completed");
    console.log("Output:", output);

    // Hash the output and submit
    const outputHash = ethers.keccak256(ethers.toUtf8Bytes(output));
    console.log("\nSubmitting output hash to Settlement...");
    const submitTx = await settlement.submitOutput(jobId, outputHash);
    await submitTx.wait();
    console.log("✅ Output submitted");

    // Release payment
    console.log("\n💰 Releasing payment...");
    const releaseTx = await escrow.releasePayment(jobId);
    await releaseTx.wait();
    console.log("✅ Payment released to Agent B");
    console.log("\n🎉 Job complete. Full loop finished.");
    process.exit(0);

  } catch (error) {
    console.error("Error processing job:", error);
  }
}

async function executeTask(task: string): Promise<string> {
  // Simulate real agent work
  // In production this calls an LLM API
  console.log("  → Thinking...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  return `Agent B completed: "${task}". 
  Cross-chain agent settlement enables AI agents on different blockchains 
  to hire each other, lock payment in escrow, verify work, and settle 
  instantly in USDC via Arc — without bridges, wrappers, or human 
  intermediaries. Stoa Protocol is the coordination layer that makes 
  this possible.`;
}

main().catch((error) => {
  console.error("Agent B error:", error);
  process.exit(1);
});