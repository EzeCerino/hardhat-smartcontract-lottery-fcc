const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", function () {
          let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainID = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              it("Initialize Raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  // const interval = await raffle.getInterval()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainID]["KeepInterval"])
              })
          })

          describe("enter Raffle", function () {
              it("revert when you dont pay enough", async function () {
                  expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEthEntered")
              })
              it("store the players correctly", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emit an event when enters", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("revert when the raffle is CALCULATING", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //vamos a simular que somos chainlink y hacemos el perform Upkeep
                  await raffle.performUpkeep([])
                  expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })
          describe("checkUpKeep", function () {
              it("return false if people has not enter any money", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //callstatic simulate calling a function without sendind a transaction
                  const { upKeepNeeded } = raffle.callStatic.checkUpkeep([])
                  assert(!upKeepNeeded)
              })
              it("return false if raffle is not open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep([])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upKeepNeeded, false)
              })
              it("return false if if did not pass enough time", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upKeepNeeded)
              })
              it("return true if everythinh is correct", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(upKeepNeeded)
              })
          })
          describe("perform UpKeep", function () {
              it("can only run whe checkupkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep([])
                  assert(tx)
              })
              it("revert when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpKeepNotNeeded"
                  )
              })
              it("updates the raffle state, emit event and call VRFCoordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep([])
                  const txReciept = await txResponse.wait(1)
                  const requesID = await txReciept.events[1].args.requestID
                  const raffleState = await raffle.getRaffleState()
                  assert(requesID.toNumber() > 0)
                  assert(raffleState.toString() == "1")
              })
          })
          describe("fullfill randomwords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after perfrom upkeep", async function () {
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      VRFCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistent request")
              })
              it("picks a winner, reset lottery and send money", async function () {
                  const additionalEntrants = 3
                  const entrantsIndex = 1
                  const accounts = await ethers.getSigners()
                  for (let i = entrantsIndex; i < entrantsIndex + additionalEntrants; i++) {
                      //console.log(i)
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLastestTimeStamp()

                  //primero seteamos la promesa y adentro de la promesa seteamos el listener.
                  //el listener va a escuchar hasta que un evento dispare la ejecucion del codigo.
                  //Dentro de la promesa, pero despues del listener, hacemos un mock y disparamos el numero random.
                  await new Promise(async (resolve, reject) => {
                      //Aca setemaos el listener en forma de try-catch
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the Event!!")
                          //adentro del try va el test code.
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              //console.log(recentWinner)
                              //console.log(accounts[0].address)
                              //console.log(accounts[1].address)
                              //console.log(accounts[2].address)
                              //console.log(accounts[3].address)
                              const winnerEndingBalance = await accounts[1].getBalance()
                              const raffleState = await raffle.getRaffleState()
                              const endTimeStamp = await raffle.getLastestTimeStamp()
                              //assert los players fueron reseteados
                              const numplayers = await raffle.getNumberOfPlayer()
                              assert.equal(numplayers.toString(), "0")
                              //assert raffle state reset
                              assert.equal(raffleState.toString(), "0")
                              //assert time stamp
                              assert(endTimeStamp > startingTimeStamp)

                              //asserting that the winner is getting payed
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrants)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      //aca hacemos un mock para disparar el ganador
                      const tx = await raffle.performUpkeep([])
                      //console.log("up to perform Up keep")
                      const txReceipt = await tx.wait(1)
                      //console.log("after wait a block")
                      const winnerStartingBalance = await accounts[1].getBalance()
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestID,
                          raffle.address
                      )
                  })
              })
          })
      })
