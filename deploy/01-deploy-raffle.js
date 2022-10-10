const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let VRFCoordinatorV2Address, subscriptionID

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        //log("Get Contract")
        VRFCoordinatorV2Address = VRFCoordinatorV2Mock.address
        const txResponse = await VRFCoordinatorV2Mock.createSubscription()
        const txReciept = await txResponse.wait(1)
        subscriptionID = txReciept.events[0].args.subId
        //log(`subsID: ${subscriptionID}`)
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionID, VRF_SUB_FUND_AMOUNT)
    } else {
        VRFCoordinatorV2Address = networkConfig[chainId]["VRFCoordinatorV2"]
        subscriptionID = networkConfig[chainId]["subscriptionID"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["KeepInterval"]

    /* log(`Address ${VRFCoordinatorV2Address}`)
    log(`entranceFee: ${entranceFee}`)
    log(`gaslane: ${gasLane}`)
    log(`subsID: ${subscriptionID}`)
    log(`CallBackLimit: ${callbackGasLimit}`)
    log(`:interval: ${interval}`)*/

    const args = [
        VRFCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionID,
        callbackGasLimit,
        interval,
    ]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args, //for the constructor
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    /*if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying......")
        await verify(raffle.address, args)
        log("---------------------------------------------------------------------")
    }*/
}

module.exports.tags = ["all", "raffle"]
