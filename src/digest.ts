import type { Post } from "./instagram.ts";

export type Snapshot = {
  username: string;
  at: number;
  followers: number;
  posts: Post[];
};

export type CompetitorReport = {
  username: string;
  followers: number;
  followerChange: number | null;
  newPosts: Post[];
  top: Post | null;
  prices: string[];
  promos: string[];
  postsPerWeek: number;
};

const WEEK = 7 * 24 * 60 * 60;

const PROMO_WORDS = [
  "sale",
  "discount",
  "% off",
  "promo",
  "giveaway",
  "free delivery",
  "free shipping",
  "restock",
  "back in stock",
  "new arrival",
  "new in",
  "limited",
  "pre-order",
  "preorder",
  "black friday",
  "bundle",
  "buy 1",
  "buy one",
  "code",
];

const PRICE = /(?:₦|ngn\s?|n(?=\d)|\$|£|€)\s?\d[\d,.]*\s?k?\b|\b\d[\d,.]*\s?(?:naira|k)\b/gi;

export function engagement(p: Post): number {
  return p.likes + p.comments * 3;
}

export function findPrices(caption: string): string[] {
  return [...new Set((caption.match(PRICE) ?? []).map((m) => m.trim()))];
}

export function findPromos(caption: string): string[] {
  const text = caption.toLowerCase();
  return PROMO_WORDS.filter((w) => text.includes(w));
}

// What changed for one competitor since the last snapshot. With no previous
// snapshot, "new" means posted in the last week.
export function compare(now: Snapshot, before: Snapshot | null): CompetitorReport {
  const seen = new Set(before?.posts.map((p) => p.code) ?? []);
  const since = before ? before.at : now.at - WEEK;
  const newPosts = now.posts
    .filter((p) => !seen.has(p.code) && p.takenAt > since)
    .sort((a, b) => b.takenAt - a.takenAt);
  const top = [...newPosts].sort((a, b) => engagement(b) - engagement(a))[0] ?? null;
  const span = now.posts.length > 1 ? now.posts[0].takenAt - now.posts[now.posts.length - 1].takenAt : 0;
  return {
    username: now.username,
    followers: now.followers,
    followerChange: before ? now.followers - before.followers : null,
    newPosts,
    top,
    prices: [...new Set(newPosts.flatMap((p) => findPrices(p.caption)))],
    promos: [...new Set(newPosts.flatMap((p) => findPromos(p.caption)))],
    postsPerWeek: span > 0 ? Math.round(((now.posts.length - 1) / span) * WEEK * 10) / 10 : 0,
  };
}

function firstLine(caption: string, max = 80): string {
  const line = caption.replace(/[⁣​]/g, "").split("\n").find((l) => l.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function signed(n: number): string {
  return n > 0 ? `+${n.toLocaleString("en")}` : n.toLocaleString("en");
}

export function render(reports: CompetitorReport[], failed: string[] = []): string {
  const lines: string[] = ["📊 Your ShopScout weekly report", ""];
  const active = reports.filter((r) => r.newPosts.length > 0);
  const best = active
    .map((r) => ({ r, p: r.top! }))
    .sort((a, b) => engagement(b.p) - engagement(a.p))[0];

  if (active.length === 0) {
    lines.push("Quiet week: none of the pages you watch posted anything new.");
  } else {
    lines.push(`${active.length} of ${reports.length} pages posted ${active.reduce((n, r) => n + r.newPosts.length, 0)} times this week.`);
    if (best) {
      lines.push(`Biggest hit: @${best.r.username}, "${firstLine(best.p.caption, 60)}" (${best.p.likes.toLocaleString("en")} likes, ${best.p.comments} comments) instagram.com/p/${best.p.code}`);
    }
    const promoPages = reports.filter((r) => r.promos.length > 0).map((r) => `@${r.username}`);
    if (promoPages.length) lines.push(`Running promos: ${promoPages.join(", ")}`);
  }

  for (const r of reports) {
    lines.push("", `@${r.username}`);
    const followers = `${r.followers.toLocaleString("en")} followers`;
    lines.push(r.followerChange === null ? `• ${followers}` : `• ${followers} (${signed(r.followerChange)} since last report)`);
    lines.push(`• ${r.newPosts.length} new post${r.newPosts.length === 1 ? "" : "s"}, usually ${r.postsPerWeek} a week`);
    if (r.top) lines.push(`• Best: "${firstLine(r.top.caption)}" (${r.top.likes.toLocaleString("en")} likes) instagram.com/p/${r.top.code}`);
    if (r.prices.length) lines.push(`• Prices mentioned: ${r.prices.join(", ")}`);
    if (r.promos.length) lines.push(`• Promo signals: ${r.promos.join(", ")}`);
  }

  if (failed.length) lines.push("", `Couldn't read: ${failed.map((u) => `@${u}`).join(", ")} (private, renamed, or not found)`);
  return lines.join("\n");
}
