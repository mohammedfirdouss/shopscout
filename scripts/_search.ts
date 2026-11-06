import { buy } from "../src/pay.ts";
for (const q of process.argv.slice(2)) {
  const r = await buy<any>("instagram.search", "/v1/social/instagram/tools/tikhub-api-v1-instagram-v1-fetch-search", { queryParams: { query: q, select: "users" } });
  const o = r.output;
  const users = (o.users ?? o.data?.users ?? o.items ?? []).map((u: any) => u.user ?? u);
  console.log(`== ${q}:`, users.length ? "" : JSON.stringify(o).slice(0, 300));
  for (const u of users.slice(0, 5)) console.log(`  @${u.username}  ${u.full_name}  ${u.follower_count ?? ""} ${u.is_private ? "(private)" : ""}`);
}
