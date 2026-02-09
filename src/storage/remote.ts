import { CHARACTER_API_BASE } from "@whisperspace/sdk";
import type { CharacterSheet } from "../model/character";
import { validateCharacterRecordV1 } from "@whisperspace/sdk";

const API_BASE =
  (import.meta as any).env?.VITE_CHARACTER_API_BASE || CHARACTER_API_BASE;

function authHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = localStorage.getItem("ws_character_api_key");
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export type CharacterSummary = Pick<CharacterSheet, "id" | "name" | "updatedAt">;

export type SaveResponse =
  | { ok: true; sheet: CharacterSheet }
  | { ok: false; error: string; conflict?: CharacterSheet };

export type AdminListResponse = {
  count: number;
  items: Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
};

export async function listCharacters(): Promise<CharacterSummary[]> {
  const res = await fetch(`${API_BASE}/characters`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to list characters");
  return (await res.json()) as CharacterSummary[];
}

export async function fetchCharacter(id: string): Promise<CharacterSheet> {
  const res = await fetch(`${API_BASE}/characters/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load character");
  return (await res.json()) as CharacterSheet;
}

export async function saveCharacter(sheet: CharacterSheet, opts?: { force?: boolean }): Promise<SaveResponse> {
  const validation = validateCharacterRecordV1(sheet);
  if (!validation.ok) {
    return { ok: false, error: `validation_failed: ${validation.errors[0]}` };
  }
  const res = await fetch(`${API_BASE}/characters/${sheet.id}${opts?.force ? "?force=1" : ""}`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "If-Unmodified-Since": sheet.updatedAt,
    },
    body: JSON.stringify(sheet),
  });
  if (res.status === 409) {
    const payload = await res.json();
    return { ok: false, error: "conflict", conflict: payload?.current as CharacterSheet };
  }
  if (!res.ok) throw new Error("Failed to save character");
  return { ok: true, sheet: (await res.json()) as CharacterSheet };
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/characters/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete character");
}

export async function adminListCharacters(): Promise<AdminListResponse> {
  const res = await fetch(`${API_BASE}/admin/characters`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load admin list");
  return (await res.json()) as AdminListResponse;
}

export async function adminDeleteAll(): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`${API_BASE}/admin/characters?confirm=1`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete all characters");
  return (await res.json()) as { ok: boolean; deleted: number };
}
