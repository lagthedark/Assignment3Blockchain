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

    // Tests 3 and 4 are located in the hardhat tests and are not replicated here.

    function test_5_ClaimDefault() public {
        // To be completed:
        // 1. Simulate a fully active lease: mint -> apply -> approve -> confirm.
        // 2. Attempt to call claimDefault BEFORE the due date and assert that it reverts.
        // 3. (Advanced) Simulate the passage of time if required by the implementation.
        // 4. Call claimDefault AFTER the due date and assert that it succeeds.
    }
}