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
        // To be completed:
        // 1. Mint a property.
        // 2. Calculate the required deposit (3 months' rent).
        // 3. Attempt to call applyAndDeposit with an INCORRECT amount and assert that it reverts (using try/catch).
        // 4. Call applyAndDeposit with the CORRECT amount, simulating the call from the tenant.
        //    // #sender: tenant
        //    // #value: [correct deposit]
        // 5. Assert that the lease state is 'Pending' and that all lease data is stored correctly.
    }
    
    /// @notice Tests the lease confirmation and NFT escrow (Requirement #3)
    function test_4_ConfirmLease() public {
        // To be completed:
        // 1. Simulate the full flow: mint -> applyAndDeposit.
        // 2. Simulate the approval: the landlord must approve the contract to manage the NFT.
        //    // #sender: landlord
        //    smartLease.approve(address(smartLease), 0);
        // 3. Call confirmLease from the landlord's account.
        // 4. Assert that the new owner of the NFT is the contract itself (escrow).
        // 5. Assert that the lease state is 'Active'.
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