import { ethers } from 'ethers';

const printStep = (step, text) => console.log(`\n--- STEP ${step}: ${text} ---\n`);

(async () => {
  try {
    const CONTRACT_ADDRESS = "0xABC"; // <-- DEPLOYED CONTRACT ADDRESS
    const CONTRACT_ABI = [ /* ... Paste ABI from Remix compiler here ... */ ];

    // Connect to the provider
    const provider = new ethers.providers.Web3Provider(web3Provider);
    const accounts = await provider.listAccounts();

    // Define actors
    const ownerSigner = provider.getSigner(0);
    const landlordSigner = provider.getSigner(1);
    const tenantSigner = provider.getSigner(2);

    const ownerAddress = await ownerSigner.getAddress();
    const landlordAddress = await landlordSigner.getAddress();
    const tenantAddress = await tenantSigner.getAddress();

    console.log('Owner/Admin:', ownerAddress);
    console.log('Landlord:', landlordAddress);
    console.log('Tenant:', tenantAddress);

    // Create a contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ownerSigner);


    // --- DEMO SCENARIO ---

    printStep(1, "The platform Owner mints a new property NFT for a Landlord.");
    // To be completed:
    // const txMint = await contract.connect(ownerSigner).mintProperty(...);
    // await txMint.wait();
    // console.log("NFT with Token ID 0 minted for the Landlord.");

    
    printStep(2, "The Tenant applies to lease the property and deposits the security funds.");
    // To be completed:
    // 1. Connect as the tenant: contract.connect(tenantSigner)
    // 2. Calculate the required deposit (by calling the `computeMonthlyRent` view function)
    // 3. Call `applyAndDeposit`, sending the correct deposit with the transaction: { value: ... }

    
    printStep(3, "The Landlord confirms the lease.");
    // To be completed:
    // 1. Connect as the landlord: contract.connect(landlordSigner)
    // 2. CRITICAL: The landlord must first approve the contract to manage the NFT.
    //    const txApprove = await contract.connect(landlordSigner).approve(CONTRACT_ADDRESS, 0); // tokenId is 0
    //    await txApprove.wait();
    // 3. Call `confirmLease`

    
    printStep(4, "The Tenant pays one month's rent.");
    // To be completed:
    
    
    printStep(5, "Default Scenario: The Landlord claims the deposit.");
    // To be completed:
    // (For the demo, explain that time should pass, then show the call to `claimDefault`)

    
    console.log("\nScenario completed!");

  } catch (e) {
    console.error("Scenario failed:", e.message);
  }
})();