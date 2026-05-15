import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const ReputationArtifact = await hre.artifacts.readArtifact("StoaReputation");

  const reputation = new ethers.Contract(
    process.env.REPUTATION_CONTRACT!,
    ReputationArtifact.abi,
    wallet
  );

  console.log("Setting registry contract on Reputation...");
  const tx = await reputation.setRegistryContract(process.env.REGISTRY_CONTRACT!);
  await tx.wait();
  console.log("✅ Registry wired into Reputation");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
