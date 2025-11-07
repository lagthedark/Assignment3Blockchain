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

  it("Test 1: should mint a property NFT correctly", async () => {
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

  it("Test 3: should revert on wrong deposit and succeed on correct deposit", async () => {
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

  it("Test 4: should confirm lease and escrow NFT", async () => {
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
});
