const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SmartLease", function () {
  let SmartLease, smartLease;
  let owner, landlord, tenant;

  beforeEach(async () => {
    [owner, landlord, tenant] = await ethers.getSigners();

    SmartLease = await ethers.getContractFactory("SmartLease");
    smartLease = await SmartLease.connect(owner).deploy();
    await smartLease.waitForDeployment();
  });

  it("Task 1: should mint a property NFT correctly", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );

    const nftOwner = await smartLease.ownerOf(0);
    expect(nftOwner).to.equal(landlord.address);

    const property = await smartLease.properties(0);
    expect(property.landlord).to.equal(landlord.address);
    expect(property.location).to.equal("Oslo Center");
  });

  it("Task 2.1: should compute a reasonable monthly rent", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"), // base value = 12 ETH
      85
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 500, 1000, 5, 12);

    // The rent should be positive and less than baseValue/12
    const baseValue = ethers.parseEther("12");
    const naiveMonthly = baseValue / 12n;

    expect(rent).to.be.gt(0n);
    expect(rent).to.be.lt(naiveMonthly);
  });

  it("Task 2.2: should increase rent when usage exceeds cap", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Central",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );

    const rentLow = await smartLease.calculateMonthlyPrice(0, 200, 1000, 5, 12);
    const rentHigh = await smartLease.calculateMonthlyPrice(0, 2000, 1000, 5, 12);

    expect(rentHigh).to.be.gt(rentLow);
  });

  it("Task 2.3: should apply discount for long leases (>= 12 months)", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo East",
      90,
      3,
      2021,
      ethers.parseEther("10"),
      80
    );

    const shortLease = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 6);
    const longLease = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);

    expect(longLease).to.be.lt(shortLease);
  });

  it("Task 2.4: should revert if userScore > 10", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo West",
      80,
      2,
      2020,
      ethers.parseEther("8"),
      70
    );

    await expect(
      smartLease.calculateMonthlyPrice(0, 0, 1000, 11, 12)
    ).to.be.revertedWith("score must be 0..10");
  });


  it("Task 3.1: should revert on wrong deposit and succeed on correct deposit", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent * 3n;

    await expect(
      smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit / 2n })
    ).to.be.revertedWith("wrong deposit amount");

    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });
    const lease = await smartLease.leases(0);

    expect(lease.state).to.equal(1); // Pending
    expect(lease.tenant).to.equal(tenant.address);
    expect(lease.depositHeld).to.equal(deposit);
  });

  it("Task 3.2: should confirm lease and escrow NFT", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent * 3n;

    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });

    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
    await smartLease.connect(landlord).confirmLease(0);

    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(2); // Active
    expect(await smartLease.ownerOf(0)).to.equal(await smartLease.getAddress());
  });


  it("Task 4.1: should confirm lease and escrow NFT", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent * 3n;
    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });

    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
    await smartLease.connect(landlord).confirmLease(0);

    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(2); // Active
    expect(await smartLease.ownerOf(0)).to.equal(await smartLease.getAddress());
  });

  it("Task 4.2: should allow owner to change rentGracePeriod", async () => {
    const defaultPeriod = await smartLease.claimDaysUmbral();
    expect(defaultPeriod).to.equal(30n * 24n * 60n * 60n); // 30 days

    await smartLease.connect(owner).setRentGracePeriod(15n * 24n * 60n * 60n);

    const newPeriod = await smartLease.claimDaysUmbral();
    expect(newPeriod).to.equal(15n * 24n * 60n * 60n);
  });

  it("Task 4.3: should allow landlord to claim default after grace period", async function () {
    this.timeout(10000); // 10s timeout

    await smartLease.connect(owner).setRentGracePeriod(1n);
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.parseEther("12"),
      90
    );
    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 0, 1);
    const deposit = rent * 3n;
    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 0, 1, { value: deposit });

    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
    await smartLease.connect(landlord).confirmLease(0);

    await ethers.provider.send("evm_mine", []);

    const gracePeriod = (await smartLease.claimDaysUmbral()).toString();
    await ethers.provider.send("evm_increaseTime", [parseInt(gracePeriod) + 5]);
    await ethers.provider.send("evm_mine", []);

    const contractBalance = await ethers.provider.getBalance(await smartLease.getAddress());
    expect(contractBalance).to.equal(deposit);

    const landlordBalanceBefore = await ethers.provider.getBalance(landlord.address);
    const tx = await smartLease.connect(landlord).claimDefault(0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const landlordBalanceAfter = await ethers.provider.getBalance(landlord.address);
    expect(landlordBalanceAfter).to.be.greaterThan(landlordBalanceBefore);

    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(4);

    const nftOwner = await smartLease.ownerOf(0);
    expect(nftOwner).to.equal(landlord.address);
  });
    
  it("Test 5.1: should only allow lease termination after expiry", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Bergen Central",
      85,
      2,
      2021,
      ethers.parseEther("10"),
      80
    );
    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent * 3n;

    // Apply, approve, confirm
    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });
    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
    await smartLease.connect(landlord).confirmLease(0);

    // Try to terminate early → should revert
    await expect(
      smartLease.connect(tenant).terminateLease(0)
    ).to.be.revertedWith("lease not yet expired");

    // Simulate lease end (12 months = ~31,536,000 seconds)
    await ethers.provider.send("evm_increaseTime", [31_536_000]);
    await ethers.provider.send("evm_mine");

    // Now termination should succeed
    await expect(smartLease.connect(tenant).terminateLease(0))
      .to.emit(smartLease, "LeaseTerminated");

    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(3); // Terminated
    expect(await smartLease.ownerOf(0)).to.equal(landlord.address);
  });

  it("Test 5.2: should allow tenant to extend lease and recalculate rent", async () => {
  await smartLease.connect(owner).mintProperty(
    landlord.address,
    "Trondheim",
    120,
    4,
    2019,
    ethers.parseEther("15"),
    85
  );

  const rent = await smartLease.calculateMonthlyPrice(0, 0, 1200, 5, 12);
  const deposit = rent * 3n;

  await smartLease.connect(tenant).applyAndDeposit(0, 0, 1200, 5, 12, { value: deposit });
  await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
  await smartLease.connect(landlord).confirmLease(0);

  const oldLease = await smartLease.leases(0);
  await smartLease.connect(tenant).extendLease(0, 12, 0, 1200, 5);
  const newLease = await smartLease.leases(0);

  expect(newLease.state).to.equal(2); // Active
  expect(newLease.durationMonths).to.equal(oldLease.durationMonths + 12n);
  });

  it("Test 5.3: should allow tenant to start new lease for a different NFT", async () => {
    // First property & lease
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo West",
      95,
      3,
      2020,
      ethers.parseEther("11"),
      90
    );

    const rent1 = await smartLease.calculateMonthlyPrice(0, 0, 1100, 5, 12);
    const deposit1 = rent1 * 3n;

    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1100, 5, 12, { value: deposit1 });
    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
    await smartLease.connect(landlord).confirmLease(0);

    // Simulate lease expiration
    await ethers.provider.send("evm_increaseTime", [31_536_000]);
    await ethers.provider.send("evm_mine");
    await smartLease.connect(tenant).terminateLease(0);

    // Mint new property and start new lease
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo East",
      100,
      3,
      2021,
      ethers.parseEther("13"),
      85
    );

    const rent2 = await smartLease.calculateMonthlyPrice(1, 0, 1100, 5, 12);
    const deposit2 = rent2 * 3n;

    await smartLease.connect(tenant).applyAndDeposit(1, 0, 1100, 5, 12, { value: deposit2 });
    await smartLease.connect(landlord).approve(await smartLease.getAddress(), 1);
    await smartLease.connect(landlord).confirmLease(1);

    const lease2 = await smartLease.leases(1);
    expect(lease2.state).to.equal(2); // Active
    expect(await smartLease.ownerOf(1)).to.equal(await smartLease.getAddress());
  });
});
