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
  printStep(1, "Setting up an active lease for 12 months...");
  const txMint = await contract.connect(owner).mintProperty(landlord.address, "Bergen Bryggen", 80, 2, 2020, ethers.parseEther("10"), 90);
  await txMint.wait();
  const monthlyRent = await contract.calculateMonthlyPrice(0, 0, 0, 7, 12);
  const deposit = monthlyRent * 3n;
  await contract.connect(tenant).applyAndDeposit(0, 0, 0, 7, 12, { value: deposit });
  await contract.connect(landlord).approve(contractAddress, 0);
  await contract.connect(landlord).confirmLease(0);
  console.log("Active 12-month lease created.");

  printStep(2, "Simulating the passage of 13 months to surpass the lease term...");
  await increaseTime(396 * 24 * 60 * 60); // ~13 months
  console.log("Blockchain time advanced. The lease is now expired.");

  printStep(3, "Tenant terminates the lease.");
  const terminateTx = () => contract.connect(tenant).terminateLease(0);
  
  // We use `changeEtherBalance` to prove the refund was successful
  await expect(terminateTx).to.changeEtherBalance(tenant, deposit);
  console.log(`Lease terminated. Tenant has been refunded ${ethers.formatEther(deposit)} ETH.`);
  
  const lease = await contract.leases(0);
  expect(lease.state).to.equal(0); // Enum: None (since we use delete)
  console.log("Lease state has been reset to None, and the property is available again.");
  
  console.log("\n'Successful Termination' scenario completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});