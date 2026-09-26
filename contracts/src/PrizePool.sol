// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title World Game prize pool
/// @notice Holds the USDC entry fees paid via MiniKit `pay`, plus sponsor top-ups. The game operator
///         (backend) pays each surviving human once per claim id, after the
///         winner re-proved their World ID session off-chain.
/// @dev No NFTs, no owner withdrawal: funds can only leave as claim payouts,
///      each capped and usable exactly once.
contract PrizePool is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public operator;
    uint256 public maxPayout;
    mapping(bytes32 claimId => bool paid) public claimed;

    event OperatorUpdated(address indexed operator);
    event MaxPayoutUpdated(uint256 maxPayout);
    event Payout(bytes32 indexed claimId, address indexed to, uint256 amount);
    event ToppedUp(address indexed sponsor, uint256 amount);

    error NotOperator();
    error ZeroAddress();
    error ZeroAmount();
    error AlreadyClaimed(bytes32 claimId);
    error AboveMaxPayout(uint256 amount, uint256 maxPayout);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(IERC20 token_, address owner_, address operator_, uint256 maxPayout_) Ownable(owner_) {
        if (address(token_) == address(0) || operator_ == address(0)) revert ZeroAddress();
        token = token_;
        operator = operator_;
        maxPayout = maxPayout_;
        emit OperatorUpdated(operator_);
        emit MaxPayoutUpdated(maxPayout_);
    }

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Anyone can grow the prize pool. (MiniKit `pay` transfers also work;
    ///         this entry point just makes sponsorships visible on-chain.)
    function topUp(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit ToppedUp(msg.sender, amount);
    }

    /// @notice Pays a winner. Each `claimId` (keccak256("s<season>:<address>")) can be paid once.
    function payout(address to, uint256 amount, bytes32 claimId) external onlyOperator whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPayout) revert AboveMaxPayout(amount, maxPayout);
        if (claimed[claimId]) revert AlreadyClaimed(claimId);
        claimed[claimId] = true;
        token.safeTransfer(to, amount);
        emit Payout(claimId, to, amount);
    }

    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setMaxPayout(uint256 maxPayout_) external onlyOwner {
        maxPayout = maxPayout_;
        emit MaxPayoutUpdated(maxPayout_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
