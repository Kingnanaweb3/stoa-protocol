// ─────────────────────────────────────────
// STOA PROTOCOL — Reputation Client
// ─────────────────────────────────────────

import { ethers } from "ethers";
import { ReputationData } from "./types.js";

const REPUTATION_ABI = [
  "function getReputation(address agent) external view returns (uint256 score, uint256 jobsCompleted, uint256 jobsFailed, uint256 totalEarned)",
  "function initializeAgent(address agent) external",
];

export class StoaReputation {
  private contract: ethers.Contract;
  private provider: ethers.JsonRpcProvider;

  constructor(arcRpc: string, reputationAddress: string) {
    this.provider = new ethers.JsonRpcProvider(arcRpc);
    this.contract = new ethers.Contract(
      reputationAddress,
      REPUTATION_ABI,
      this.provider
    );
  }

  async get(address: string): Promise<ReputationData> {
    const result = await this.contract.getReputation(address);
    return {
      score:         Number(result[0]),
      jobsCompleted: Number(result[1]),
      jobsFailed:    Number(result[2]),
      totalEarned:   ethers.formatUnits(result[3], 6),
    };
  }

  async query(
    addresses: string[],
    minScore: number = 0
  ): Promise<{ address: string; reputation: ReputationData }[]> {
    const results = [];

    for (const address of addresses) {
      try {
        const rep = await this.get(address);
        if (rep.score >= minScore) {
          results.push({ address, reputation: rep });
        }
      } catch {
        // agent not registered — skip
      }
    }

    return results.sort((a, b) => b.reputation.score - a.reputation.score);
  }
}