// File: tests/SmartLease_test.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "remix_tests.sol";
import "remix_accounts.sol";
import "../contracts/SmartLease.sol";

contract SmartLease_Test {

    SmartLease smartLease;
    address owner;
    address landlord;
    address tenant;

    /// @notice This function runs before each test, setting up a clean environment.
    function beforeEach() public {
        owner = TestsAccounts.getAccount(0);
        landlord = TestsAccounts.getAccount(1);
        tenant = TestsAccounts.getAccount(2);

        // The contract is deployed by the owner (account 0)
        // #sender: owner
        smartLease = new SmartLease();
    }

    /// @notice Tests the NFT creation functionality (Requirement #1)
    function test_1_MintProperty() public {
        // #sender: owner
        smartLease.mintProperty(landlord, "Oslo", 100, 3, 2020, 1 ether, 95);
        Assert.equal(smartLease.ownerOf(0), landlord, "FAIL: NFT is not owned by the correct landlord.");
        (address landlordAddress,,,,,,,) = smartLease.properties(0);
        Assert.equal(landlordAddress, landlord, "FAIL: Landlord address in the struct is incorrect.");
    }

    /// @notice Tests the dynamic pricing logic (Requirement #2)
    function test_2_ComputeMonthlyRent() public {
        // To be completed:
        // 1. Mint a property as in the test above.
        // 2. Call computeMonthlyRent with tokenId 0 and a sample tenant score.
        // 3. Use Assert.equal() to verify that the result matches the expected calculation.
    }

    /// @notice Tests the lease application and deposit flow (Requirement #3)
    function test_3_ApplyAndDeposit() public {
        // Setup
        owner = TestsAccounts.getAccount(0);
        landlord = TestsAccounts.getAccount(1);
        tenant = TestsAccounts.getAccount(2);

        // #sender: owner
        smartLease.mintProperty(landlord, "Oslo Center", 100, 3, 2020, 12 ether, 90);

        uint256 tokenId = 0;

        // Compute expected rent
        uint256 rent = smartLease.calculateMonthlyPrice(tokenId, 0, 1000, 5, 12);
        uint256 correctDeposit = rent * 3;
        uint256 wrongDeposit = correctDeposit / 2;

        // Case 1: wrong deposit should revert
        try smartLease.applyAndDeposit{value: wrongDeposit}(tokenId, 0, 1000, 5, 12) {
            Assert.ok(false, "Should revert on wrong deposit");
        } catch {}

        // Case 2: correct deposit should work
        // #sender: tenant
        smartLease.applyAndDeposit{value: correctDeposit}(tokenId, 0, 1000, 5, 12);

        (
            LeaseState state,
            address tenantAddr,
            uint256 monthlyRent,
            uint256 depositHeld,
            uint16 durationMonths,
            uint256 startTimestamp
        ) = smartLease.leases(tokenId);

        Assert.equal(uint(state), uint(LeaseState.Pending), "Lease state should be Pending");
        Assert.equal(tenantAddr, tenant, "Tenant address mismatch");
        Assert.equal(monthlyRent, rent, "Monthly rent mismatch");
        Assert.equal(depositHeld, correctDeposit, "Deposit mismatch");
        Assert.equal(durationMonths, 12, "Duration mismatch");
        Assert.equal(startTimestamp, 0, "Start timestamp should be 0 before confirmation");
    }

    /// @notice Tests the lease confirmation and NFT escrow (Requirement #3)
    function test_4_ConfirmLease() public {
        owner = TestsAccounts.getAccount(0);
        landlord = TestsAccounts.getAccount(1);
        tenant = TestsAccounts.getAccount(2);

        // #sender: owner
        smartLease.mintProperty(landlord, "Oslo Center", 100, 3, 2020, 12 ether, 90);

        uint256 tokenId = 0;
        uint256 rent = smartLease.calculateMonthlyPrice(tokenId, 0, 1000, 5, 12);
        uint256 deposit = rent * 3;

        // #sender: tenant
        smartLease.applyAndDeposit{value: deposit}(tokenId, 0, 1000, 5, 12);

        // Landlord must approve and confirm
        // #sender: landlord
        smartLease.approve(address(smartLease), tokenId);
        smartLease.confirmLease(tokenId);

        (
            LeaseState state,
            address tenantAddr,
            uint256 monthlyRent,
            uint256 depositHeld,
            uint16 durationMonths,
            uint256 startTimestamp
        ) = smartLease.leases(tokenId);

        Assert.equal(uint(state), uint(LeaseState.Active), "Lease should be Active after confirmation");
        Assert.equal(smartLease.ownerOf(tokenId), address(smartLease), "NFT must be held in escrow by contract");
        Assert.ok(startTimestamp > 0, "Start timestamp should be set");
        Assert.equal(tenantAddr, tenant, "Tenant still should be correct");
        Assert.equal(monthlyRent, rent, "Monthly rent mismatch after confirmation");
        Assert.equal(depositHeld, deposit, "Deposit mismatch after confirmation");
    }


    /// @notice Tests the default protection mechanism (Requirement #4)
    function test_5_ClaimDefault() public {
        // To be completed:
        // 1. Simulate a fully active lease: mint -> apply -> approve -> confirm.
        // 2. Attempt to call claimDefault BEFORE the due date and assert that it reverts.
        // 3. (Advanced) Simulate the passage of time if required by the implementation.
        // 4. Call claimDefault AFTER the due date and assert that it succeeds.
    }
}