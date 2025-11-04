// SPDX-License-Identifier: GPL-3.0
        
pragma solidity >=0.4.22 <0.9.0;

import "remix_tests.sol"; 
import "remix_accounts.sol";
import "../contracts/SmartLease.sol";

contract SmartLeaseTest {
    SmartLease smartLease;
    address owner = TestsAccounts.getAccount(0);
    address landlord = TestsAccounts.getAccount(1);

    function beforeEach() public {
        smartLease = new SmartLease();
    }

    function testMintProperty() public {
        // #sender: owner
        smartLease.mintProperty(landlord, "Oslo", 100, 3, 2020, 60 ether, 95);
        Assert.equal(smartLease.ownerOf(0), landlord, "NFT should be owned by the landlord");
    }
}