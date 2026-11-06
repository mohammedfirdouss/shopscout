// Prints the agent wallet's stablecoin balances on Celo mainnet.
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { celo } from "viem/chains";
import { account } from "../src/wallet.ts";

const client = createPublicClient({ chain: celo, transport: http() });
const tokens = {
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  USAT: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
} as const;
console.log(`agent wallet ${account.address}`);
for (const [symbol, address] of Object.entries(tokens)) {
  const raw = await client.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  console.log(`${symbol}: ${formatUnits(raw, 6)}`);
}
