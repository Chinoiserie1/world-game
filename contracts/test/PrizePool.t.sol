// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PrizePool} from "../src/PrizePool.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PrizePoolTest is Test {
    MockUSDC usdc;
    PrizePool pool;
    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address winner = makeAddr("winner");
    address player = makeAddr("player");
    bytes32 claimId = keccak256("s1:winner");

    function setUp() public {
        usdc = new MockUSDC();
        pool = new PrizePool(usdc, owner, operator, 100e6);
        // Entry fees arrive as plain ERC20 transfers (MiniKit pay).
        usdc.mint(player, 10e6);
        vm.prank(player);
        usdc.transfer(address(pool), 10e6);
    }

    function test_operatorPaysWinnerOnce() public {
        vm.prank(operator);
        vm.expectEmit(true, true, false, true);
        emit PrizePool.Payout(claimId, winner, 7e6);
        pool.payout(winner, 7e6, claimId);

        assertEq(usdc.balanceOf(winner), 7e6);
        assertEq(pool.balance(), 3e6);
        assertTrue(pool.claimed(claimId));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(PrizePool.AlreadyClaimed.selector, claimId));
        pool.payout(winner, 1e6, claimId);
    }

    function test_onlyOperatorCanPay() public {
        vm.prank(winner);
        vm.expectRevert(PrizePool.NotOperator.selector);
        pool.payout(winner, 1e6, claimId);

        vm.prank(owner);
        vm.expectRevert(PrizePool.NotOperator.selector);
        pool.payout(owner, 1e6, claimId);
    }

    function test_rejectsInvalidPayouts() public {
        vm.startPrank(operator);
        vm.expectRevert(PrizePool.ZeroAddress.selector);
        pool.payout(address(0), 1e6, claimId);
        vm.expectRevert(PrizePool.ZeroAmount.selector);
        pool.payout(winner, 0, claimId);
        vm.expectRevert(abi.encodeWithSelector(PrizePool.AboveMaxPayout.selector, 101e6, 100e6));
        pool.payout(winner, 101e6, claimId);
        vm.expectRevert(); // insufficient balance
        pool.payout(winner, 11e6, claimId);
        vm.stopPrank();
        assertFalse(pool.claimed(claimId));
    }

    function test_pauseBlocksPayouts() public {
        vm.prank(owner);
        pool.pause();
        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pool.payout(winner, 1e6, claimId);

        vm.prank(owner);
        pool.unpause();
        vm.prank(operator);
        pool.payout(winner, 1e6, claimId);
        assertEq(usdc.balanceOf(winner), 1e6);
    }

    function test_ownerAdmin() public {
        address newOperator = makeAddr("newOperator");
        vm.prank(owner);
        pool.setOperator(newOperator);
        assertEq(pool.operator(), newOperator);

        vm.prank(owner);
        pool.setMaxPayout(5e6);
        assertEq(pool.maxPayout(), 5e6);

        vm.prank(owner);
        vm.expectRevert(PrizePool.ZeroAddress.selector);
        pool.setOperator(address(0));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, operator));
        pool.setOperator(operator);
    }

    function test_anyoneCanTopUp() public {
        address sponsor = makeAddr("sponsor");
        usdc.mint(sponsor, 50e6);
        vm.startPrank(sponsor);
        usdc.approve(address(pool), 50e6);
        vm.expectEmit(true, false, false, true);
        emit PrizePool.ToppedUp(sponsor, 50e6);
        pool.topUp(50e6);
        vm.expectRevert(PrizePool.ZeroAmount.selector);
        pool.topUp(0);
        vm.stopPrank();
        assertEq(pool.balance(), 60e6);
    }

    function test_constructorValidation() public {
        vm.expectRevert(PrizePool.ZeroAddress.selector);
        new PrizePool(usdc, owner, address(0), 1);
    }

    function testFuzz_payoutNeverExceedsBalanceOrCap(uint256 amount) public {
        amount = bound(amount, 1, 10e6);
        vm.prank(operator);
        pool.payout(winner, amount, claimId);
        assertEq(usdc.balanceOf(winner) + pool.balance(), 10e6);
    }
}
