import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  console.log("Deploying with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatUnits(balance, 6), "USDC");

  // Load contract artifacts
  const ReputationArtifact = await hre.artifacts.readArtifact("StoaReputation");
  const RegistryArtifact = await hre.artifacts.readArtifact("StoaRegistry");
  const SettlementArtifact = await hre.artifacts.readArtifact("StoaSettlement");
  const EscrowArtifact = await hre.artifacts.readArtifact("StoaEscrow");

  // Arc testnet addresses
  const USDC_ARC_TESTNET = "0x3600000000000000000000000000000000000000";
  // CCTP V2 Message Transmitter on Arc testnet
  const CCTP_TRANSMITTER_ARC = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";

  // 1. Deploy Reputation
  console.log("\nDeploying StoaReputation...");
  const ReputationFactory = new ethers.ContractFactory(
    ReputationArtifact.abi,
    ReputationArtifact.bytecode,
    wallet
  );
  const reputation = await ReputationFactory.deploy();
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("StoaReputation deployed to:", reputationAddress);

  // 2. Deploy Registry
  console.log("\nDeploying StoaRegistry...");
  const RegistryFactory = new ethers.ContractFactory(
    RegistryArtifact.abi,
    RegistryArtifact.bytecode,
    wallet
  );
  const registry = await RegistryFactory.deploy(reputationAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("StoaRegistry deployed to:", registryAddress);

  // 3. Deploy Settlement
  console.log("\nDeploying StoaSettlement...");
  const SettlementFactory = new ethers.ContractFactory(
    SettlementArtifact.abi,
    SettlementArtifact.bytecode,
    wallet
  );
  const settlement = await SettlementFactory.deploy(
    reputationAddress,
    registryAddress
  );
  await settlement.waitForDeployment();
  const settlementAddress = await settlement.getAddress();
  console.log("StoaSettlement deployed to:", settlementAddress);

  // 4. Deploy Escrow with CCTP transmitter
  console.log("\nDeploying StoaEscrow...");
  const EscrowFactory = new ethers.ContractFactory(
    EscrowArtifact.abi,
    EscrowArtifact.bytecode,
    wallet
  );
  const escrow = await EscrowFactory.deploy(
    registryAddress,
    settlementAddress,
    USDC_ARC_TESTNET,
    CCTP_TRANSMITTER_ARC  // ← new: CCTP hook receiver
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("StoaEscrow deployed to:", escrowAddress);

  // 5. Wire contracts together
  console.log("\nWiring contracts together...");
  const reputationContract = new ethers.Contract(
    reputationAddress,
    ReputationArtifact.abi,
    wallet
  );
  const settlementContract = new ethers.Contract(
    settlementAddress,
    SettlementArtifact.abi,
    wallet
  );

  await reputationContract.setSettlementContract(settlementAddress);
  await settlementContract.setEscrowContract(escrowAddress);

  console.log("\n✅ All contracts deployed and wired.");
  console.log("-----------------------------------");
  console.log("StoaReputation:", reputationAddress);
  console.log("StoaRegistry:  ", registryAddress);
  console.log("StoaSettlement:", settlementAddress);
  console.log("StoaEscrow:    ", escrowAddress);
  console.log("CCTP Transmitter:", CCTP_TRANSMITTER_ARC);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
