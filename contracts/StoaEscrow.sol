// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./StoaRegistry.sol";
import "./StoaSettlement.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// CCTP V2 Hook Interface
interface IMessageTransmitterHook {
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 /* sender */,
        bytes calldata messageBody
    ) external returns (bool);
}

contract StoaEscrow is IMessageTransmitterHook {

    StoaRegistry public registryContract;
    StoaSettlement public settlementContract;
    IERC20 public usdc;
    address public owner;
    address public cctpMessageTransmitter;

    struct Job {
        bytes32 jobId;
        address poster;
        address fulfiller;
        uint256 bounty;
        string task;
        string requiredCapability;
        uint256 minReputation;
        uint256 deadline;
        bool funded;
        bool released;
        bool exists;
    }

    mapping(bytes32 => Job) public jobs;
    bool private locked;
    mapping(address => uint256) public nonces;

    modifier noReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyCCTP() {
        require(msg.sender == cctpMessageTransmitter, "Only CCTP transmitter");
        _;
    }

    bytes32[] public jobList;

    event JobPosted(
        bytes32 indexed jobId,
        address indexed poster,
        uint256 bounty,
        string task,
        string requiredCapability,
        uint256 deadline
    );

    event JobAccepted(
        bytes32 indexed jobId,
        address indexed fulfiller
    );

    event PaymentReleased(
        bytes32 indexed jobId,
        address indexed fulfiller,
        uint256 amount
    );

    event PaymentRefunded(
        bytes32 indexed jobId,
        address indexed poster,
        uint256 amount
    );

    event CrossChainJobPosted(
        bytes32 indexed jobId,
        address indexed poster,
        uint32 sourceDomain,
        uint256 bounty
    );

    constructor(
        address _registryContract,
        address _settlementContract,
        address _usdcAddress,
        address _cctpMessageTransmitter
    ) {
        owner = msg.sender;
        registryContract = StoaRegistry(_registryContract);
        settlementContract = StoaSettlement(_settlementContract);
        usdc = IERC20(_usdcAddress);
        cctpMessageTransmitter = _cctpMessageTransmitter;
    }

    // Post a job with USDC payment locked in escrow (same-chain)
    function postJob(
        string memory task,
        uint256 bounty,
        string memory requiredCapability,
        uint256 minReputation,
        uint256 deadlineInSeconds
    ) external returns (bytes32) {
        require(bounty > 0, "Bounty must be greater than 0");

        require(
            usdc.transferFrom(msg.sender, address(this), bounty),
            "USDC transfer failed"
        );

        bytes32 jobId = keccak256(
            abi.encodePacked(msg.sender, task, block.timestamp, nonces[msg.sender]++)
        );

        uint256 deadline = block.timestamp + deadlineInSeconds;

        jobs[jobId] = Job({
            jobId: jobId,
            poster: msg.sender,
            fulfiller: address(0),
            bounty: bounty,
            task: task,
            requiredCapability: requiredCapability,
            minReputation: minReputation,
            deadline: deadline,
            funded: true,
            released: false,
            exists: true
        });

        jobList.push(jobId);

        emit JobPosted(jobId, msg.sender, bounty, task, requiredCapability, deadline);

        return jobId;
    }

    // CCTP V2 Hook — called automatically when USDC arrives cross-chain
    // Agent A on Base calls burnWithHook() — this fires atomically on Arc
    function handleReceiveMessage(
        uint32 sourceDomain,
        bytes32 /* sender */,
        bytes calldata messageBody
    ) external override onlyCCTP returns (bool) {

        (
            address poster,
            uint256 bounty,
            string memory task,
            string memory requiredCapability,
            uint256 minReputation,
            uint256 deadlineInSeconds
        ) = abi.decode(
            messageBody,
            (address, uint256, string, string, uint256, uint256)
        );

        require(bounty > 0, "Bounty must be greater than 0");

        // USDC already arrived via CCTP — create job immediately
        bytes32 jobId = keccak256(
            abi.encodePacked(
                poster,
                task,
                block.timestamp,
                nonces[poster]++,
                sourceDomain
            )
        );

        uint256 deadline = block.timestamp + deadlineInSeconds;

        jobs[jobId] = Job({
            jobId: jobId,
            poster: poster,
            fulfiller: address(0),
            bounty: bounty,
            task: task,
            requiredCapability: requiredCapability,
            minReputation: minReputation,
            deadline: deadline,
            funded: true,
            released: false,
            exists: true
        });

        jobList.push(jobId);

        emit JobPosted(jobId, poster, bounty, task, requiredCapability, deadline);
        emit CrossChainJobPosted(jobId, poster, sourceDomain, bounty);

        return true;
    }

    // Update CCTP transmitter address if needed
    function setCctpTransmitter(address _transmitter) external onlyOwner {
        cctpMessageTransmitter = _transmitter;
    }

    // Agent accepts a job
    function acceptJob(bytes32 jobId) external {
        Job storage job = jobs[jobId];
        require(job.exists, "Job not found");
        require(job.funded, "Job not funded");
        require(job.fulfiller == address(0), "Job already taken");
        require(block.timestamp < job.deadline, "Job expired");
        require(
            registryContract.isRegistered(msg.sender),
            "Agent not registered"
        );

        job.fulfiller = msg.sender;

        settlementContract.createSettlement(
            jobId,
            job.poster,
            msg.sender,
            job.bounty,
            job.deadline
        );

        emit JobAccepted(jobId, msg.sender);
    }

    // Release payment to fulfiller after successful settlement
    function releasePayment(bytes32 jobId) external noReentrant {
        Job storage job = jobs[jobId];
        require(job.exists, "Job not found");
        require(!job.released, "Already released");
        require(job.fulfiller != address(0), "No fulfiller");

        (,, , StoaSettlement.JobStatus status,,) =
            settlementContract.getSettlement(jobId);

        require(
            status == StoaSettlement.JobStatus.Completed,
            "Job not completed"
        );

        job.released = true;

        require(
            usdc.transfer(job.fulfiller, job.bounty),
            "USDC transfer failed"
        );

        emit PaymentReleased(jobId, job.fulfiller, job.bounty);
    }

    // Refund poster if job failed or expired
    function refundPoster(bytes32 jobId) external noReentrant {
        Job storage job = jobs[jobId];
        require(job.exists, "Job not found");
        require(!job.released, "Already released");
        require(block.timestamp > job.deadline, "Deadline not passed");

        if (job.fulfiller != address(0)) {
            (,, , StoaSettlement.JobStatus status,,) =
                settlementContract.getSettlement(jobId);
            require(
                status == StoaSettlement.JobStatus.Failed,
                "Job not failed"
            );
        }

        job.released = true;

        require(
            usdc.transfer(job.poster, job.bounty),
            "USDC transfer failed"
        );

        emit PaymentRefunded(jobId, job.poster, job.bounty);
    }

    // Read all open jobs
    function getOpenJobs() external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < jobList.length; i++) {
            if (
                jobs[jobList[i]].fulfiller == address(0) &&
                jobs[jobList[i]].funded &&
                block.timestamp < jobs[jobList[i]].deadline
            ) {
                count++;
            }
        }

        bytes32[] memory openJobs = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < jobList.length; i++) {
            if (
                jobs[jobList[i]].fulfiller == address(0) &&
                jobs[jobList[i]].funded &&
                block.timestamp < jobs[jobList[i]].deadline
            ) {
                openJobs[index] = jobList[i];
                index++;
            }
        }

        return openJobs;
    }

    function getJob(bytes32 jobId)
        external
        view
        returns (
            address poster,
            address fulfiller,
            uint256 bounty,
            string memory task,
            string memory requiredCapability,
            uint256 deadline,
            bool funded,
            bool released
        )
    {
        require(jobs[jobId].exists, "Job not found");
        Job memory j = jobs[jobId];
        return (
            j.poster,
            j.fulfiller,
            j.bounty,
            j.task,
            j.requiredCapability,
            j.deadline,
            j.funded,
            j.released
        );
    }
}
