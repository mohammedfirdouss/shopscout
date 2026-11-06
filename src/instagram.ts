export type Post = {
  code: string;
  takenAt: number;
  kind: "photo" | "video" | "carousel";
  likes: number;
  comments: number;
  views: number | null;
  caption: string;
};

export type Profile = {
  userId: string;
  username: string;
  fullName: string;
  followers: number;
  isPrivate: boolean;
};

export type RawProfile = {
  output: {
    id: string;
    username: string;
    full_name?: string;
    edge_followed_by?: { count?: number };
    is_private?: boolean;
  };
};

type RawPost = {
  code: string;
  taken_at: number;
  media_type: number;
  like_count?: number;
  comment_count?: number;
  play_count?: number | null;
  caption?: { text?: string } | null;
};

export type RawPosts = { output: { items?: RawPost[] } };

const KIND: Record<number, Post["kind"]> = { 1: "photo", 2: "video", 8: "carousel" };

export function parseProfile(raw: RawProfile): Profile {
  const o = raw.output;
  return {
    userId: String(o.id),
    username: o.username,
    fullName: o.full_name ?? "",
    followers: o.edge_followed_by?.count ?? 0,
    isPrivate: o.is_private ?? false,
  };
}

export function parsePosts(raw: RawPosts): Post[] {
  return (raw.output.items ?? []).map((p) => ({
    code: p.code,
    takenAt: p.taken_at,
    kind: KIND[p.media_type] ?? "photo",
    likes: p.like_count ?? 0,
    comments: p.comment_count ?? 0,
    views: p.play_count ?? null,
    caption: p.caption?.text ?? "",
  }));
}

export function normaliseHandle(input: string): string | null {
  const handle = input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}
