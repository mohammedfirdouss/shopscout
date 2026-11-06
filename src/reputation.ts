import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { zeroHash } from "viem";
import { config } from "./config.ts";
import type { Receipt } from "./pay.ts";
import { publicClient, walletClient } from "./wallet.ts";

const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const WEEK = 7 * 24 * 60 * 60 * 1000;

// The ERC-8004 agent behind each capability ShopScout pays for (from the buy catalog).
const PROVIDERS = [{ agentId: 9895n, name: "tikhub", capabilities: ["instagram.profile", "instagram.user-posts"] }];

const abi = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    outputs: [],
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
  },
] as const;

function receipts(): Receipt[] {
  try {
    return readFileSync(join(config.dataDir, "receipts.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Receipt);
  } catch {
    return [];
  }
}

const ratedFile = join(config.dataDir, "rated-at.txt");

function lastRatedAt(): number {
  try {
    return Number(readFileSync(ratedFile, "utf8"));
  } catch {
    return 0;
  }
}

// Once a week, rate each provider we paid on the ERC-8004 Reputation Registry
// with the share of paid calls that succeeded. Mainnet only.
export async function rateProviders() {
  if (config.network !== "mainnet" || Date.now() - lastRatedAt() < WEEK) return;
  const since = new Date(Date.now() - WEEK).toISOString();
  for (const provider of PROVIDERS) {
    const calls = receipts().filter((r) => r.network === "mainnet" && r.at >= since && provider.capabilities.includes(r.capability));
    if (calls.length === 0) continue;
    const ok = calls.filter((r) => r.status === 200).length;
    const score = BigInt(Math.round((ok / calls.length) * 100));
    const hash = await walletClient.writeContract({
      address: REPUTATION_REGISTRY,
      abi,
      functionName: "giveFeedback",
      args: [provider.agentId, score, 0, "reliability", "shopscout", `${config.gateway}/v1/social/instagram`, "", zeroHash],
      feeCurrency: config.feeCurrency,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[reputation] rated ${provider.name} ${score}/100 over ${calls.length} calls: ${config.explorer}/tx/${hash}`);
  }
  writeFileSync(ratedFile, String(Date.now()));
}
