// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StoaReputation {

    // The owner is the Settlement contract
    // Only it can update scores
    address public settlementContract;
    address public registryContract;
    address public owner;

    struct ReputationData {
        uint256 score;           // 0-100
        uint256 jobsCompleted;
        uint256 jobsFailed;
        uint256 totalEarned;     // in USDC (6 decimals)
        bool exists;
    }

    mapping(address => ReputationData) public reputations;

    event ReputationUpdated(address indexed agent, uint256 newScore, bool success);
    event SettlementContractSet(address settlementContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlySettlement() {
        require(msg.sender == settlementContract, "Not settlement contract");
        _;
    }

    modifier onlyRegistry() {
        require(msg.sender == registryContract, "Not registry contract");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Called once after Registry contract is deployed
    function setRegistryContract(address _registry) external onlyOwner {
        registryContract = _registry;
    }

    // Called once after Settlement contract is deployed
    function setSettlementContract(address _settlement) external onlyOwner {
        settlementContract = _settlement;
        emit SettlementContractSet(_settlement);
    }

    // Initialize reputation when agent registers
    function initializeAgent(address agent) external onlyRegistry {
        require(!reputations[agent].exists, "Agent already exists");
        reputations[agent] = ReputationData({
            score: 50,       // start at neutral 50
            jobsCompleted: 0,
            jobsFailed: 0,
            totalEarned: 0,
            exists: true
        });
    }

    // Called by Settlement after every job
    function updateReputation(
        address agent,
        bool success,
        uint256 amountEarned
    ) external onlySettlement {
        require(reputations[agent].exists, "Agent not found");

        ReputationData storage rep = reputations[agent];

        if (success) {
            rep.jobsCompleted += 1;
            rep.totalEarned += amountEarned;
            // Score goes up, capped at 100
            if (rep.score + 5 > 100) {
                rep.score = 100;
            } else {
                rep.score += 5;
            }
        } else {
            rep.jobsFailed += 1;
            // Score goes down, floored at 0
            if (rep.score < 10) {
                rep.score = 0;
            } else {
                rep.score -= 10;
            }
        }

        emit ReputationUpdated(agent, rep.score, success);
    }

    // Anyone can read an agent's reputation
    function getReputation(address agent) 
        external 
        view 
        returns (
            uint256 score,
            uint256 jobsCompleted,
            uint256 jobsFailed,
            uint256 totalEarned
        ) 
    {
        require(reputations[agent].exists, "Agent not found");
        ReputationData memory rep = reputations[agent];
        return (rep.score, rep.jobsCompleted, rep.jobsFailed, rep.totalEarned);
    }
}