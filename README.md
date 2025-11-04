# SmartLease: NFT-Based House Leasing System
**Internal development guide for the TTM4195 project.**

## 1. Core Functionality

-   **System**: A blockchain-based leasing system using a self-executing smart contract.
-   **Asset**: Properties are represented as ERC-721 NFTs with on-chain metadata (location, size, value, condition).
-   **Actors**: `Landlord` (mints NFTs) and `Tenant` (leases NFTs).
-   **Mechanics**:
    -   Dynamic rent calculation via a `view` function.
    -   Fair exchange ensured by a 3-month rent deposit and dual confirmation.
    -   Landlord protection through deposit seizure on tenant default.
    -   End-of-lease options including termination and extension.

## 2. Implementation Checklist

-   [x] **1. NFT Modeling**: Implement ERC-721 with `Property` struct and `mintProperty` function.
-   [ ] **2. Dynamic Pricing**: Implement the `computeMonthlyRent` view function.
-   [ ] **3. Fair Exchange**: Implement `applyAndDeposit` and `confirmLease` functions, including NFT escrow.
-   [ ] **4. Default Protection**: Implement `claimDefault` function.
-   [ ] **5. End-of-Lease**: Implement `payRent`, `terminateLease`, and `extendLease` functions.

## 3. Project Structure and File Roles

```
.
├── contracts/
│   └── SmartLease.sol      # Main contract (NFT + Leasing logic)
├── scripts/
│   ├── deploy.ts           # Simple script that initiates the deployment
│   ├── ethers-lib.ts       # Reusable helper with the core deployment 
│   └── scenario.ts         # Simulates E2E user flow for the demo
├── tests/
│   └── smartlease.test.js  # Automated tests for contract functions
├── pdf/                    # Assignment documents
└── ...                     # Other config and supporting files
```

### Key File Explanations:
*   **`contracts/SmartLease.sol`**: The single source of truth for all on-chain logic.
*   **`scripts/deploy.ts`**: The main script to run for deployment. It's kept simple and calls the helper library.
*   **`scripts/ethers-lib.ts`**: A helper library containing the reusable `deploy` function. This separates the complex deployment logic from the simple act of running the deployment.
*   **`scripts/scenario.ts`**: The script to run for the final presentation. It will execute a full user story.
*   **`tests/smartlease.test.js`**: Contains all unit tests. Essential for verifying contract correctness.

## 4. Remix IDE Workflow

This project is built to be run entirely within Remix IDE.

### A. Setup (One-time)
1.  Clone the repository to your local machine.
2.  Connect the local project folder to Remix IDE using `remixd`.
3.  In Remix, ensure you are in the connected `localhost` workspace.

### B. Development Cycle
1.  **Code**: Edit `contracts/SmartLease.sol`.
2.  **Compile**:
    -   Go to the `Solidity Compiler` tab.
    -   Select the correct compiler version (e.g., `0.8.26`).
    -   Compile `SmartLease.sol`. Fix any errors.
3.  **Test**:
    -   Go to the `Solidity Unit Testing` tab.
    -   Select the `tests/` directory and run the `smartlease.test.js` file.
    -   Ensure all tests pass before proceeding.

### C. Deployment and Demo
Ensure the `TypeScript` and `Ethers.js` plugins are active in Remix.
1.  **Deploy to a Testnet**:
    -   In the Remix File Explorer, navigate to `scripts/`.
    -   Right-click `deploy.ts` -> `Run`.
    -   The deployed contract address will appear in the Remix terminal. Copy this address.
2.  **Run Demo Scenario**:
    -   Update `scenario.ts` with the new contract address if needed.
    -   Right-click `scenario.ts` -> `Run`.
    -   The terminal will log the entire simulation, showing the contract in action.