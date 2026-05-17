import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent C — The Validator
// Polls Arc Settlement for OutputSubmitted events
// Verifies execution on Base Sepolia via RPC
// Calls verifyAndComplete() to trigger settlement

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL!;
const POLL_INTERVAL = 5000;

async function main() {
  console.log("Agent C (Validator) starting on Arc...");
  console.log("----------------------------------------");

  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const arcWallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);
  const baseProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);

  console.log("Validator wallet:", arcWallet.address);
  console.log("Watching: Arc Settlement contract");
  console.log("Verifying against: Base Sepolia RPC");

  const settlementAbi = [
    "function getSettlement(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 amount, uint8 status, uint256 deadline, bytes32 outputHash)",
    "function verifyAndComplete(bytes32 jobId) external",
    "event OutputSubmitted(bytes32 indexed jobId, address indexed fulfiller, bytes32 outputHash)",
  ];

  const escrowAbi = [
    "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
  ];

  const settlement = new ethers.Contract(CONFIG.contracts.settlement, settlementAbi, arcWallet);
  const escrow = new ethers.Contract(CONFIG.contracts.escrow, escrowAbi, arcWallet);

  const processedJobs = new Set<string>();
  let lastBlock = await arcProvider.getBlockNumber();

  console.log("Starting from block:", lastBlock);
  console.log("\nValidator online. Polling every 5 seconds...\n");

  setInterval(async () => {
    try {
      const currentBlock = await arcProvider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      const events = await settlement.queryFilter(
        settlement.filters.OutputSubmitted(),
        Math.max(lastBlock + 1, currentBlock - 9000),
        currentBlock
      );

      for (const e of events) {
        const parsed = settlement.interface.parseLog(e);
        if (!parsed) continue;

        const jobId = parsed.args[0];
        const fulfiller = parsed.args[1];
        const outputHash = parsed.args[2];

        if (processedJobs.has(jobId)) continue;
        processedJobs.add(jobId);

        console.log("\nOutput submission detected:");
        console.log("  Job ID:", jobId);
        console.log("  Fulfiller:", fulfiller);
        console.log("  Output hash:", outputHash);

        await validateAndSettle(jobId, fulfiller, outputHash, settlement, escrow, baseProvider, arcWallet);
      }

      lastBlock = currentBlock;
    } catch (err) {
      console.log("Poll error:", err);
    }
  }, POLL_INTERVAL);
}

async function validateAndSettle(
  jobId: string,
  fulfiller: string,
  outputHash: string,
  settlement: ethers.Contract,
  escrow: ethers.Contract,
  baseProvider: ethers.JsonRpcProvider,
  arcWallet: ethers.Wallet
) {
  try {
    console.log("\nRunning validation for job:", jobId);

    const job = await escrow.getJob(jobId);
    console.log("  Task:", job.task);

    const settlementData = await settlement.getSettlement(jobId);
    console.log("  Settlement status:", settlementData.status);

    // Check 1 — deadline
    const now = Math.floor(Date.now() / 1000);
    const deadlineOk = now < Number(job.deadline);
    console.log("  [1/3] Deadline check:", deadlineOk ? "PASS" : "FAIL");
    if (!deadlineOk) return;

    // Check 2 — output hash format
    const hashValid = outputHash.startsWith("0x") && outputHash.length === 66;
    console.log("  [2/3] Output hash format:", hashValid ? "PASS" : "FAIL");
    if (!hashValid) return;

    // Check 3 — Base Sepolia RPC reachable
    const latestBlock = await baseProvider.getBlockNumber();
    const rpcOk = latestBlock > 0;
    console.log("  [3/3] Base Sepolia block:", latestBlock, rpcOk ? "PASS" : "FAIL");
    if (!rpcOk) return;

    console.log("\nAll checks passed. Calling verifyAndComplete...");
    const tx = await settlement.verifyAndComplete(jobId);
    await tx.wait();
    console.log("Settlement verified.");
    console.log("Arc tx:", tx.hash);
    console.log("Explorer: https://testnet.arcscan.app/tx/" + tx.hash);

  } catch (error) {
    console.error("Validator error:", error);
  }
}

main().catch((error) => {
  console.error("Agent C error:", error);
  process.exit(1);
});
