const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SmartLease Contract", function () {
  let SmartLease, smartLease;
  let owner, landlord, tenant, stranger;

  // Helper to increase blockchain time
  const increaseTime = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  };

  beforeEach(async () => {
    [owner, landlord, tenant, stranger] = await ethers.getSigners();
    const SmartLeaseFactory = await ethers.getContractFactory("SmartLease");
    smartLease = await SmartLeaseFactory.connect(owner).deploy();
    await smartLease.waitForDeployment();
  });

  describe("Task 1: NFT Modeling", () => {
    it("should mint a property NFT to the correct landlord", async () => {
      await smartLease.connect(owner).mintProperty(
        landlord.address, "Oslo Center", 100, 3, 2020, ethers.parseEther("12"), 90
      );

      expect(await smartLease.ownerOf(0)).to.equal(landlord.address);
      const property = await smartLease.properties(0);
      expect(property.landlord).to.equal(landlord.address);
    });
  });

  describe("Task 2: Dynamic Pricing Logic", () => {
    beforeEach(async () => {
      await smartLease.connect(owner).mintProperty(
        landlord.address, "Bergen", 80, 2, 2021, ethers.parseEther("10"), 85
      );
    });

    it("should compute a reasonable monthly rent", async () => {
      const rent = await smartLease.calculateMonthlyPrice(0, 500, 1000, 5, 12);
      const naiveMonthly = ethers.parseEther("10") / 12n;
      expect(rent).to.be.gt(0).and.to.be.lt(naiveMonthly);
    });

    it("should increase rent when usage exceeds cap", async () => {
      const rentLow = await smartLease.calculateMonthlyPrice(0, 200, 1000, 5, 12);
      const rentHigh = await smartLease.calculateMonthlyPrice(0, 1500, 1000, 5, 12);
      expect(rentHigh).to.be.gt(rentLow);
    });

    it("should apply a discount for longer leases", async () => {
      const shortLeaseRent = await smartLease.calculateMonthlyPrice(0, 0, 0, 8, 6);
      const longLeaseRent = await smartLease.calculateMonthlyPrice(0, 0, 0, 8, 12);
      expect(longLeaseRent).to.be.lt(shortLeaseRent);
    });

    it("should revert if userScore is out of bounds", async () => {
      await expect(
        smartLease.calculateMonthlyPrice(0, 0, 0, 11, 12)
      ).to.be.revertedWith("score must be 0..10");
    });
  });

  describe("Task 3: Fair Exchange (Apply & Confirm)", () => {
    let rent, deposit;

    beforeEach(async () => {
      await smartLease.connect(owner).mintProperty(
        landlord.address, "Stavanger", 120, 4, 2018, ethers.parseEther("15"), 95
      );
      rent = await smartLease.calculateMonthlyPrice(0, 0, 0, 7, 12);
      deposit = rent * 3n;
    });

    it("should revert on incorrect deposit amount", async () => {
      await expect(
        smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 7, 12, { value: deposit - 1n })
      ).to.be.revertedWith("wrong deposit amount");
    });

    it("should succeed on correct deposit, setting state to Pending", async () => {
      await smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 7, 12, { value: deposit });
      const lease = await smartLease.leases(0);
      expect(lease.state).to.equal(1); // Enum: Pending
      expect(lease.tenant).to.equal(tenant.address);
      expect(lease.depositHeld).to.equal(deposit);
    });

    it("should revert if a non-landlord tries to confirm", async () => {
      await smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 7, 12, { value: deposit });
      await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
      await expect(
        smartLease.connect(stranger).confirmLease(0)
      ).to.be.revertedWith("only landlord");
    });

    it("should confirm the lease, escrow the NFT, and set state to Active", async () => {
      await smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 7, 12, { value: deposit });
      await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
      await smartLease.connect(landlord).confirmLease(0);

      const lease = await smartLease.leases(0);
      expect(lease.state).to.equal(2); // Enum: Active
      expect(await smartLease.ownerOf(0)).to.equal(await smartLease.getAddress());
      expect(lease.nextPaymentDueDate).to.be.gt(0);
    });
  });

  describe("Task 4: Default Protection (Pay Rent & Claim Default)", () => {
    let rent, deposit;

    beforeEach(async () => {
      await smartLease.connect(owner).mintProperty(
        landlord.address, "Trondheim", 90, 3, 2019, ethers.parseEther("11"), 88
      );
      rent = await smartLease.calculateMonthlyPrice(0, 0, 0, 8, 12);
      deposit = rent * 3n;

      // Setup an active lease for each test
      await smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 8, 12, { value: deposit });
      await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
      await smartLease.connect(landlord).confirmLease(0);
    });

    it("should allow tenant to pay rent, updating the due date", async () => {
      const leaseBefore = await smartLease.leases(0);
      await smartLease.connect(tenant).payRent(0, { value: rent });
      const leaseAfter = await smartLease.leases(0);
      expect(leaseAfter.nextPaymentDueDate).to.be.gt(leaseBefore.nextPaymentDueDate);
    });
    
    it("should revert if landlord claims default before due date", async () => {
      await expect(
        smartLease.connect(landlord).claimDefault(0)
      ).to.be.revertedWith("Rent is not overdue yet");
    });

    it("should allow landlord to claim default, receiving deposit and resetting the lease", async () => {
        // Fast-forward time past the due date
        await increaseTime(31 * 24 * 60 * 60); // 31 days

        await expect(() =>
            smartLease.connect(landlord).claimDefault(0)
        ).to.changeEtherBalance(landlord, deposit); 
        expect(await smartLease.ownerOf(0)).to.equal(landlord.address);
        const lease = await smartLease.leases(0);
        expect(lease.state).to.equal(0); // Enum: None
        expect(lease.tenant).to.equal(ethers.ZeroAddress);
        expect(lease.depositHeld).to.equal(0);

        const newTenant = stranger;
        const newRent = await smartLease.calculateMonthlyPrice(0, 0, 0, 5, 12);
        const newDeposit = newRent * 3n;
        
        await expect(
            smartLease.connect(newTenant).applyAndDeposit(0, 0, 0, 5, 12, { value: newDeposit })
        ).to.not.be.reverted;
    });
  });

  describe("Task 5: End-of-Lease Options", () => {
    let rent, deposit;

    beforeEach(async () => {
      await smartLease.connect(owner).mintProperty(
        landlord.address, "Kristiansand", 75, 2, 2022, ethers.parseEther("9"), 92
      );
      rent = await smartLease.calculateMonthlyPrice(0, 0, 0, 9, 12);
      deposit = rent * 3n;

      // Setup an active lease
      await smartLease.connect(tenant).applyAndDeposit(0, 0, 0, 9, 12, { value: deposit });
      await smartLease.connect(landlord).approve(await smartLease.getAddress(), 0);
      await smartLease.connect(landlord).confirmLease(0);
    });

    it("should revert if lease is terminated before expiry", async () => {
      await expect(
        smartLease.connect(tenant).terminateLease(0)
      ).to.be.revertedWith("lease not yet expired");
    });

    it("should terminate lease after expiry, refunding tenant and returning NFT", async () => {
      await increaseTime(366 * 24 * 60 * 60); // ~1 year and 1 day

      await expect(() => 
          smartLease.connect(tenant).terminateLease(0)
      ).to.changeEtherBalance(tenant, deposit);

      const lease = await smartLease.leases(0);
      expect(lease.state).to.equal(0); // Enum: None
      expect(lease.tenant).to.equal(ethers.ZeroAddress);
    });

    it("should extend a lease, recalculating rent and adjusting deposit", async () => {
        const oldLease = await smartLease.leases(0);
        const newRent = await smartLease.calculateMonthlyPrice(0, 0, 0, 9, 24); // Extending for another 12 months (total 24)
        
        // Since new rent for a longer period is cheaper, a refund is expected
        const newDeposit = newRent * 3n;
        const refund = oldLease.depositHeld - newDeposit;
        expect(refund).to.be.gt(0);

        await smartLease.connect(tenant).extendLease(0, 12, 0, 0, 9);
        const extendedLease = await smartLease.leases(0);

        expect(extendedLease.durationMonths).to.equal(24);
        expect(extendedLease.monthlyRent).to.equal(newRent);
        expect(extendedLease.depositHeld).to.equal(newDeposit);
    });
  });
});