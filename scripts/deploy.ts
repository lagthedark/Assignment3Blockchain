import { deploy } from './ethers-lib'

(async () => {
  try {
    const result = await deploy('SmartLease', [])
    console.log(`SmartLease contract deployed at: ${result.address}`)
  } catch (e) {
    console.log(e.message)
  }
})()
