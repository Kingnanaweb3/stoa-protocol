import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent A — The Buyer
// Lives on Base Sepolia, posts jobs to Arc via Escrow

async function main() {
  console.log("🤖 Agent A (Buyer) starting...");

  // Connect to Arc where contracts live
  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const wallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);

  console.log("Agent A wallet:", wallet.address);

  // Load Escrow ABI
  const escrowAbi = [
    "function postJob(string memory task, uint256 bounty, string memory requiredCapability, uint256 minReputation, uint256 deadlineInSeconds) external returns (bytes32)",
    "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
    "function getOpenJobs() external view returns (bytes32[] memory)",
    "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
    "event JobAccepted(bytes32 indexed jobId, address indexed fulfiller)",
    "event PaymentReleased(bytes32 indexed jobId, address indexed fulfiller, uint256 amount)",
  ];

  // Load USDC ABI
  const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];

  const escrow = new ethers.Contract(
    CONFIG.contracts.escrow,
    escrowAbi,
    wallet
  );

  const usdc = new ethers.Contract(
    CONFIG.usdcAddress,
    usdcAbi,
    wallet
  );

  // Check USDC balance
  const balance = await usdc.balanceOf(wallet.address);
  console.log("USDC Balance:", ethers.formatUnits(balance, 6), "USDC");

  // Approve escrow to spend USDC
  const bounty = ethers.parseUnits("1.0", 6); // 1 USDC
  console.log("\nApproving escrow to spend USDC...");
  const approveTx = await usdc.approve(CONFIG.contracts.escrow, bounty);
  await approveTx.wait();
  console.log("✅ Approved");

  // Post a job
  console.log("\nPosting job to Arc...");
  const task = "Summarize the key benefits of cross-chain agent settlement";
  const requiredCapability = "summarization";
  const minReputation = 0;
  const deadlineInSeconds = 3600; // 1 hour

  const tx = await escrow.postJob(
    task,
    bounty,
    requiredCapability,
    minReputation,
    deadlineInSeconds
  );

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Job posted in block:", receipt.blockNumber);

  // Extract job ID from event
  const event = receipt.logs.find((log: any) => {
    try {
      const parsed = escrow.interface.parseLog(log);
      return parsed?.name === "JobPosted";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = escrow.interface.parseLog(event);
    const jobId = parsed?.args[0];
    console.log("\n🎯 Job ID:", jobId);
    console.log("Task:", task);
    console.log("Bounty: 1.00 USDC");
    console.log("Capability needed:", requiredCapability);

    // Save job ID for Agent B
    console.log("\n📋 Share this Job ID with Agent B:");
    console.log(jobId);

    // Listen for job acceptance
    console.log("\n👂 Listening for Agent B to accept the job...");
    escrow.on("JobAccepted", (acceptedJobId: string, fulfiller: string) => {
      if (acceptedJobId === jobId) {
        console.log("\n✅ Job accepted by agent:", fulfiller);
      }
    });

    // Listen for payment release
    escrow.on("PaymentReleased", (paidJobId: string, fulfiller: string, amount: bigint) => {
      if (paidJobId === jobId) {
        console.log("\n💰 Payment released!");
        console.log("Fulfiller:", fulfiller);
        console.log("Amount:", ethers.formatUnits(amount, 6), "USDC");
        process.exit(0);
      }
    });
  }
}

main().catch((error) => {
  console.error("Agent A error:", error);
  process.exit(1);
});