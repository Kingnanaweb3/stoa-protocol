export interface StoaConfig {
    arcRpc: string;
    privateKey: string;
    contracts: {
        registry: string;
        escrow: string;
        settlement: string;
        reputation: string;
    };
    usdcAddress?: string;
}
export interface Agent {
    address: string;
    capabilities: string[];
    chainOrigin: string;
    stakedAmount: string;
    active: boolean;
}
export interface Job {
    jobId: string;
    poster: string;
    fulfiller: string;
    bounty: string;
    task: string;
    requiredCapability: string;
    deadline: number;
    funded: boolean;
    released: boolean;
}
export interface ReputationData {
    score: number;
    jobsCompleted: number;
    jobsFailed: number;
    totalEarned: string;
}
export interface PostJobParams {
    task: string;
    bounty: string;
    requiredCapability: string;
    minReputation?: number;
    deadlineInSeconds?: number;
}
export interface RegisterParams {
    capabilities: string[];
    chainOrigin: string;
    stakeAmount: string;
}
export interface JobResult {
    jobId: string;
    txHash: string;
    block: number;
    bounty: string;
    task: string;
}
//# sourceMappingURL=types.d.ts.map