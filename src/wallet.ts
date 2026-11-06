import { withAttribution } from "@celo/attribution-tags";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.ts";

export const account = privateKeyToAccount(config.agentKey());

export const publicClient = createPublicClient({ chain: config.chain, transport: http() });

// Every transaction the agent sends itself goes through this client, so every
// one carries the hackathon attribution tag. x402 payments are signed
// authorisations settled by the gateway, so they never pass through here.
export const walletClient = createWalletClient({ account, chain: config.chain, transport: http() }).extend(
  withAttribution(config.attributionTag),
);
