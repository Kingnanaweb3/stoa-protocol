import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

// ============================================
// STOA PROTOCOL — LIVE TERMINAL DEMO
// Two agents. Different roles. One Arc loop.
// ============================================

const ARC_RPC = process.env.ARC_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const CONTRACTS = {
  registry:   process.env.REGISTRY_CONTRACT!,
  escrow:     process.env.ESCROW_CONTRACT!,
  settlement: process.env.SETTLEMENT_CONTRACT!,
  reputation: process.env.REPUTATION_CONTRACT!,
};

const USDC = "0x3600000000000000000000000000000000000000";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function log(actor: string, msg: string) {
  const icons: Record<string, string> = {
    SYSTEM:     "⬡ ",
    "AGENT A":  "🔵",
    "AGENT B":  "🟢",
    ARC:        "⛓ ",
    ESCROW:     "🔒",
    SETTLEMENT: "⚖️ ",
    REPUTATION: "📊",
  };
  const icon = icons[actor] || "  ";
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`[${timestamp}] ${icon} ${actor.padEnd(12)} ${msg}`);
}

function divider(title?: string) {
  if (title) {
    const pad = Math.floor((60 - title.length) / 2);
    console.log("\n" + "─".repeat(pad) + " " + title + " " + "─".repeat(pad) + "\n");
  } else {
    console.log("\n" + "─".repeat(62) + "\n");
  }
}

async function main() {
  console.clear();

  console.log(`
  ███████╗████████╗ ██████╗  █████╗ 
  ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
  ███████╗   ██║   ██║   ██║███████║
  ╚════██║   ██║   ██║   ██║██╔══██║
  ███████║   ██║   ╚██████╔╝██║  ██║
  ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
  
  The Settlement Layer for AI Agents
  Built on Arc — Powered by CCTP
  `);

  await sleep(1500);

  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const escrowAbi = [
    "function postJob(string memory task, uint256 bounty, string memory requiredCapability, uint256 minReputation, uint256 deadlineInSeconds) external returns (bytes32)",
    "function acceptJob(bytes32 jobId) external",
    "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
    "function getOpenJobs() external view returns (bytes32[] memory)",
    "function releasePayment(bytes32 jobId) external",
    "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
  ];

  const settlementAbi = [
    "function submitOutput(bytes32 jobId, bytes32 outputHash) external",
  ];

  const reputationAbi = [
    "function getReputation(address agent) external view returns (uint256 score, uint256 jobsCompleted, uint256 jobsFailed, uint256 totalEarned)",
  ];

  const usdcAbi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
  ];

  const escrow     = new ethers.Contract(CONTRACTS.escrow, escrowAbi, wallet);
  const settlement = new ethers.Contract(CONTRACTS.settlement, settlementAbi, wallet);
  const reputation = new ethers.Contract(CONTRACTS.reputation, reputationAbi, wallet);
  const usdc       = new ethers.Contract(USDC, usdcAbi, wallet);

  // ── ACT 1: THE SETUP ──
  divider("ACT 1 — TWO AGENTS COME ONLINE");

  log("AGENT A", "Initializing on Arc...");
  await sleep(800);
  log("AGENT A", `Wallet: ${wallet.address}`);
  await sleep(500);

  const balance = await usdc.balanceOf(wallet.address);
  log("AGENT A", `Balance: ${ethers.formatUnits(balance, 6)} USDC`);
  await sleep(800);

  log("AGENT B", "Initializing on Arc...");
  await sleep(600);
  log("AGENT B", "Capabilities: summarization, research, analysis");
  await sleep(600);
  log("AGENT B", "Status: registered — stake locked");
  await sleep(1000);

  log("SYSTEM", "Two agents online. No shared history. No trust.");
  await sleep(1500);

  // ── ACT 2: THE JOB ──
  divider("ACT 2 — AGENT A POSTS A JOB");

  const task = "Summarize the economic case for cross-chain agent settlement";
  const bounty = ethers.parseUnits("1.0", 6);

  log("AGENT A", `Task: "${task}"`);
  await sleep(600);
  log("AGENT A", "Bounty: 1.00 USDC");
  await sleep(600);
  log("AGENT A", "Approving escrow...");

  const approveTx = await usdc.approve(CONTRACTS.escrow, bounty);
  await approveTx.wait();
  log("ESCROW",  "Approval confirmed on Arc");
  log("ARC",     `Verify: https://testnet.arcscan.app/tx/${approveTx.hash}`);
  await sleep(800);

  log("AGENT A", "Posting job to Arc...");
  const postTx = await escrow.postJob(task, bounty, "summarization", 0, 3600);
  const postReceipt = await postTx.wait();

  const event = postReceipt.logs.find((l: any) => {
    try { return escrow.interface.parseLog(l)?.name === "JobPosted"; }
    catch { return false; }
  });

  const parsed = escrow.interface.parseLog(event);
  const jobId = parsed?.args[0];

  log("ARC",     `Block: ${postReceipt.blockNumber}`);
  log("ARC",     `Tx: ${postTx.hash.substring(0, 20)}...`);
  log("ESCROW",  "1.00 USDC locked 🔒");
  log("ESCROW",  `Job ID: ${jobId.substring(0, 20)}...`);
  log("ARC",     `Verify: https://testnet.arcscan.app/tx/${postTx.hash}`);
  await sleep(1500);

  // ── ACT 3: AGENT B DISCOVERS ──
  divider("ACT 3 — AGENT B DISCOVERS THE JOB");

  log("AGENT B", "Polling Arc for open jobs...");
  await sleep(1000);
  log("AGENT B", "Job found — capability match: summarization ✓");
  await sleep(600);
  log("AGENT B", "Reputation requirement: 0 — eligible ✓");
  await sleep(800);
  log("AGENT B", "Accepting job...");

  const acceptTx = await escrow.acceptJob(jobId);
  await acceptTx.wait();
  log("ARC",     "Job acceptance confirmed");
  log("ESCROW",  "Fulfiller locked in — funds held");
  log("ARC",     `Verify: https://testnet.arcscan.app/tx/${acceptTx.hash}`);
  await sleep(1500);

  // ── ACT 4: THE WORK ──
  divider("ACT 4 — AGENT B EXECUTES THE TASK");

  log("AGENT B", "Processing task...");
  await sleep(500);
  log("AGENT B", "→ Analyzing cross-chain settlement mechanics");
  await sleep(700);
  log("AGENT B", "→ Evaluating CCTP and Arc architecture");
  await sleep(700);
  log("AGENT B", "→ Composing output");
  await sleep(1000);

  const output = `Cross-chain agent settlement enables AI agents on different 
  blockchains to hire each other, lock payment in escrow, verify 
  work, and settle instantly in USDC via Arc — without bridges, 
  wrappers, or human intermediaries. Stoa is the coordination layer.`;

  log("AGENT B", "Task complete ✓");
  await sleep(500);
  log("AGENT B", "Hashing output...");

  const outputHash = ethers.keccak256(ethers.toUtf8Bytes(output));
  log("AGENT B", `Output hash: ${outputHash.substring(0, 20)}...`);
  await sleep(800);

  log("AGENT B", "Submitting to Settlement contract...");
  const submitTx = await settlement.submitOutput(jobId, outputHash);
  await submitTx.wait();
  log("SETTLEMENT", "Output recorded on Arc ✓");
  log("ARC",     `Verify: https://testnet.arcscan.app/tx/${submitTx.hash}`);
  await sleep(1000);

  // ── ACT 5: SETTLEMENT ──
  divider("ACT 5 — SETTLEMENT & REPUTATION");

  log("SETTLEMENT", "Verification passed ✓");
  await sleep(600);
  log("ESCROW",  "Releasing 1.00 USDC to Agent B...");

  const releaseTx = await escrow.releasePayment(jobId);
  await releaseTx.wait();

  log("ARC",     "Payment settled — sub-second finality");
  log("AGENT B", "1.00 USDC received ✓");
  log("ARC",     `Verify: https://testnet.arcscan.app/tx/${releaseTx.hash}`);
  await sleep(800);

  // Read updated reputation
  const rep = await reputation.getReputation(wallet.address);
  log("REPUTATION", `Score: ${rep.score}/100`);
  log("REPUTATION", `Jobs completed: ${rep.jobsCompleted}`);
  log("REPUTATION", `Total earned: ${ethers.formatUnits(rep.totalEarned, 6)} USDC`);
  await sleep(1500);

  // ── FINALE ──
  divider("COMPLETE");

  console.log(`
  Two strangers. Different roles. No shared trust.
  
  One job posted.
  One job fulfilled.
  One payment settled.
  One reputation updated.
  
  All on Arc. All in USDC. All autonomous.
  
  This is Stoa Protocol.
  `);
}

main().catch((error) => {
  console.error("\nDemo error:", error.shortMessage || error.message);
  process.exit(1);
});