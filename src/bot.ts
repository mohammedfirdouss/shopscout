import { Bot } from "grammy";
import { config } from "./config.ts";
import { normaliseHandle } from "./instagram.ts";
import { rateProviders } from "./reputation.ts";
import { runDigest } from "./scout.ts";
import { allSellers, getSeller, MAX_COMPETITORS, updateSeller, upsertSeller, type Seller } from "./store.ts";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const bot = new Bot(config.telegramToken());
const running = new Set<number>();

const WELCOME = [
  "Hi! I'm ShopScout 👋",
  "",
  "Every week I check the Instagram pages you compete with and send you a short report: new posts, what got the most likes, prices they mention, and promos they're running.",
  "",
  `Send me up to ${MAX_COMPETITORS} pages to watch, like this:`,
  "/watch @page1 @page2 @page3",
  "",
  "Other commands: /list, /remove @page, /report",
].join("\n");

async function deliver(seller: Seller) {
  if (running.has(seller.chatId)) return;
  running.add(seller.chatId);
  try {
    const result = await runDigest(seller);
    await bot.api.sendMessage(seller.chatId, result.text, { link_preview_options: { is_disabled: true } });
    console.log(`[digest] chat ${seller.chatId}: ${result.calls} paid calls, ${Number(result.spentAtomic) / 1e6} USDC`);
  } finally {
    running.delete(seller.chatId);
  }
}

bot.command("start", async (ctx) => {
  upsertSeller(ctx.chat.id, ctx.from?.first_name ?? "");
  await ctx.reply(WELCOME);
});

bot.command("watch", async (ctx) => {
  const seller = upsertSeller(ctx.chat.id, ctx.from?.first_name ?? "");
  const words = ctx.match.split(/[\s,]+/).filter(Boolean);
  const handles = words.map(normaliseHandle);
  const bad = words.filter((_, i) => !handles[i]);
  const fresh = [...new Set(handles.filter((h): h is string => Boolean(h)))].filter(
    (h) => !seller.competitors.some((c) => c.username === h),
  );
  if (!words.length) return ctx.reply("Send the pages after the command, like: /watch @page1 @page2");

  const room = MAX_COMPETITORS - seller.competitors.length;
  const added = fresh.slice(0, Math.max(room, 0));
  seller.competitors.push(...added.map((username) => ({ username })));
  updateSeller(seller);

  const notes = [];
  if (added.length) notes.push(`Watching: ${added.map((h) => `@${h}`).join(", ")}`);
  if (fresh.length > added.length) notes.push(`You can watch up to ${MAX_COMPETITORS} pages. /remove one to add another.`);
  if (bad.length) notes.push(`These don't look like Instagram handles: ${bad.join(", ")}`);
  await ctx.reply(notes.join("\n") || "You're already watching those pages.");

  if (added.length && seller.lastDigestAt === null) {
    await ctx.reply("Putting together your first report now, give me a minute ⏳");
    await deliver(seller);
  }
});

bot.command("remove", async (ctx) => {
  const seller = getSeller(ctx.chat.id);
  const handle = normaliseHandle(ctx.match);
  if (!seller || !handle) return ctx.reply("Tell me which page, like: /remove @page1");
  seller.competitors = seller.competitors.filter((c) => c.username !== handle);
  updateSeller(seller);
  await ctx.reply(`Stopped watching @${handle}.`);
});

bot.command("list", async (ctx) => {
  const seller = getSeller(ctx.chat.id);
  if (!seller?.competitors.length) return ctx.reply("You're not watching any pages yet. Try /watch @page1 @page2");
  const next = seller.lastDigestAt ? new Date(seller.lastDigestAt + WEEK).toDateString() : "after you add pages";
  await ctx.reply(`Watching: ${seller.competitors.map((c) => `@${c.username}`).join(", ")}\nNext report: ${next}`);
});

bot.command("report", async (ctx) => {
  const seller = getSeller(ctx.chat.id);
  if (!seller?.competitors.length) return ctx.reply("Add pages first: /watch @page1 @page2");
  if (seller.lastDigestAt && Date.now() - seller.lastDigestAt < DAY) {
    return ctx.reply("You've had a report in the last 24 hours. Pages rarely change faster than that, so I'll check again tomorrow.");
  }
  await ctx.reply("Checking your pages now ⏳");
  await deliver(seller);
});

bot.on("message:text", (ctx) => ctx.reply(WELCOME));

bot.catch((err) => console.error("[bot]", err.error));

// Hourly sweep: anyone whose last report is a week old gets the next one.
async function weekly() {
  for (const seller of allSellers()) {
    if (seller.competitors.length && seller.lastDigestAt && Date.now() - seller.lastDigestAt >= WEEK) {
      await deliver(seller).catch((e) => console.error(`[weekly] chat ${seller.chatId}:`, e));
    }
  }
  await rateProviders().catch((e) => console.error("[reputation]", e));
}

setInterval(weekly, 60 * 60 * 1000);
console.log(`ShopScout running on ${config.network}`);
await bot.start();
