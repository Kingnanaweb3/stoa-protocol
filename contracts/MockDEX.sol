// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// MockDEX — Arbitrum Sepolia
// Simulates a DEX swap with guaranteed liquidity
// Returns real on-chain transaction for Validator to verify

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockDEX {

    address public owner;
    IERC20 public usdc;

    // Simulated exchange rate: 1 USDC in = 1.0011 USDC out (0.11% profit)
    uint256 public constant RATE_NUMERATOR = 10011;
    uint256 public constant RATE_DENOMINATOR = 10000;

    event SwapExecuted(
        address indexed trader,
        uint256 amountIn,
        uint256 amountOut,
        uint256 spread,
        string jobId,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
    }

    // Fund the DEX with USDC liquidity
    function fund(uint256 amount) external onlyOwner {
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "Fund transfer failed"
        );
    }

    // Execute a swap — real on-chain tx Agent B submits as proof
    function executeSwap(
        uint256 amountIn,
        string calldata jobId
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be greater than 0");

        // Pull USDC from trader
        require(
            usdc.transferFrom(msg.sender, address(this), amountIn),
            "Transfer in failed"
        );

        // Calculate output with simulated spread profit
        amountOut = (amountIn * RATE_NUMERATOR) / RATE_DENOMINATOR;

        // Ensure DEX has enough liquidity
        require(
            usdc.balanceOf(address(this)) >= amountOut,
            "Insufficient DEX liquidity"
        );

        // Send USDC back to trader with profit
        require(
            usdc.transfer(msg.sender, amountOut),
            "Transfer out failed"
        );

        emit SwapExecuted(
            msg.sender,
            amountIn,
            amountOut,
            RATE_NUMERATOR - RATE_DENOMINATOR,
            jobId,
            block.timestamp
        );

        return amountOut;
    }

    // Check DEX liquidity
    function getLiquidity() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // Owner can withdraw liquidity
    function withdraw(uint256 amount) external onlyOwner {
        require(
            usdc.transfer(owner, amount),
            "Withdrawal failed"
        );
    }
}
