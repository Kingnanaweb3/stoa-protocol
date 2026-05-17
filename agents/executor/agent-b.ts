import { ethers } from "ethers";
import { CONFIG } from "../config.js";

// Agent B — The Executor
// Polls Arc job board for arbitrage jobs
// Executes real swap on MockDEX (Base Sepolia)
// Submits tx hash as proof, collects USDC on Arc

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL!;
const BASE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const MOCK_DEX_ADDRESS = process.env.MOCK_DEX_ADDRESS!;
const POLL_INTERVAL = 5000;

async function main() {
  console.log("Agent B (Executor) starting...");
  console.log("------------------------------");

  const arcProvider = new ethers.JsonRpcProvider(CONFIG.arcRpc);
  const arcWallet = new ethers.Wallet(CONFIG.privateKey, arcProvider);
  const baseProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const baseWallet = new ethers.Wallet(CONFIG.privateKey, baseProvider);

  console.log("Executor wallet:", arcWallet.address);
  console.log("Arc: job board + settlement");
  console.log("Base Sepolia: swap execution");

  const registryAbi = [
    "function register(string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount) external",
    "function isRegistered(address agent) external view returns (bool)",
  ];

  const escrowAbi = [
    "function getOpenJobs() external view returns (bytes32[] memory)",
    "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
    "function acceptJob(bytes32 jobId) external",
    "function releasePayment(bytes32 jobId) external",
  ];

  const settlementAbi = [
    "function submitOutput(bytes32 jobId, bytes32 outputHash) external",
    "function getSettlement(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 amount, uint8 status, uint256 deadline, bytes32 outputHash)",
  ];

  const mockDexAbi = [
    "function executeSwap(uint256 amountIn, string calldata jobId) external returns (uint256 amountOut)",
    "function getLiquidity() external view returns (uint256)",
  ];

  const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];

  const registry = new ethers.Contract(CONFIG.contracts.registry, registryAbi, arcWallet);
  const escrow = new ethers.Contract(CONFIG.contracts.escrow, escrowAbi, arcWallet);
  const settlement = new ethers.Contract(CONFIG.contracts.settlement, settlementAbi, arcWallet);
  const mockDex = new ethers.Contract(MOCK_DEX_ADDRESS, mockDexAbi, baseWallet);
  const usdc = new ethers.Contract(BASE_USDC, usdcAbi, baseWallet);

  // Register if needed
  const isRegistered = await registry.isRegistered(arcWallet.address);
  if (!isRegistered) {
    console.log("\nRegistering Executor on Arc...");
    const tx = await registry.register(
      ["arbitrage-execution", "cross-chain-swap", "price-routing"],
      "arc",
      ethers.parseUnits("0.5", 6)
    );
    await tx.wait();
    console.log("Executor registered on Arc");
  } else {
    console.log("Executor already registered on Arc");
  }

  const liquidity = await mockDex.getLiquidity();
  console.log("MockDEX liquidity:", ethers.formatUnits(liquidity, 6), "USDC");

  const processingJobs = new Set<string>();

  console.log("\nPolling Arc job board every 5 seconds...\n");

  setInterval(async () => {
    try {
      const openJobs = await escrow.getOpenJobs();

      for (const jobId of openJobs) {
        if (processingJobs.has(jobId)) continue;

        const job = await escrow.getJob(jobId);

        if (
          job.fulfiller === ethers.ZeroAddress &&
          job.requiredCapability === "arbitrage-execution"
        ) {
          processingJobs.add(jobId);
          console.log("\nArbitrage job found:");
          console.log("  Job ID:", jobId);
          console.log("  Task:", job.task);
          console.log("  Bounty:", ethers.formatUnits(job.bounty, 6), "USDC");

          await processJob(jobId, job, escrow, settlement, mockDex, usdc, arcWallet);
        }
      }
    } catch (err) {
      console.log("Poll error:", err);
    }
  }, POLL_INTERVAL);
}

async function processJob(
  jobId: string,
  job: any,
  escrow: ethers.Contract,
  settlement: ethers.Contract,
  mockDex: ethers.Contract,
  usdc: ethers.Contract,
  arcWallet: ethers.Wallet
) {
  try {
    // Accept job on Arc
    console.log("\nAccepting job on Arc...");
    const acceptTx = await escrow.acceptJob(jobId);
    await acceptTx.wait();
    console.log("Job accepted. Arc tx:", acceptTx.hash);

    // Execute swap on Base Sepolia MockDEX
    console.log("\nExecuting swap on Base Sepolia MockDEX...");
    const swapAmount = ethers.parseUnits("0.5", 6);
    const maxApproval = ethers.parseUnits("100", 6); // approve more than needed

    const approveTx = await usdc.approve(MOCK_DEX_ADDRESS, maxApproval);
    await approveTx.wait();
    console.log("USDC approved for MockDEX");

    const swapTx = await mockDex.executeSwap(swapAmount, jobId);
    const swapReceipt = await swapTx.wait();
    console.log("Swap executed on Base Sepolia");
    console.log("  Swap tx:", swapTx.hash);
    console.log("  Block:", swapReceipt.blockNumber);
    console.log("  Explorer: https://sepolia.basescan.org/tx/" + swapTx.hash);

    // Hash execution proof
    const outputHash = ethers.keccak256(ethers.toUtf8Bytes(
      JSON.stringify({
        swapTxHash: swapTx.hash,
        jobId: jobId,
        executedAt: new Date().toISOString(),
        chain: "base-sepolia",
        dex: MOCK_DEX_ADDRESS,
      })
    ));

    // Submit proof to Arc Settlement
    console.log("\nSubmitting execution proof to Arc Settlement...");
    const submitTx = await settlement.submitOutput(jobId, outputHash);
    await submitTx.wait();
    console.log("Proof submitted:", outputHash);

    // Wait for Validator to verify then release payment
    console.log("\nWaiting for Validator confirmation...");
    await waitForValidation(jobId, settlement, arcWallet);

    const releaseTx = await escrow.releasePayment(jobId);
    await releaseTx.wait();
    console.log("Payment released to Executor");
    console.log("Arc settlement tx:", releaseTx.hash);
    console.log("Explorer: https://testnet.arcscan.app/tx/" + releaseTx.hash);
    console.log("\nFull cross-chain arbitrage loop complete.");

  } catch (error) {
    console.error("Error processing job:", error);
  }
}

async function waitForValidation(
  jobId: string,
  settlement: ethers.Contract,
  arcWallet: ethers.Wallet
): Promise<void> {
  // Poll settlement status until Completed (status = 2)
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const data = await settlement.getSettlement(jobId);
    console.log("  Settlement status:", data.status.toString());
    if (Number(data.status) === 2) {
      console.log("  Validator confirmed. Proceeding to release.");
      return;
    }
  }
  throw new Error("Validation timeout after 5 minutes");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("Agent B error:", error);
  process.exit(1);
});
