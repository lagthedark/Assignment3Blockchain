const { ethers } = require("hardhat");

const printStep = (step, text) => console.log(`\n--- STEP ${step}: ${text} ---\n`);

async function main() {
  // --- SETUP ---
  const [owner, landlord, tenant] = await ethers.getSigners();
  const SmartLeaseFactory = await ethers.getContractFactory("SmartLease");
  const contract = await SmartLeaseFactory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('Owner/Admin:', owner.address);
  console.log('Landlord:', landlord.address);
  console.log('Tenant:', tenant.address);
  console.log('SmartLease contract deployed to:', contractAddress);

  // Helper to advance time
  const increaseTime = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  };

  // --- DEMO SCENARIO ---

  printStep(1, "Owner mints a new property NFT for the Landlord.");
  const txMint = await contract.connect(owner).mintProperty(
      landlord.address, "Oslo Majorstuen", 110, 4, 2021, ethers.parseEther("15"), 95
  );
  await txMint.wait();
  console.log(`NFT with Token ID 0 minted for Landlord (${landlord.address})`);

  printStep(2, "Calculating the monthly rent and required deposit.");
  const monthlyRent = await contract.calculateMonthlyPrice(0, 0, 0, 8, 12);
  const deposit = monthlyRent * 3n;
  console.log(`Calculated Monthly Rent: ${ethers.formatEther(monthlyRent)} ETH`);
  console.log(`Required Deposit (3 months): ${ethers.formatEther(deposit)} ETH`);

  printStep(3, "Tenant applies for the lease and deposits the funds.");
  const txApply = await contract.connect(tenant).applyAndDeposit(0, 0, 0, 8, 12, { value: deposit });
  await txApply.wait();
  console.log(`Tenant (${tenant.address}) has successfully applied.`);

  printStep(4, "Landlord approves the contract and confirms the lease.");
  const txApprove = await contract.connect(landlord).approve(contractAddress, 0);
  await txApprove.wait();
  console.log("Landlord has approved the contract to manage the NFT.");
  const txConfirm = await contract.connect(landlord).confirmLease(0);
  await txConfirm.wait();
  console.log("Lease confirmed! The contract is now Active.");

  printStep(5, "Tenant pays the first month's rent.");
  const txPay1 = await contract.connect(tenant).payRent(0, { value: monthlyRent });
  await txPay1.wait();
  console.log("First month's rent paid successfully.");

  printStep(6, "Simulating the passage of one month...");
  await increaseTime(30 * 24 * 60 * 60); // 30 days
  console.log("Blockchain time advanced by 30 days.");
  
  printStep(7, "Tenant pays the second month's rent.");
  const txPay2 = await contract.connect(tenant).payRent(0, { value: monthlyRent });
  await txPay2.wait();
  console.log("Second month's rent paid successfully.");
  
  console.log("\n'Happy Path' scenario completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});