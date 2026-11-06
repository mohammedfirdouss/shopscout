# ShopScout

A weekly competitor report for small Instagram sellers, delivered in Telegram.

A seller on Instagram (fashion, hair, skincare, food) keeps an eye on 3 to 5 rival pages by scrolling through them by hand, which takes a couple of hours a week. ShopScout does it for them. They send the bot the pages they watch, and every week it replies with:

- how many times each page posted, and its usual posting rate
- the post that got the most likes and comments
- prices mentioned in captions (₦, N20k, 25k, $)
- promo signals: sales, % off, free delivery, restocks, giveaways
- follower changes since the last report

The seller never sees crypto. ShopScout's agent wallet pays for the data.

## How it pays for data

Instagram data comes from the [buy](https://usebuy.ai) gateway, paid per call over [x402](https://x402.celo.org) in USA₮, USD₮ or USDC (set `SHOPSCOUT_PAY_TOKEN`) on Celo mainnet. ShopScout doesn't own these services.

| Service (buy capability) | Provider (ERC-8004 agent) | Price | Used for |
|---|---|---|---|
| `instagram.profile` | tikhub (#9895) | $0.005 | followers, user id, private check |
| Instagram · Fetch User Posts | tikhub (#9895) | $0.005 | the last 12 posts |

Each watched page costs 2 calls a week, so a seller watching 5 pages costs $0.05 a week. Each paid call:

1. gets a `402` with the price,
2. is checked against a spend cap (`$0.03` per call, `$0.20` per report), and refused before signing if it's over,
3. is paid with a signed stablecoin authorisation from the agent wallet (`@x402/fetch`),
4. is logged to `data/receipts.jsonl` with its settlement transaction.

Failed calls are never retried automatically, because the payment may already have settled. `node scripts/receipts.ts mainnet` prints every settled payment as a table with Celoscan links. That table is the proof of payment for the submission.

Once a week the agent also rates the provider it paid on the ERC-8004 Reputation Registry, scoring the share of calls that succeeded.

## On-chain identity and attribution

- The agent wallet registers ShopScout on the ERC-8004 Identity Registry (`scripts/register.ts`, with the registration file at [`agent/registration.json`](agent/registration.json)).
- Every transaction the agent sends itself (registration, reputation) goes through one viem client extended with `withAttribution("celo_27b2ca7b058f")` ([`src/wallet.ts`](src/wallet.ts)). The register script checks the tag on-chain with `verifyTx` and fails if it's missing.
- Gas for those transactions is paid in the same stablecoin through Celo fee abstraction, so the wallet holds no CELO.

## Run it

Needs Node 22.18+ (it runs TypeScript directly).

```sh
npm install
cp .env.example .env          # add AGENT_PRIVATE_KEY and TELEGRAM_BOT_TOKEN
npm test                      # digest logic against real gateway responses
SHOPSCOUT_NETWORK=sandbox node scripts/report.ts zara hm   # one report, test funds
SHOPSCOUT_NETWORK=mainnet npm run bot                       # the Telegram bot
```

`sandbox` pays with free test USDC on Celo Sepolia from buy's faucet (`POST https://gateway.usebuy.ai/v1/sandbox/fund` with `{"address": "0x…"}`). `mainnet` pays real USDC.

Bot commands: `/watch @page1 @page2`, `/list`, `/remove @page`, `/report`. The first report arrives as soon as pages are added, then once a week.

## Layout

```
src/config.ts      network, spend caps, attribution tag
src/wallet.ts      the agent's viem clients (tagged)
src/pay.ts         paid calls over x402, with caps and receipts
src/instagram.ts   parses gateway responses
src/digest.ts      compares this week with last week, writes the report
src/scout.ts       runs one seller's report
src/store.ts       sellers and snapshots (JSON file)
src/reputation.ts  weekly ERC-8004 feedback for providers
src/bot.ts         Telegram bot and weekly schedule
scripts/           register, receipts, one-off report
```

Built for the Agents on Open Rails Hackathon, Build with buy track.
