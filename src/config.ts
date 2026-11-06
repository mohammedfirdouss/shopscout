import { celo, celoSepolia } from "viem/chains";

process.loadEnvFile?.(".env");

export type Network = "mainnet" | "sandbox";

const NETWORKS = {
  mainnet: {
    chain: celo,
    caip2: "eip155:42220",
    usdc: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    explorer: "https://celoscan.io",
  },
  sandbox: {
    chain: celoSepolia,
    caip2: "eip155:11142220",
    usdc: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    explorer: "https://celo-sepolia.blockscout.com",
  },
} as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

const network = (process.env.SHOPSCOUT_NETWORK ?? "sandbox") as Network;
if (!(network in NETWORKS)) throw new Error(`SHOPSCOUT_NETWORK must be mainnet or sandbox, got ${network}`);

export const config = {
  network,
  ...NETWORKS[network],
  agentKey: () => required("AGENT_PRIVATE_KEY") as `0x${string}`,
  telegramToken: () => required("TELEGRAM_BOT_TOKEN"),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  attributionTag: "celo_27b2ca7b058f",
  gateway: "https://gateway.usebuy.ai",
  maxPerCallAtomic: 30_000n,
  maxPerDigestAtomic: 200_000n,
  dataDir: process.env.SHOPSCOUT_DATA_DIR ?? "data",
};
