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
});
