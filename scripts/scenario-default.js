const { ethers } = require("hardhat");
const { expect } = require("chai");

const printStep = (step, text) => console.log(`\n--- STEP ${step}: ${text} ---\n`);

async function main() {
  // --- SETUP ---
  const [owner, landlord, tenant] = await ethers.getSigners();
  const SmartLeaseFactory = await ethers.getContractFactory("SmartLease");
  const contract = await SmartLeaseFactory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  const increaseTime = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  };

  // --- DEMO SCENARIO ---
  printStep(1, "Setting up an active lease...");
  const txMint = await contract.connect(owner).mintProperty(landlord.address, "Trondheim City", 95, 3, 2019, ethers.parseEther("11"), 85);
  await txMint.wait();
  const monthlyRent = await contract.calculateMonthlyPrice(0, 0, 0, 6, 12);
  const deposit = monthlyRent * 3n;
  await contract.connect(tenant).applyAndDeposit(0, 0, 0, 6, 12, { value: deposit });
  await contract.connect(landlord).approve(contractAddress, 0);
  await contract.connect(landlord).confirmLease(0);
  console.log("Active lease created. The first rent payment is due in 30 days.");

  printStep(2, "The tenant fails to pay. Simulating the passage of 31 days...");
  await increaseTime(31 * 24 * 60 * 60); // 31 days
  console.log("Blockchain time advanced. The rent payment is now overdue.");

  printStep(3, "Landlord claims the default.");
  const claimTx = () => contract.connect(landlord).claimDefault(0);
  
  // We use `changeEtherBalance` to prove the landlord received the deposit
  await expect(claimTx).to.changeEtherBalance(landlord, deposit);
  console.log(`Default claimed. Landlord has received the deposit of ${ethers.formatEther(deposit)} ETH.`);

  const lease = await contract.leases(0);
  expect(lease.state).to.equal(0); // Enum: None (since we use delete)
  const nftOwner = await contract.ownerOf(0);
  expect(nftOwner).to.equal(landlord.address);
  console.log("NFT has been returned to the Landlord and the property is available again.");
  
  console.log("\n'Default' scenario completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});