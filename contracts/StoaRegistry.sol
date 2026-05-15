// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StoaReputation.sol";

contract StoaRegistry {

    StoaReputation public reputationContract;
    address public owner;

    struct Agent {
        address wallet;
        string[] capabilities;
        string chainOrigin;
        uint256 stakedAmount;    // USDC in 6 decimals
        bool active;
        bool exists;
    }

    mapping(address => Agent) public agents;
    address[] public agentList;

    event AgentRegistered(
        address indexed agent,
        string[] capabilities,
        string chainOrigin,
        uint256 stakedAmount
    );

    event AgentDeactivated(address indexed agent);
    event StakeSlashed(address indexed agent, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _reputationContract) {
        owner = msg.sender;
        reputationContract = StoaReputation(_reputationContract);
    }

    function register(
        string[] memory capabilities,
        string memory chainOrigin,
        uint256 stakedAmount
    ) external {
        require(!agents[msg.sender].exists, "Already registered");
        require(capabilities.length > 0, "Must have at least one capability");
        require(stakedAmount > 0, "Must stake USDC");

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            capabilities: capabilities,
            chainOrigin: chainOrigin,
            stakedAmount: stakedAmount,
            active: true,
            exists: true
        });

        agentList.push(msg.sender);

        // Initialize their reputation score
        reputationContract.initializeAgent(msg.sender);

        emit AgentRegistered(msg.sender, capabilities, chainOrigin, stakedAmount);
    }

    function slash(address agent, uint256 amount) external onlyOwner {
        require(agents[agent].exists, "Agent not found");
        require(agents[agent].stakedAmount >= amount, "Insufficient stake");

        agents[agent].stakedAmount -= amount;

        if (agents[agent].stakedAmount == 0) {
            agents[agent].active = false;
        }

        emit StakeSlashed(agent, amount);
    }

    function deactivate(address agent) external onlyOwner {
        require(agents[agent].exists, "Agent not found");
        agents[agent].active = false;
        emit AgentDeactivated(agent);
    }

    function isRegistered(address agent) external view returns (bool) {
        return agents[agent].exists && agents[agent].active;
    }

    function getAgent(address agent)
        external
        view
        returns (
            string[] memory capabilities,
            string memory chainOrigin,
            uint256 stakedAmount,
            bool active
        )
    {
        require(agents[agent].exists, "Agent not found");
        Agent memory a = agents[agent];
        return (a.capabilities, a.chainOrigin, a.stakedAmount, a.active);
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
}