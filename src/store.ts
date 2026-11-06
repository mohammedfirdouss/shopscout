import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.ts";
import type { Snapshot } from "./digest.ts";

export type Competitor = { username: string; userId?: string };

export type Seller = {
  chatId: number;
  name: string;
  competitors: Competitor[];
  lastDigestAt: number | null;
};

type State = {
  sellers: Record<string, Seller>;
  snapshots: Record<string, Snapshot>;
};

const file = join(config.dataDir, "state.json");

function load(): State {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as State;
  } catch {
    return { sellers: {}, snapshots: {} };
  }
}

const state = load();

function save() {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${file}.tmp`, file);
}

export const MAX_COMPETITORS = 5;

export function getSeller(chatId: number): Seller | undefined {
  return state.sellers[chatId];
}

export function allSellers(): Seller[] {
  return Object.values(state.sellers);
}

export function upsertSeller(chatId: number, name: string): Seller {
  state.sellers[chatId] ??= { chatId, name, competitors: [], lastDigestAt: null };
  save();
  return state.sellers[chatId];
}

export function updateSeller(seller: Seller) {
  state.sellers[seller.chatId] = seller;
  save();
}

export function getSnapshot(username: string): Snapshot | null {
  return state.snapshots[username] ?? null;
}

export function putSnapshot(snapshot: Snapshot) {
  state.snapshots[snapshot.username] = snapshot;
  save();
}
