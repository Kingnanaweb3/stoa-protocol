// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StoaReputation.sol";
import "./StoaRegistry.sol";

contract StoaSettlement {

    StoaReputation public reputationContract;
    StoaRegistry public registryContract;
    address public escrowContract;
    address public owner;

    enum JobStatus { Pending, Completed, Failed, Disputed }

    struct Settlement {
        address poster;
        address fulfiller;
        uint256 amount;
        bytes32 outputHash;
        JobStatus status;
        uint256 deadline;
        bool exists;
    }

    mapping(bytes32 => Settlement) public settlements;

    event JobSettled(bytes32 indexed jobId, address fulfiller, uint256 amount);
    event JobFailed(bytes32 indexed jobId, address fulfiller);
    event EscrowContractSet(address escrowContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "Not escrow contract");
        _;
    }

    constructor(
        address _reputationContract,
        address _registryContract
    ) {
        owner = msg.sender;
        reputationContract = StoaReputation(_reputationContract);
        registryContract = StoaRegistry(_registryContract);
    }

    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
        emit EscrowContractSet(_escrow);
    }

    function createSettlement(
        bytes32 jobId,
        address poster,
        address fulfiller,
        uint256 amount,
        uint256 deadline
    ) external onlyEscrow {
        require(!settlements[jobId].exists, "Settlement already exists");
        require(registryContract.isRegistered(fulfiller), "Fulfiller not registered");

        settlements[jobId] = Settlement({
            poster: poster,
            fulfiller: fulfiller,
            amount: amount,
            outputHash: bytes32(0),
            status: JobStatus.Pending,
            deadline: deadline,
            exists: true
        });
    }

    function submitOutput(
        bytes32 jobId,
        bytes32 outputHash
    ) external {
        Settlement storage s = settlements[jobId];
        require(s.exists, "Settlement not found");
        require(s.fulfiller == msg.sender, "Not the fulfiller");
        require(s.status == JobStatus.Pending, "Job not pending");
        require(block.timestamp <= s.deadline, "Deadline passed");

        s.outputHash = outputHash;
        s.status = JobStatus.Completed;

        // Update reputation — success
        reputationContract.updateReputation(msg.sender, true, s.amount);

        emit JobSettled(jobId, msg.sender, s.amount);
    }

    function failJob(bytes32 jobId) external {
        Settlement storage s = settlements[jobId];
        require(s.exists, "Settlement not found");
        require(s.status == JobStatus.Pending, "Job not pending");
        require(block.timestamp > s.deadline, "Deadline not passed yet");

        s.status = JobStatus.Failed;

        // Update reputation — failure
        reputationContract.updateReputation(s.fulfiller, false, 0);

        // Slash the fulfiller's stake
        registryContract.slash(s.fulfiller, s.amount / 10);

        emit JobFailed(jobId, s.fulfiller);
    }

    function getSettlement(bytes32 jobId)
        external
        view
        returns (
            address poster,
            address fulfiller,
            uint256 amount,
            JobStatus status,
            uint256 deadline,
            bytes32 outputHash
        )
    {
        require(settlements[jobId].exists, "Settlement not found");
        Settlement memory s = settlements[jobId];
        return (s.poster, s.fulfiller, s.amount, s.status, s.deadline, s.outputHash);
    }
}