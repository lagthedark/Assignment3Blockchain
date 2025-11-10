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
-   [x] **2. Dynamic Pricing**: Implement the `computeMonthlyRent` view function.
-   [x] **3. Fair Exchange**: Implement `applyAndDeposit` and `confirmLease` functions, including NFT escrow.
-   [x] **4. Default Protection**: Implement `claimDefault` function.
-   [x] **5. End-of-Lease**: Implement `payRent`, `terminateLease`, and `extendLease` functions.

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
│   └── SmartLease_test.sol # Automated tests for contract functions
├── pdf/                    # Assignment documents
└── ...                     # Other config and supporting files
```

### Key File Explanations:
*   **`contracts/SmartLease.sol`**: The single source of truth for all on-chain logic.
*   **`scripts/deploy.ts`**: The main script to run for deployment. It's kept simple and calls the helper library.
*   **`scripts/ethers-lib.ts`**: A helper library containing the reusable `deploy` function. This separates the complex deployment logic from the simple act of running the deployment.
*   **`scripts/scenario.ts`**: The script to run for the final presentation. It will execute a full user story.
*   **`tests/smartlease.test.js`**: Contains all unit tests. Essential for verifying contract correctness.

## 4. Remix IDE Web Workflow

This project is designed to be developed, tested, and demonstrated **entirely within the Remix IDE web interface**.

### A. Setup
1.  Clone the project into a Remix workspace using the "Clone" feature on the homepage with the GitHub URL.
2.  Work inside that workspace.

### B. Development Cycle
1.  **Code**: Edit `contracts/SmartLease.sol`.
2.  **Compile**:
    -   Go to the `Solidity Compiler` tab.
    -   Select the correct compiler version (e.g., `0.8.26`).
    -   Compile `SmartLease.sol`.
3.  **Test**:
    -   Go to the `Solidity Unit Testing` tab.
    -   Select the `tests/` directory.
    -   Click "Run" to execute the tests in `SmartLease_test.sol`.

### C. Deployment and Demo
1.  **Deploy to a Testnet**:
    -   In the `Deploy & Run Transactions` tab, select an environment (e.g., "Injected Provider - MetaMask") connected to a testnet like Sepolia.
    -   Deploy the `SmartLease` contract.
    -   Copy the deployed contract address.
2.  **Run Demo Scenario**:
    -   Alternatively, for a quick demo, run the scripts. Navigate to the `File Explorer`.
    -   Right-click `scripts/deploy.ts` -> `Run`.
    -   Update `scripts/scenario.ts` with the new address if needed.
    -   Right-click `scripts/scenario.ts` -> `Run` to show the full simulation in the terminal.

  