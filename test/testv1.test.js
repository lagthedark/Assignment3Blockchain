const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SmartLease", function () {
  let SmartLease, smartLease;
  let owner, landlord, tenant;

  beforeEach(async () => {
    [owner, landlord, tenant] = await ethers.getSigners();

    SmartLease = await ethers.getContractFactory("SmartLease");
    smartLease = await SmartLease.connect(owner).deploy();
    await smartLease.deployed();
  });

  it("Test 1: should mint a property NFT correctly", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.utils.parseEther("12"),
      90
    );

    const nftOwner = await smartLease.ownerOf(0);
    expect(nftOwner).to.equal(landlord.address);

    const property = await smartLease.properties(0);
    expect(property.landlord).to.equal(landlord.address);
    expect(property.location).to.equal("Oslo Center");
  });

  it("Test 3: should revert on wrong deposit and succeed on correct deposit", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.utils.parseEther("12"),
      90
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent.mul(3);

    // Wrong deposit
    await expect(
      smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit.div(2) })
    ).to.be.revertedWith("wrong deposit amount");

    // Correct deposit
    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });
    const lease = await smartLease.leases(0);

    expect(lease.state).to.equal(1); // Pending
    expect(lease.tenant).to.equal(tenant.address);
    expect(lease.depositHeld).to.equal(deposit);
  });

  it("Test 4: should confirm lease and escrow NFT", async () => {
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.utils.parseEther("12"),
      90
    );

    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 5, 12);
    const deposit = rent.mul(3);

    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 5, 12, { value: deposit });

    await smartLease.connect(landlord).approve(smartLease.address, 0);
    await smartLease.connect(landlord).confirmLease(0);

    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(2); // Active
    expect(await smartLease.ownerOf(0)).to.equal(smartLease.address);
  });

  it("should allow owner to change rentGracePeriod", async () => {
    const defaultPeriod = await smartLease.claimDaysUmbral();
    expect(defaultPeriod).to.equal(30 * 24 * 60 * 60); // 30 days

    await smartLease.connect(owner).setRentGracePeriod(15 * 24 * 60 * 60);

    const newPeriod = await smartLease.claimDaysUmbral();
    expect(newPeriod).to.equal(15 * 24 * 60 * 60);
  });

  it("should allow landlord to claim default after grace period", async function () {
    this.timeout(10000); // 10s timeout seguro

    // Reducimos el periodo de gracia a 1 segundo para test rápido
    await smartLease.connect(owner).setRentGracePeriod(1);

    // Mint property
    await smartLease.connect(owner).mintProperty(
      landlord.address,
      "Oslo Center",
      100,
      3,
      2020,
      ethers.utils.parseEther("12"),
      90
    );

    // Calcular rent y deposit
    const rent = await smartLease.calculateMonthlyPrice(0, 0, 1000, 0, 1); // userScore 0, 1 mes
    const deposit = rent.mul(3);

    // Tenant aplica y deposita
    await smartLease.connect(tenant).applyAndDeposit(0, 0, 1000, 0, 1, { value: deposit });

    // Landlord aprueba y confirma lease
    await smartLease.connect(landlord).approve(smartLease.address, 0);
    await smartLease.connect(landlord).confirmLease(0);

    // --- Fast-forward tiempo 2 segundos ---
    const gracePeriod = await smartLease.claimDaysUmbral();
    await ethers.provider.send("evm_increaseTime", [Number(gracePeriod) + 1]);
    await ethers.provider.send("evm_mine", []);

    // --- Comprobar balance del contrato ---
    const contractBalance = await ethers.provider.getBalance(smartLease.address);
    expect(contractBalance).to.equal(deposit);

    // --- Claim default ---
    const landlordBalanceBefore = await ethers.provider.getBalance(landlord.address);
    const tx = await smartLease.connect(landlord).claimDefault(0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    const landlordBalanceAfter = await ethers.provider.getBalance(landlord.address);
    expect(landlordBalanceAfter).to.equal(landlordBalanceBefore.add(deposit).sub(gasUsed));

    // Lease state
    const lease = await smartLease.leases(0);
    expect(lease.state).to.equal(4); // Defaulted

    // NFT ownership
    const nftOwner = await smartLease.ownerOf(0);
    expect(nftOwner).to.equal(landlord.address);
  });
});
