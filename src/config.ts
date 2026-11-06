import { celo, celoSepolia } from "viem/chains";

process.loadEnvFile?.(".env");

export type Network = "mainnet" | "sandbox";

const NETWORKS = {
  mainnet: {
    chain: celo,
    caip2: "eip155:42220",
    tokens: {
      USDC: { asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", feeAdapter: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" },
      USAT: { asset: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", feeAdapter: "0x0357EE22278c922e1D36cFe6b899269b161880C4" },
      USDT: { asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", feeAdapter: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72" },
    },
    explorer: "https://celoscan.io",
  },
  sandbox: {
    chain: celoSepolia,
    caip2: "eip155:11142220",
    tokens: {
      USDC: { asset: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", feeAdapter: undefined },
    },
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

// The stablecoin the agent pays with: USAT, USDT or USDC.
const tokens: Record<string, { asset: string; feeAdapter: `0x${string}` | undefined }> = NETWORKS[network].tokens;
const payToken = process.env.SHOPSCOUT_PAY_TOKEN ?? (network === "mainnet" ? "USAT" : "USDC");
if (!tokens[payToken]) throw new Error(`SHOPSCOUT_PAY_TOKEN ${payToken} is not available on ${network}`);

export const config = {
  network,
  ...NETWORKS[network],
  payToken,
  payAsset: tokens[payToken].asset,
  feeCurrency: tokens[payToken].feeAdapter,
  agentKey: () => required("AGENT_PRIVATE_KEY") as `0x${string}`,
  telegramToken: () => required("TELEGRAM_BOT_TOKEN"),
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  attributionTag: "celo_27b2ca7b058f",
  gateway: "https://gateway.usebuy.ai",
  maxPerCallAtomic: 30_000n,
  maxPerDigestAtomic: 200_000n,
  dataDir: process.env.SHOPSCOUT_DATA_DIR ?? "data",
};
