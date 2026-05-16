import { StoaConfig, PostJobParams, RegisterParams, Job, Agent, JobResult } from "./types.js";
export declare class StoaClient {
    private provider;
    private wallet;
    private escrow;
    private registry;
    private settlement;
    private usdc;
    private config;
    constructor(config: StoaConfig);
    get address(): string;
    balance(): Promise<string>;
    register(params: RegisterParams): Promise<string>;
    isRegistered(address?: string): Promise<boolean>;
    getAgent(address?: string): Promise<Agent>;
    post(params: PostJobParams): Promise<JobResult>;
    getOpenJobs(): Promise<Job[]>;
    getJob(jobId: string): Promise<Job>;
    accept(jobId: string): Promise<string>;
    submitOutput(jobId: string, output: string): Promise<string>;
    release(jobId: string): Promise<string>;
    onJobAvailable(capability: string, handler: (job: Job) => Promise<void>, intervalMs?: number): NodeJS.Timeout;
}
//# sourceMappingURL=client.d.ts.map