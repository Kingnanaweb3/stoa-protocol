
// ─────────────────────────────────────────
// STOA PROTOCOL — Core Client
// ─────────────────────────────────────────

import { ethers } from "ethers";
import {
  StoaConfig,
  PostJobParams,
  RegisterParams,
  Job,
  Agent,
  JobResult,
} from "./types.js";

const ESCROW_ABI = [
  "function postJob(string memory task, uint256 bounty, string memory requiredCapability, uint256 minReputation, uint256 deadlineInSeconds) external returns (bytes32)",
  "function acceptJob(bytes32 jobId) external",
  "function releasePayment(bytes32 jobId) external",
  "function getJob(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 bounty, string memory task, string memory requiredCapability, uint256 deadline, bool funded, bool released)",
  "function getOpenJobs() external view returns (bytes32[] memory)",
  "event JobPosted(bytes32 indexed jobId, address indexed poster, uint256 bounty, string task, string requiredCapability, uint256 deadline)",
];

const REGISTRY_ABI = [
  "function register(string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount) external",
  "function isRegistered(address agent) external view returns (bool)",
  "function getAgent(address agent) external view returns (string[] memory capabilities, string memory chainOrigin, uint256 stakedAmount, bool active)",
];

const SETTLEMENT_ABI = [
  "function submitOutput(bytes32 jobId, bytes32 outputHash) external",
  "function getSettlement(bytes32 jobId) external view returns (address poster, address fulfiller, uint256 amount, uint8 status, uint256 deadline, bytes32 outputHash)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
];

export class StoaClient {
  private provider:   ethers.JsonRpcProvider;
  private wallet:     ethers.Wallet;
  private escrow:     ethers.Contract;
  private registry:   ethers.Contract;
  private settlement: ethers.Contract;
  private usdc:       ethers.Contract;
  private config:     StoaConfig;

  constructor(config: StoaConfig) {
    this.config   = config;
    this.provider = new ethers.JsonRpcProvider(config.arcRpc);
    this.wallet   = new ethers.Wallet(config.privateKey, this.provider);

    const usdcAddress = config.usdcAddress ?? "0x3600000000000000000000000000000000000000";

    this.escrow     = new ethers.Contract(config.contracts.escrow,     ESCROW_ABI,     this.wallet);
    this.registry   = new ethers.Contract(config.contracts.registry,   REGISTRY_ABI,   this.wallet);
    this.settlement = new ethers.Contract(config.contracts.settlement, SETTLEMENT_ABI, this.wallet);
    this.usdc       = new ethers.Contract(usdcAddress,                 USDC_ABI,       this.wallet);
  }

  // ── Identity ──────────────────────────────

  get address(): string {
    return this.wallet.address;
  }

  async balance(): Promise<string> {
    const bal = await this.usdc.balanceOf(this.wallet.address);
    return ethers.formatUnits(bal, 6);
  }

  // ── Agent Registration ────────────────────

  async register(params: RegisterParams): Promise<string> {
    const already = await this.registry.isRegistered(this.wallet.address);
    if (already) return "already-registered";

    const stake = ethers.parseUnits(params.stakeAmount, 6);
    const tx = await this.registry.register(
      params.capabilities,
      params.chainOrigin,
      stake
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async isRegistered(address?: string): Promise<boolean> {
    const addr = address ?? this.wallet.address;
    return this.registry.isRegistered(addr);
  }

  async getAgent(address?: string): Promise<Agent> {
    const addr = address ?? this.wallet.address;
    const result = await this.registry.getAgent(addr);
    return {
      address:      addr,
      capabilities: result[0],
      chainOrigin:  result[1],
      stakedAmount: ethers.formatUnits(result[2], 6),
      active:       result[3],
    };
  }

  // ── Job Posting ───────────────────────────

  async post(params: PostJobParams): Promise<JobResult> {
    const bounty    = ethers.parseUnits(params.bounty, 6);
    const minRep    = params.minReputation    ?? 0;
    const deadline  = params.deadlineInSeconds ?? 3600;

    // Approve escrow to spend USDC
    const approveTx = await this.usdc.approve(
      this.config.contracts.escrow,
      bounty
    );
    await approveTx.wait();

    // Post the job
    const tx = await this.escrow.postJob(
      params.task,
      bounty,
      params.requiredCapability,
      minRep,
      deadline
    );
    const receipt = await tx.wait();

    // Extract job ID from event
    const event = receipt.logs.find((l: any) => {
      try { return this.escrow.interface.parseLog(l)?.name === "JobPosted"; }
      catch { return false; }
    });

    const parsed = this.escrow.interface.parseLog(event);
    const jobId  = parsed?.args[0];

    return {
      jobId,
      txHash: receipt.hash,
      block:  receipt.blockNumber,
      bounty: params.bounty,
      task:   params.task,
    };
  }

  // ── Job Discovery ─────────────────────────

  async getOpenJobs(): Promise<Job[]> {
    const jobIds = await this.escrow.getOpenJobs();
    const jobs: Job[] = [];

    for (const jobId of jobIds) {
      const j = await this.escrow.getJob(jobId);
      jobs.push({
        jobId,
        poster:             j[0],
        fulfiller:          j[1],
        bounty:             ethers.formatUnits(j[2], 6),
        task:               j[3],
        requiredCapability: j[4],
        deadline:           Number(j[5]),
        funded:             j[6],
        released:           j[7],
      });
    }

    return jobs;
  }

  async getJob(jobId: string): Promise<Job> {
    const j = await this.escrow.getJob(jobId);
    return {
      jobId,
      poster:             j[0],
      fulfiller:          j[1],
      bounty:             ethers.formatUnits(j[2], 6),
      task:               j[3],
      requiredCapability: j[4],
      deadline:           Number(j[5]),
      funded:             j[6],
      released:           j[7],
    };
  }

  // ── Job Fulfillment ───────────────────────

  async accept(jobId: string): Promise<string> {
    const tx = await this.escrow.acceptJob(jobId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async submitOutput(jobId: string, output: string): Promise<string> {
    const outputHash = ethers.keccak256(ethers.toUtf8Bytes(output));
    const tx = await this.settlement.submitOutput(jobId, outputHash);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async release(jobId: string): Promise<string> {
    const tx = await this.escrow.releasePayment(jobId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ── Polling ───────────────────────────────

  onJobAvailable(
    capability: string,
    handler: (job: Job) => Promise<void>,
    intervalMs: number = 5000
  ): NodeJS.Timeout {
    const seen = new Set<string>();

    return setInterval(async () => {
      try {
        const jobs = await this.getOpenJobs();
        for (const job of jobs) {
          if (
            !seen.has(job.jobId) &&
            job.requiredCapability === capability &&
            job.fulfiller === ethers.ZeroAddress
          ) {
            seen.add(job.jobId);
            await handler(job);
          }
        }
      } catch (err) {
        // silent poll failure
      }
    }, intervalMs);
  }
}

