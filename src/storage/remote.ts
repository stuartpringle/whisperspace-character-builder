import { CHARACTER_API_BASE } from "@whisperspace/sdk";
import type { CharacterSheet } from "../model/character";

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
