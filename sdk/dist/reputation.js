// ─────────────────────────────────────────
// STOA PROTOCOL — Reputation Client
// ─────────────────────────────────────────
import { ethers } from "ethers";
const REPUTATION_ABI = [
    "function getReputation(address agent) external view returns (uint256 score, uint256 jobsCompleted, uint256 jobsFailed, uint256 totalEarned)",
    "function initializeAgent(address agent) external",
];
export class StoaReputation {
    constructor(arcRpc, reputationAddress) {
        this.provider = new ethers.JsonRpcProvider(arcRpc);
        this.contract = new ethers.Contract(reputationAddress, REPUTATION_ABI, this.provider);
    }
    async get(address) {
        const result = await this.contract.getReputation(address);
        return {
            score: Number(result[0]),
            jobsCompleted: Number(result[1]),
            jobsFailed: Number(result[2]),
            totalEarned: ethers.formatUnits(result[3], 6),
        };
    }
    async query(addresses, minScore = 0) {
        const results = [];
        for (const address of addresses) {
            try {
                const rep = await this.get(address);
                if (rep.score >= minScore) {
                    results.push({ address, reputation: rep });
                }
            }
            catch {
                // agent not registered — skip
            }
        }
        return results.sort((a, b) => b.reputation.score - a.reputation.score);
    }
}
//# sourceMappingURL=reputation.js.map