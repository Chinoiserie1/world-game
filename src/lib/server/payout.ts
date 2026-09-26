import "server-only";
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchain } from "viem/chains";
import { getConfig } from "@/lib/config";
import type { PayoutSender } from "@/lib/service/claims";

export const PRIZE_POOL_ABI = [
  {
    type: "function",
    name: "payout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/**
 * Returns an on-chain payout sender when an operator key is configured,
 * otherwise null (claims stay "pending" and are paid manually by the operator).
 */
export function getPayoutSender(): PayoutSender | null {
  const cfg = getConfig();
  if (!cfg.OPERATOR_PRIVATE_KEY) return null;

  const account = privateKeyToAccount(cfg.OPERATOR_PRIVATE_KEY as `0x${string}`);
  const transport = http(cfg.WORLDCHAIN_RPC_URL);
  const wallet = createWalletClient({ account, chain: worldchain, transport });
  const reader = createPublicClient({ chain: worldchain, transport });

  return async (to, amountUnits, claimKey) => {
    const hash = await wallet.writeContract({
      address: cfg.PRIZE_POOL_ADDRESS as Address,
      abi: PRIZE_POOL_ABI,
      functionName: "payout",
      args: [to as Address, amountUnits, keccak256(toHex(claimKey))],
    });
    const receipt = await reader.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Payout transaction reverted: ${hash}`);
    return hash;
  };
}
