import { config } from "./config.ts";
import { compare, render, type CompetitorReport } from "./digest.ts";
import { parsePosts, parseProfile, type RawPosts, type RawProfile } from "./instagram.ts";
import { buy, PaidCallError } from "./pay.ts";
import { getSnapshot, putSnapshot, updateSeller, type Seller } from "./store.ts";

const PRICE_PER_CALL = 5_000n;

export type DigestResult = { text: string; calls: number; spentAtomic: bigint };

// Builds one seller's report. Each competitor costs one paid call for posts,
// plus one for the profile (followers, and the user id the posts call needs).
export async function runDigest(seller: Seller): Promise<DigestResult> {
  const reports: CompetitorReport[] = [];
  const failed: string[] = [];
  let calls = 0;

  for (const competitor of seller.competitors) {
    if (BigInt(calls + 2) * PRICE_PER_CALL > config.maxPerDigestAtomic) {
      failed.push(competitor.username);
      continue;
    }
    try {
      calls++;
      const profile = parseProfile(
        await buy<RawProfile>("instagram.profile", "/v1/social/instagram/profile", { username: competitor.username }),
      );
      if (profile.isPrivate) {
        failed.push(competitor.username);
        continue;
      }
      competitor.userId = profile.userId;
      calls++;
      const posts = parsePosts(
        await buy<RawPosts>(
          "instagram.user-posts",
          "/v1/social/instagram/tools/tikhub-api-v1-instagram-v1-fetch-user-posts",
          { queryParams: { user_id: profile.userId, count: 12 } },
        ),
      );
      const snapshot = { username: competitor.username, at: Math.floor(Date.now() / 1000), followers: profile.followers, posts };
      reports.push(compare(snapshot, getSnapshot(competitor.username)));
      putSnapshot(snapshot);
    } catch (error) {
      if (!(error instanceof PaidCallError)) throw error;
      console.error(`[scout] ${competitor.username}: ${error.message}`);
      failed.push(competitor.username);
    }
  }

  seller.lastDigestAt = Date.now();
  updateSeller(seller);
  return { text: render(reports, failed), calls, spentAtomic: BigInt(calls) * PRICE_PER_CALL };
}
