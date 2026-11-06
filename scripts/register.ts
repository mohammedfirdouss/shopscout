// Registers ShopScout's ERC-8004 identity from the agent wallet, then checks the
// transaction carries the attribution tag. Run once, on mainnet:
//   SHOPSCOUT_NETWORK=mainnet node scripts/register.ts
import { verifyTx } from "@celo/attribution-tags";
import { parseEventLogs } from "viem";
import { config } from "../src/config.ts";
import { account, publicClient, walletClient } from "../src/wallet.ts";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_URI = "https://raw.githubusercontent.com/mohammedfirdouss/shopscout/main/agent/registration.json";

const abi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string" },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

if (config.network !== "mainnet") throw new Error("Register on mainnet: SHOPSCOUT_NETWORK=mainnet");

const { request } = await publicClient.simulateContract({
  account,
  address: IDENTITY_REGISTRY,
  abi,
  functionName: "register",
  args: [AGENT_URI],
});
const hash = await walletClient.writeContract({ ...request, feeCurrency: config.feeCurrency });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const [registered] = parseEventLogs({ abi, eventName: "Registered", logs: receipt.logs });

const tag = await verifyTx({ client: publicClient, hash });
const tagged = tag?.codes.includes(config.attributionTag) ?? false;

console.log(`agentId: ${registered.args.agentId}`);
console.log(`tx: ${config.explorer}/tx/${hash}`);
console.log(`attribution tag ${config.attributionTag}: ${tagged ? "present" : "MISSING"}`);
if (!tagged) process.exit(1);
