import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ExactEvmScheme } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { config } from "./config.ts";
import { account } from "./wallet.ts";

export type Receipt = {
  at: string;
  network: string;
  capability: string;
  url: string;
  status: number;
  txHash: string | null;
  payer: string;
};

export class PaidCallError extends Error {
  readonly status: number;
  readonly settled: boolean;
  constructor(message: string, status: number, settled: boolean) {
    super(message);
    this.status = status;
    this.settled = settled;
  }
}

const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: config.caip2, client: new ExactEvmScheme(account) }],
  spendControls: {
    maxAmountPerPayment: false,
    allowedAssets: [{ network: config.caip2, asset: config.payAsset, maxAmountPerPayment: String(config.maxPerCallAtomic) }],
  },
});

function record(receipt: Receipt) {
  mkdirSync(config.dataDir, { recursive: true });
  appendFileSync(join(config.dataDir, "receipts.jsonl"), `${JSON.stringify(receipt)}\n`);
}

// One paid POST to a buy gateway capability. Never retried here: a failure after
// the payment header was sent may already have settled on-chain.
export async function buy<T>(capability: string, path: string, body: unknown): Promise<T> {
  const url = `${config.gateway}${path}`;
  const response = await paidFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const header = response.headers.get("PAYMENT-RESPONSE") ?? response.headers.get("X-PAYMENT-RESPONSE");
  const settlement = header ? decodePaymentResponseHeader(header) : null;
  const txHash = settlement?.transaction || null;
  record({
    at: new Date().toISOString(),
    network: config.network,
    capability,
    url,
    status: response.status,
    txHash,
    payer: account.address,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new PaidCallError(`${capability} returned ${response.status}: ${text.slice(0, 300)}`, response.status, Boolean(txHash));
  }
  return (await response.json()) as T;
}
