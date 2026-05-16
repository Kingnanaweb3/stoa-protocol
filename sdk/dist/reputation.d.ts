import { ReputationData } from "./types.js";
export declare class StoaReputation {
    private contract;
    private provider;
    constructor(arcRpc: string, reputationAddress: string);
    get(address: string): Promise<ReputationData>;
    query(addresses: string[], minScore?: number): Promise<{
        address: string;
        reputation: ReputationData;
    }[]>;
}
//# sourceMappingURL=reputation.d.ts.map