//SPDX-License-Identifier: MIT

//Raffle
// Enter the lotery with some amount
//Pick a random winner
//Winner to be selected every X amount of time
//Chainlink Oracle -> Ramdomness and automated execution!

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughEthEntered();
error Raffle__TransferToWinnerFailed();
error Raffle__NotOpen();
error Raffle__UpKeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/**
 * @title A Sample Raffle Contract
 * @author EzeCerino
 * @notice this contract is for creating a decentralize smart contract automated lottery
 * @dev this implements Chainlink VRF and Keepers
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /*Types Declarations*/
    enum RaffleState {
        OPEN,
        CALCULATING
    } // this is actually an uint where 0=OPEN. 2=CALCULATING and so...

    /*State Variable*/
    uint256 private immutable i_entranceFee; //minimum value to enter
    address payable[] private s_players; //array of players
    VRFCoordinatorV2Interface private immutable i_VRFCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionID;
    uint32 private immutable i_callBackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    uint256 private immutable i_interval;

    /*Lottery variable*/
    address private s_recentWinner;
    RaffleState private s_rafflestate;
    uint256 private s_timeStamp;

    /*Events*/
    event RaffleEnter(address indexed player); //emit the player address
    event RaquestedRaffleWinner(uint256 indexed requestID);
    event WinnerPicked(address indexed winnerAddress);

    /*Functions*/
    constructor(
        address VRFCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionID,
        uint32 callBackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(VRFCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_VRFCoordinator = VRFCoordinatorV2Interface(VRFCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionID = subscriptionID;
        i_callBackGasLimit = callBackGasLimit;
        s_rafflestate = RaffleState.OPEN;
        s_timeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEntered();
        }
        if (s_rafflestate != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev this is the function that the chainlink keeper nodes calls
     * The following should be true in order to return a true statement
     * 1. seted time interval sould be passed
     * 2. the lottery should have at leat 1 person and some eth
     * 3. the subscription should be founded with Link
     * 4. The lottery should be in a Open State
     */
    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        override
        returns (
            bool upKeepNeeded,
            bytes memory /*performData*/
        )
    {
        bool isOpen = (RaffleState.OPEN == s_rafflestate);
        bool timePassed = ((block.timestamp - s_timeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    //antes era la request random winner function!!
    function performUpkeep(
        bytes calldata /*performData*/
    ) external override {
        //request random numner
        //once we get it, do somthing
        (bool upKeepNeeded, ) = checkUpkeep("");
        if (!upKeepNeeded) {
            revert Raffle__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_rafflestate)
            );
        }
        s_rafflestate = RaffleState.CALCULATING;
        uint256 requestID = i_VRFCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionID,
            REQUEST_CONFIRMATIONS,
            i_callBackGasLimit,
            NUM_WORDS
        );
        emit RaquestedRaffleWinner(requestID);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_rafflestate = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_timeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferToWinnerFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /*view/Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_rafflestate;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayer() public view returns (uint256) {
        return s_players.length;
    }

    function getLastestTimeStamp() public view returns (uint256) {
        return s_timeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
