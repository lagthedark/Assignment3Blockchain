// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// OpenZeppelin ERC-721 + Ownable
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

enum LeaseState {
    None,
    Pending,
    Active,
    Terminated,
    Defaulted
}

contract SmartLease is ERC721, Ownable {
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

    // -------------------------------------------------------------------------
    // Task 2 — Dynamic Pricing Logic (minimal, criteria-compliant)
    // -------------------------------------------------------------------------
    /// @notice Calculates the monthly price for a property NFT using the required factors.
    /// @dev view-only: no state writes. Factors are deliberately simple but valid.
    /// @param tokenId The NFT being priced.
    /// @param currentUsage Current period usage (e.g., km, data units, etc.).
    /// @param usageCap Predefined option: usage cap for the period (pre-agreed limit).
    /// @param userScore User attribute on a 0..10 scale (better = cheaper).
    /// @param leaseDurationMonths Predefined option: lease duration in months.
    /// @return price Monthly payment in wei.
    function calculateMonthlyPrice(
        uint256 tokenId,
        uint256 currentUsage,
        uint256 usageCap,
        uint8 userScore,
        uint16 leaseDurationMonths
    ) public view returns (uint256 price) {
        require(ownerOf(tokenId) != address(0), "nonexistent token");        require(userScore <= 10, "score 0-10");
        // 1) Original value of the NFT (base)
        uint256 base = properties[tokenId].baseValue;

        // Use 1e18 fixed-point factors for simple, precise math.
        uint256 ONE = 1e18;

        // 2) Usage factor: scales up to +20% if usage reaches or exceeds the cap.
        //    usageRatio = min(currentUsage / usageCap, 1.0)
        //    usageFactor = 1.0 + usageRatio * 0.20
        uint256 denom = usageCap == 0 ? 1 : usageCap; // avoid div by zero; treat as unbounded
        uint256 usageRatio = (currentUsage * ONE) / denom;
        if (usageRatio > ONE) usageRatio = ONE; // clamp at 1.0
        uint256 usageFactor = ONE + (usageRatio / 5); // +20% max

        // 3) Condition factor: interprets 'condition' 0..100 as wear; add up to +10%
        //    (If you prefer "better condition => higher price", flip the sign.)
        uint256 cond = properties[tokenId].condition; // 0..100
        uint256 conditionFactor = ONE + (cond * 1e15); // + (cond/100)*0.10

        // 4) User attribute factor: better score reduces price (0..10 => 0..-10%)
        //    userFactor = 1.0 - score/10
        uint256 userFactor = ONE - (uint256(userScore) * 1e17); // 1 - score/10

        // 5) Duration factor: simple discount for long leases (>=12m => -10%)
        uint256 durationFactor = leaseDurationMonths >= 12 ? 9e17 : ONE; // 0.9 or 1.0

        // Combine factors; divide by 12 for monthly.
        // price = base * usageFactor * conditionFactor * userFactor * durationFactor / 1e18^4 / 12
        uint256 tmp = base;
        tmp = (tmp * usageFactor) / ONE;
        tmp = (tmp * conditionFactor) / ONE;
        tmp = (tmp * userFactor) / ONE;
        tmp = (tmp * durationFactor) / ONE;

        price = tmp / 12;
    }
}
