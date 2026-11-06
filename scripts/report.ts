// Runs one report without Telegram, for testing:
//   node scripts/report.ts zara hm
import { normaliseHandle } from "../src/instagram.ts";
import { config } from "../src/config.ts";
import { runDigest } from "../src/scout.ts";

const competitors = process.argv.slice(2).map((h) => ({ username: normaliseHandle(h)! }));
const result = await runDigest({ chatId: 0, name: "cli", competitors, lastDigestAt: null });
console.log(result.text);
console.log(`\n${result.calls} paid calls, ${Number(result.spentAtomic) / 1e6} ${config.payToken}`);
