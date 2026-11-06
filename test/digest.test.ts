import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compare, findPrices, findPromos, render, type Snapshot } from "../src/digest.ts";
import { normaliseHandle, parsePosts, parseProfile } from "../src/instagram.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const posts = parsePosts(fixture("posts-zara.json"));
const profile = parseProfile(fixture("profile-zara.json"));
const newest = posts[0].takenAt;

test("parses real gateway responses", () => {
  assert.equal(profile.username, "zara");
  assert.equal(profile.userId, "602725764");
  assert.ok(profile.followers > 1_000_000);
  assert.equal(posts.length, 12);
  assert.equal(posts[0].kind, "carousel");
  assert.ok(posts.every((p) => p.code && p.takenAt > 0));
});

test("first report counts the last week as new", () => {
  const now: Snapshot = { username: "zara", at: newest + 3600, followers: 100, posts };
  const report = compare(now, null);
  const week = posts.filter((p) => p.takenAt > now.at - 7 * 86400);
  assert.equal(report.newPosts.length, week.length);
  assert.equal(report.followerChange, null);
});

test("later report shows only posts not seen before, and follower change", () => {
  const before: Snapshot = { username: "zara", at: posts[2].takenAt, followers: 100, posts: posts.slice(2) };
  const now: Snapshot = { username: "zara", at: newest + 60, followers: 130, posts };
  const report = compare(now, before);
  assert.deepEqual(
    report.newPosts.map((p) => p.code),
    [posts[0].code, posts[1].code],
  );
  assert.equal(report.followerChange, 30);
  assert.ok(report.top && [posts[0].code, posts[1].code].includes(report.top.code));
});

test("nothing new when the snapshot is unchanged", () => {
  const snap: Snapshot = { username: "zara", at: newest + 60, followers: 100, posts };
  assert.equal(compare({ ...snap, at: snap.at + 60 }, snap).newPosts.length, 0);
});

test("spots Nigerian and dollar prices", () => {
  assert.deepEqual(findPrices("Now ₦15,000 only! was N20k"), ["₦15,000", "N20k"]);
  assert.deepEqual(findPrices("Price: 25k. Delivery 3,500 naira"), ["25k", "3,500 naira"]);
  assert.deepEqual(findPrices("$45 each"), ["$45"]);
  assert.deepEqual(findPrices("New Party Edit #zara"), []);
});

test("drops trailing punctuation from prices", () => {
  assert.deepEqual(findPrices("Wholesale: ₦48,000, retail ₦2,600."), ["₦48,000", "₦2,600"]);
});

test("posting rate ignores pinned posts at the top", () => {
  const day = 86400;
  const base = { kind: "photo" as const, likes: 1, comments: 0, views: null, caption: "", pinned: false };
  const pinnedOld = { ...base, code: "old", takenAt: newest - 300 * day, pinned: true };
  const recent = [0, 7, 14, 21].map((i) => ({ ...base, code: `r${i}`, takenAt: newest - i * day }));
  const report = compare({ username: "x", at: newest + 60, followers: 1, posts: [pinnedOld, ...recent] }, null);
  assert.equal(report.postsPerWeek, 1);
  assert.equal(report.newPosts.length, 1);
  const burst = compare({ username: "x", at: newest + 60, followers: 1, posts: recent.slice(0, 2) }, null);
  assert.equal(burst.postsPerWeek, null);
});

test("long price lists are shortened", () => {
  const post = { code: "p", takenAt: newest, kind: "photo" as const, likes: 1, comments: 0, views: null, caption: "₦1 ₦2 ₦3 ₦4 ₦5 ₦6 ₦7", pinned: false };
  const text = render([compare({ username: "x", at: newest + 60, followers: 1, posts: [post] }, null)]);
  assert.match(text, /Prices mentioned: ₦1, ₦2, ₦3, ₦4, ₦5 and 2 more/);
});

test("spots promo language", () => {
  assert.deepEqual(findPromos("RESTOCK alert 🔥 20% off + free delivery in Lagos"), ["% off", "free delivery", "restock"]);
  assert.deepEqual(findPromos("Evening Collection"), []);
});

test("normalises handles from @names and links", () => {
  assert.equal(normaliseHandle("@Zara"), "zara");
  assert.equal(normaliseHandle("https://www.instagram.com/shop.lagos_ng/"), "shop.lagos_ng");
  assert.equal(normaliseHandle("not a handle!"), null);
});

test("renders a readable report", () => {
  const now: Snapshot = { username: "zara", at: newest + 3600, followers: 61_680_229, posts };
  const text = render([compare(now, null)], ["ghostpage"]);
  assert.match(text, /@zara/);
  assert.match(text, /61,680,229 followers/);
  assert.match(text, /instagram\.com\/p\//);
  assert.match(text, /Couldn't read: @ghostpage/);
});
