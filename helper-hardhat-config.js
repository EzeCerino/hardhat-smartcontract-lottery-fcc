const { ethers } = require("hardhat")

const networkConfig = {
    4: {
        name: "rinkeby",
    },
    5: {
        name: "goreli",
        VRFCoordinatorV2: "0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionID: "3661",
        callbackGasLimit: "500000",
        KeepInterval: "60",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        callbackGasLimit: "500000",
        KeepInterval: "60",
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = { networkConfig, developmentChains }
