import hre from "hardhat";
import { ethers } from "ethers";

// Deploy MockDEX to Base Sepolia
// Execution venue for Agent B — real on-chain swaps with guaranteed liquidity

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL!;
const BASE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia

async function main() {
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  console.log("Deploying MockDEX to Base Sepolia...");
  console.log("Deployer:", wallet.address);

  const ethBalance = await provider.getBalance(wallet.address);
  console.log("ETH balance:", ethers.formatEther(ethBalance), "ETH");

  if (ethBalance === 0n) {
    console.error("No ETH on Base Sepolia. Get testnet ETH from https://faucet.quicknode.com/base/sepolia");
    process.exit(1);
  }

  const MockDEXArtifact = await hre.artifacts.readArtifact("MockDEX");

  const MockDEXFactory = new ethers.ContractFactory(
    MockDEXArtifact.abi,
    MockDEXArtifact.bytecode,
    wallet
  );

  const mockDEX = await MockDEXFactory.deploy(BASE_USDC);
  await mockDEX.waitForDeployment();
  const mockDEXAddress = await mockDEX.getAddress();

  console.log("\nMockDEX deployed to:", mockDEXAddress);
  console.log("Network: Base Sepolia");
  console.log("USDC:", BASE_USDC);
  console.log("\nAdd to .env:");
  console.log("MOCK_DEX_ADDRESS=" + mockDEXAddress);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
