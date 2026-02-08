import type { CharacterSheet } from "../model/character";
import { saveCharacter } from "./remote";

const LAST_SYNC_KEY = "ws_character_last_sync";

export type SyncResult = {
  ok: boolean;
  at?: string;
  error?: string;
};

export async function syncToCloud(sheet: CharacterSheet): Promise<SyncResult> {
  try {
    const result = await saveCharacter(sheet);
    if (!result.ok) {
      return { ok: false, error: "Conflict: remote has a newer version" };
    }
    const at = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, at);
    return { ok: true, at };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}

export function getLastSync() {
  return localStorage.getItem(LAST_SYNC_KEY);
}
