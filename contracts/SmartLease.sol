// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// OpenZeppelin ERC-721 + Ownable
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

enum LeaseState {
    None,
    Pending,
    Active,
    Terminated,
    Defaulted
}

contract SmartLease is ERC721, Ownable, ReentrancyGuard {
    constructor() ERC721("SmartLease Property", "SLEASE") Ownable(msg.sender) {}

    // --- Property Struct ---
    // Represents metadata for each property
    struct Property {
        address landlord;  
        string location;   
        uint256 size;      
        uint256 rooms;     
        uint256 yearBuilt; 
        uint256 baseValue; 
        uint256 condition; // 0..100 (interpreted as "wear/condition" score)
        bool isLeased;     
    }

    // --- Lease Struct ---
    // Represents lease information for each property
    struct Lease {
        LeaseState state;
        address tenant;          
        uint256 monthlyRent;     
        uint256 depositHeld;     
        uint16 durationMonths;
        uint256 startTimestamp;
        uint256 nextPaymentDueDate;
    }

    // Store properties and leases
    uint256 public nextTokenId;
    mapping(uint256 => Property) public properties;
    mapping(uint256 => Lease) public leases;

    // Event for logging property minting
    event PropertyMinted(
        uint256 indexed tokenId,
        string location,
        uint256 size,
        uint256 rooms,
        uint256 yearBuilt,
        uint256 baseValue,
        uint256 condition
    );

    event LeaseApplied(
        uint256 indexed tokenId,
        address tenant,
        uint256 deposit
    );

    event LeaseConfirmed(
        uint256 indexed tokenId,
        address landlord
    );

    event LeaseTerminated(
        uint256 indexed tokenId, 
        address tenant, 
        uint256 refunded
    );

    event NewLeaseStarted(
        uint256 indexed tokenId, 
        address tenant, 
        uint256 deposit
    );
        
    event LeaseDefaultClaimed(
        uint256 indexed tokenId,
        address indexed landlord,
        address indexed tenant,
        uint256 amountClaimed
    );

    event LeaseExtended(
        uint256 indexed tokenId,
        uint16 newDuration,
        uint256 newMonthly
    );

    // --- Mint Property NFT ---
    // Allows the landlord to mint a new property as an NFT
    function mintProperty(
        address landlord_, //Added if necessary 
        string memory location_,
        uint256 size_,
        uint256 rooms_,
        uint256 yearBuilt_,
        uint256 baseValueWei_,
        uint256 condition_ 
    ) external onlyOwner {
        require(landlord_ != address(0), "landlord required"); //Added if necessary
        require(bytes(location_).length > 0, "location required");
        require(size_ > 0, "size > 0");
        require(rooms_ > 0, "rooms > 0");
        require(yearBuilt_ >= 1800 && yearBuilt_ <= 2025, "year out of range");
        require(baseValueWei_ > 0, "baseValue > 0");
        require(condition_ <= 100, "condition 0-100");

        uint256 tokenId = nextTokenId++; // Increment the ID for each new property

        // Store property data (metadata)
        properties[tokenId] = Property({
            landlord: landlord_, //Added if necessary
            location: location_,
            size: size_,
            rooms: rooms_,
            yearBuilt: yearBuilt_,
            baseValue: baseValueWei_,
            condition: condition_,
            isLeased: false // Initially, property is not leased
        });

        // Mint NFT to the landlord
        _safeMint(landlord_, tokenId);

        emit PropertyMinted(
            tokenId,
            location_,
            size_,
            rooms_,
            yearBuilt_,
            baseValueWei_,
            condition_
        );
    }

    /// @notice Calculates the monthly rent using simple, readable factors.
    /// @dev Uses 1e18 fixed-point math for clarity. Interprets `condition` as WEAR (0..100).
    /// @param tokenId Property token to price.
    /// @param currentUsage Measured usage for the period (e.g., km, kWh, GB).
    /// @param usageCap Agreed usage cap for the period. If 0, no cap/surcharge.
    /// @param userScore Tenant score 0..10 (higher = better = cheaper).
    /// @param leaseDurationMonths Duration in months (used for basic discounts).
    function calculateMonthlyPrice(
        uint256 tokenId,
        uint256 currentUsage,
        uint256 usageCap,
        uint8 userScore,
        uint16 leaseDurationMonths
    ) public view returns (uint256 price) {
        require(ownerOf(tokenId) != address(0), "nonexistent token");
        require(userScore <= 10, "score must be 0..10");
        require(leaseDurationMonths > 0, "duration must be > 0");

        // Base price anchor: the NFT’s base value (e.g., market value) spread per month.
        uint256 base = properties[tokenId].baseValue;
        uint256 ONE  = 1e18;

        // --- Usage factor ---
        // Intuition: As you approach the cap, price can rise up to +30%.
        // If you go over the cap, add up to another +20% penalty.
        uint256 usageFactor = ONE;
        if (usageCap > 0) {
            // progress toward cap: 0.0 .. 1.0
            uint256 towardCap = _min((currentUsage * ONE) / usageCap, ONE);
            uint256 baseSurcharge = ONE + (towardCap * 30e16) / ONE; // +0..30%

            // over-cap penalty ratio: 0.0 .. (capped at 1.0)
            uint256 over = currentUsage > usageCap
                ? _min(((currentUsage - usageCap) * ONE) / usageCap, ONE)
                : 0;
            uint256 overPenalty = ONE + (over * 20e16) / ONE; // +0..20%

            // combine
            usageFactor = (baseSurcharge * overPenalty) / ONE;
        }

        // --- Condition factor (wear 0..100) ---
        // More wear → slightly higher rent (up to +20%).
        uint256 wear = _min(properties[tokenId].condition, 100);
        uint256 conditionFactor = ONE + (wear * 20e16) / 100e18; // + (wear/100)*20%

        // --- User score factor (0..10) ---
        // Better tenant → up to 15% cheaper.
        uint256 userFactor = ONE - (uint256(userScore) * 15e16) / 10; // - (score/10)*15%

        // --- Duration factor ---
        // Longer commitments get simple step discounts.
        uint256 durationFactor = ONE;
        if (leaseDurationMonths >= 24)      durationFactor = 85e16; // -15%
        else if (leaseDurationMonths >= 12) durationFactor = 90e16; // -10%
        else if (leaseDurationMonths >= 6)  durationFactor = 95e16; //  -5%

        // Combine factors then divide by 12 for monthly amount.
        // Note: sequence keeps numbers small and readable.
        uint256 tmp = base;
        tmp = (tmp * usageFactor) / ONE;
        tmp = (tmp * conditionFactor) / ONE;
        tmp = (tmp * userFactor) / ONE;
        tmp = (tmp * durationFactor) / ONE;

        price = tmp / 12;
    }

    /// @notice Applies for a lease and deposits the required amount.
    /// @param tokenId The NFT being leased.
    /// @param currentUsage Current period usage
    /// @param usageCap Predefined option: usage cap for the period (pre-agreed limit).
    /// @param userScore The tenant's attribute score (0..10).
    /// @param leaseDurationMonths Lease duration in months.
    function applyAndDeposit(
        uint256 tokenId,
        uint256 currentUsage,
        uint256 usageCap,
        uint8 userScore,
        uint16 leaseDurationMonths
    ) external payable {
        Property storage prop = properties[tokenId];
        require(!prop.isLeased, "already leased");
        require(prop.landlord != address(0), "invalid landlord");
        require(leases[tokenId].state == LeaseState.None, "lease exists");
        require(leaseDurationMonths > 0, "invalid duration");

        // Computing monthly rent
        uint256 monthly = calculateMonthlyPrice(tokenId, currentUsage, usageCap, userScore, leaseDurationMonths);

        // 3 months deposit
        uint256 requiredDeposit = monthly * 3;
        require(msg.value == requiredDeposit, "wrong deposit amount");

        // Saving lease
        leases[tokenId] = Lease({
            state: LeaseState.Pending,
            tenant: msg.sender,
            monthlyRent: monthly,
            depositHeld: msg.value,
            durationMonths: leaseDurationMonths,
            startTimestamp: 0,
            nextPaymentDueDate: 0
        });

        prop.isLeased = true;
        
        emit LeaseApplied(tokenId, msg.sender, msg.value);
    }

    /// @notice Confirms a lease request, escrowing the NFT and starting the lease.
    /// @param tokenId The NFT being leased.
    /// @dev This function is called after the tenant has applied for the lease and deposited the required amount.
    ///     The landlord must approve the NFT to the contract before calling this function.
    ///     The function will then transfer the NFT to the contract, marking the lease as 'Active', and starting the lease duration.
    function confirmLease(
        uint256 tokenId
    ) external {
        Property storage prop = properties[tokenId];
        Lease storage lease = leases[tokenId];

        require(lease.state == LeaseState.Pending, "not pending");
        require(msg.sender == prop.landlord, "only landlord");
        require(ownerOf(tokenId) == msg.sender, "landlord must own NFT");

        // The landlord must approve the contract to manage the NFT
        _transfer(msg.sender, address(this), tokenId); // escrow

        lease.state = LeaseState.Active;
        lease.startTimestamp = block.timestamp;
        lease.nextPaymentDueDate = block.timestamp + 30 days;

        emit LeaseConfirmed(tokenId, msg.sender);
    }
    
    /// @notice Pay the monthly rent for an active lease.
    /// @dev The tenant must call this function and send the exact monthly rent amount.
    ///     The function will update the next due date for the following month and forward the payment to the landlord.
    /// @param tokenId The NFT being leased.
    function payRent(uint256 tokenId) external payable nonReentrant {
        Lease storage lease = leases[tokenId];
        Property storage prop = properties[tokenId];

        require(lease.state == LeaseState.Active, "Lease is not active");
        require(msg.sender == lease.tenant, "Only the tenant can pay rent");
        require(msg.value == lease.monthlyRent, "Incorrect rent amount sent");
        require(block.timestamp <= lease.nextPaymentDueDate, "Payment is late, contact landlord");

        // Step 1 (Effect): Update the next due date for the following month
        lease.nextPaymentDueDate += 30 days;

        // Step 2 (Interaction): Forward the payment to the landlord
        (bool sent, ) = payable(prop.landlord).call{value: msg.value}("");
        require(sent, "Failed to send rent to landlord");
    }

    // compute lease expiration timestamp
    function leaseExpirationTimestamp(uint256 tokenId) public view returns (uint256) {
        Lease storage lease = leases[tokenId];
        if (lease.state != LeaseState.Active) return 0;
        // Approximate month as 30 days
        return lease.startTimestamp + (uint256(lease.durationMonths) * 30 days);
    }

    // helper: whether lease expired
    function isLeaseExpired(uint256 tokenId) public view returns (bool) {
        Lease storage lease = leases[tokenId];
        if (lease.state != LeaseState.Active) return false;
        return block.timestamp >= leaseExpirationTimestamp(tokenId);
    }

    /// @notice Terminates an active lease and finalizes the agreement.
    /// @dev Can only be called by the tenant after the lease period has expired.
    ///      This function:
    ///      - Marks the lease as terminated,
    ///      - Transfers the property NFT back to the landlord (if held in escrow),
    ///      - Refunds the security deposit to the tenant,
    ///      - Clears lease metadata to save gas on future reuses.
    /// @param tokenId The token ID of the leased property NFT.
    function terminateLease(uint256 tokenId) external nonReentrant {
        Lease storage lease = leases[tokenId];
        Property storage prop = properties[tokenId];

        // Checks
        require(lease.state == LeaseState.Active, "lease not active");
        require(msg.sender == lease.tenant, "only tenant");
        require(isLeaseExpired(tokenId), "lease not yet expired");

        // Read values to memory before state changes
        uint256 refund = lease.depositHeld;
        address tenantAddress = lease.tenant;
        address landlordAddress = prop.landlord;

        // Effects
        prop.isLeased = false;
        delete leases[tokenId]; // This resets the lease state to None.

        emit LeaseTerminated(tokenId, tenantAddress, refund);

        // Interactions
        if (ownerOf(tokenId) == address(this)) {
            _transfer(address(this), landlordAddress, tokenId);
        } 

        if (refund > 0) {
            (bool ok, ) = payable(tenantAddress).call{value: refund}("");
            require(ok, "refund failed");
        }
    }

    /// @notice Extends an active lease for additional months with dynamic price adjustment.
    /// @dev Can only be called by the current tenant while the lease is active.
    ///      This recalculates rent and adjusts the deposit accordingly:
    ///      - If the new deposit exceeds the previous one, the tenant must send the difference.
    ///      - If the new deposit is smaller, the tenant is refunded the excess.
    /// @param tokenId The property NFT being leased.
    /// @param extensionMonths Number of months to extend the lease.
    /// @param currentUsage Current usage data (used in rent recalculation).
    /// @param usageCap The predefined usage limit.
    /// @param userScore Tenant’s reliability score (0–10).
    function extendLease(
        uint256 tokenId,
        uint16 extensionMonths,
        uint256 currentUsage,
        uint256 usageCap,
        uint8 userScore
    ) external payable {
        require(extensionMonths > 0, "extension > 0");
        Lease storage lease = leases[tokenId];

        require(lease.state == LeaseState.Active, "lease not active");
        require(msg.sender == lease.tenant, "only tenant");

        // Recalculate monthly rent with new total duration (existing + extension)
        uint16 newDuration = lease.durationMonths + extensionMonths;
        uint256 newMonthly = calculateMonthlyPrice(tokenId, currentUsage, usageCap, userScore, newDuration);

        uint256 newDepositRequired = newMonthly * 3;
        uint256 oldDeposit = lease.depositHeld;

        // Adjust deposit based on new rent
        if (newDepositRequired > oldDeposit) {
            uint256 delta = newDepositRequired - oldDeposit;
            require(msg.value == delta, "must send top-up deposit");
            lease.depositHeld = oldDeposit + msg.value;
        } else {
            uint256 refund = oldDeposit - newDepositRequired;
            lease.depositHeld = newDepositRequired;
            if (refund > 0) {
                (bool ok, ) = payable(lease.tenant).call{value: refund}("");
                require(ok, "refund failed");
            }
            require(msg.value == 0, "no ETH expected");
        }

        // Update lease
        lease.durationMonths = newDuration;
        lease.monthlyRent = newMonthly;

        emit LeaseExtended(tokenId, extensionMonths, newMonthly);
    }

    /// @notice Starts a brand new lease for a different property NFT.
    /// @dev Used when a tenant moves from one property to another.
    ///      The function ensures that the previous lease is not active before proceeding.
    ///      It then calculates the new rent and requires a correct deposit for the new property.
    /// @param oldTokenId The previous leased NFT (must not be active).
    /// @param newTokenId The new property NFT to be leased.
    /// @param currentUsage Current usage data (for rent calculation).
    /// @param usageCap Predefined usage limit for the lease.
    /// @param userScore Tenant’s performance or reliability score (0–10).
    /// @param leaseDurationMonths Duration of the new lease in months.
    function startNewLease(
        uint256 oldTokenId,
        uint256 newTokenId,
        uint256 currentUsage,
        uint256 usageCap,
        uint8 userScore,
        uint16 leaseDurationMonths
    ) external payable {
        if (leases[oldTokenId].state == LeaseState.Active) {
            revert("previous lease still active");
        }

        Property storage propNew = properties[newTokenId];
        require(!propNew.isLeased, "new token already leased");
        require(propNew.landlord != address(0), "invalid landlord on new token");
        require(leaseDurationMonths > 0, "invalid duration");

        uint256 monthly = calculateMonthlyPrice(newTokenId, currentUsage, usageCap, userScore, leaseDurationMonths);
        uint256 requiredDeposit = monthly * 3;
        require(msg.value == requiredDeposit, "wrong deposit for new lease");

        // Create the new lease 
        leases[newTokenId] = Lease({
            state: LeaseState.Pending,
            tenant: msg.sender,
            monthlyRent: monthly,
            depositHeld: msg.value,
            durationMonths: leaseDurationMonths,
            startTimestamp: 0,
            nextPaymentDueDate: 0
        });

        propNew.isLeased = true;

        emit NewLeaseStarted(newTokenId, msg.sender, msg.value);
    }

    /// @notice Allows the landlord to claim the deposit and terminate the lease
    ///        if the tenant has missed a payment. This function can only be called
    ///        by the landlord, and only if the lease is active and the rent
    ///        period has been missed.
    /// @param tokenId The token ID of the property NFT.
    function claimDefault(uint256 tokenId) external nonReentrant {
        Property storage prop = properties[tokenId];
        Lease storage lease = leases[tokenId];

        require(lease.state == LeaseState.Active, "lease not active");
        require(prop.landlord == msg.sender, "only landlord");
        require(lease.startTimestamp != 0, "lease not started");
        require(block.timestamp > lease.nextPaymentDueDate, "Rent is not overdue yet");
        uint256 amountToClaim = lease.depositHeld;
        lease.depositHeld = 0;
        lease.state = LeaseState.Defaulted;
        prop.isLeased = false;

        emit LeaseDefaultClaimed(tokenId, prop.landlord, lease.tenant, amountToClaim);

        delete leases[tokenId];

        // Return NFT to landlord if in escrow
        if (ownerOf(tokenId) == address(this)) {
            _transfer(address(this), prop.landlord, tokenId);
        }

        // Transfer deposit to landlord
        if (amountToClaim > 0) {
            (bool sent, ) = payable(prop.landlord).call{value: amountToClaim}("");
            require(sent, "deposit transfer failed");
        }

    }

    /// @dev Helper function to get the minimum of two uint256 values.
    /// @param a The first value to compare.
    /// @param b The second value to compare.
    /// @return The minimum of a and b.
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
}
}
