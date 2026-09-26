// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PrizePool} from "../src/PrizePool.sol";

/// forge script script/Deploy.s.sol --rpc-url worldchain --broadcast --account deployer
/// Env: USDC_ADDRESS, POOL_OWNER, POOL_OPERATOR, MAX_PAYOUT (base units, 6 decimals)
contract Deploy is Script {
    function run() external returns (PrizePool pool) {
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        address owner = vm.envAddress("POOL_OWNER");
        address operator = vm.envAddress("POOL_OPERATOR");
        uint256 maxPayout = vm.envOr("MAX_PAYOUT", uint256(1_000e6));

        vm.startBroadcast();
        pool = new PrizePool(usdc, owner, operator, maxPayout);
        vm.stopBroadcast();

        console2.log("PrizePool deployed at", address(pool));
    }
}
