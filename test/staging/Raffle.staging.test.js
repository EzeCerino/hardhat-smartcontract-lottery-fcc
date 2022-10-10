const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Satging Test", function () {
          let raffle, raffleEntranceFee, deployer
          //const chainID = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })
          describe("fullfill randomwords", function () {
              it("Can work with a live network, get a random winner", async function () {
                  const startingTimeStamp = await raffle.getLastestTimeStamp()
                  console.log(`starting Time Stamp ${startingTimeStamp}`)
                  const accounts = await ethers.getSigners()
                  await new Promise(async (resolve, reject) => {
                      console.log("1")
                      //Aca setemaos el listener en forma de try-catch
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the Event!!")
                          //adentro del try va el test code.
                          try {
                              console.log("entering the try")
                              const recentWinner = await raffle.getRecentWinner()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const raffleState = await raffle.getRaffleState()
                              const endTimeStamp = await raffle.getLastestTimeStamp()
                              console.log(`last time Stamp ${endTimeStamp}`)
                              console.log(`Raffle State is: ${raffleState}`)

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState.toString(), "0")
                              assert(endTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              )
                              resolve()
                          } catch (e) {
                              reject(e)
                          }
                      })
                      console.log("Entering Raffle...")
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
                      await tx.wait(1)
                      const interval = await raffle.getInterval()
                      console.log(`interval: ${interval}`)
                      console.log("Entered lottery")
                      const winnerStartingBalance = await accounts[0].getBalance()
                      console.log(`The current Balance is ${winnerStartingBalance}`)
                  })
              })
          })
      })
