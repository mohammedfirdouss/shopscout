// Prints every paid call as a Markdown table with its settlement transaction,
// for the submission's proof of payment:
//   node scripts/receipts.ts mainnet > docs/payments.md
import { readFileSync } from "node:fs";
import type { Receipt } from "../src/pay.ts";

const network = process.argv[2] ?? "mainnet";
const explorer = network === "mainnet" ? "https://celoscan.io" : "https://celo-sepolia.blockscout.com";

const rows = readFileSync("data/receipts.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Receipt)
  .filter((r) => r.network === network && r.txHash);

console.log(`# Paid calls (${network})\n`);
console.log(`Payer (agent wallet): \`${rows[0]?.payer ?? "none yet"}\`. ${rows.length} settled calls.\n`);
console.log("| When (UTC) | Service | Settlement |");
console.log("|---|---|---|");
for (const r of rows) console.log(`| ${r.at.slice(0, 16).replace("T", " ")} | ${r.capability} | [${r.txHash!.slice(0, 10)}…](${explorer}/tx/${r.txHash}) |`);
