import type { CharacterSheet } from "../model/character";
import { CHARACTER_API_BASE } from "../model/api";
import { validateCharacterRecordV1 } from "../model/validate";

const API_BASE =
  (import.meta as any).env?.VITE_CHARACTER_API_BASE || CHARACTER_API_BASE;

function authHeaders(opts?: { includeApiKey?: boolean }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.includeApiKey) {
    const apiKey = localStorage.getItem("ws_character_api_key");
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  }
  const csrf = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("ws_csrf="));
  if (csrf) {
    headers["X-CSRF-Token"] = decodeURIComponent(csrf.split("=").slice(1).join("="));
  }
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
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to list characters");
  return (await res.json()) as CharacterSummary[];
}

export async function fetchCharacter(id: string): Promise<CharacterSheet> {
  const res = await fetch(`${API_BASE}/characters/${id}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load character");
  return (await res.json()) as CharacterSheet;
}

export async function saveCharacter(
  sheet: CharacterSheet,
  opts?: { force?: boolean; visibility?: "private" | "public"; useOptimisticLock?: boolean }
): Promise<SaveResponse> {
  const sanitized: CharacterSheet = {
    ...sheet,
    weapons: (sheet.weapons ?? []).map(({ gameplayEffects, ...weapon }) => weapon),
    armour: sheet.armour
      ? (({ gameplayEffects, ...armour }) => armour)(sheet.armour)
      : undefined,
    inventory: (sheet.inventory ?? []).map((item) => {
      const { gameplayEffects, ...rest } = item as CharacterSheet["inventory"][number] & {
        gameplayEffects?: string[];
      };
      return rest as CharacterSheet["inventory"][number];
    }),
    feats: (sheet.feats ?? []).map(({ gameplayEffects, ...feat }) => feat),
  };
  const validation = validateCharacterRecordV1(sanitized);
  if (!validation.ok) {
    return { ok: false, error: `validation_failed: ${validation.errors[0]}` };
  }
  const useOptimisticLock = opts?.useOptimisticLock ?? true;
  const params = new URLSearchParams();
  if (opts?.force) params.set("force", "1");
  if (opts?.visibility) params.set("visibility", opts.visibility);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/characters/${sanitized.id}${query ? `?${query}` : ""}`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      ...(useOptimisticLock && sanitized.updatedAt
        ? { "If-Unmodified-Since": sanitized.updatedAt }
        : {}),
    },
    credentials: "include",
    body: JSON.stringify(sanitized),
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
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete character");
}

export async function adminListCharacters(): Promise<AdminListResponse> {
  const res = await fetch(`${API_BASE}/admin/characters`, {
    headers: authHeaders({ includeApiKey: true }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load admin list");
  return (await res.json()) as AdminListResponse;
}

export async function adminDeleteAll(): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`${API_BASE}/admin/characters?confirm=1`, {
    method: "DELETE",
    headers: authHeaders({ includeApiKey: true }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete all characters");
  return (await res.json()) as { ok: boolean; deleted: number };
}
