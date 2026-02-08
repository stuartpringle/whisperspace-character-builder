import type { CharacterSheet } from "../model/character";

const DRAFT_KEY = "ws_character_builder_draft_v1";

export function loadDraft(): CharacterSheet | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CharacterSheet;
  } catch {
    return null;
  }
}

export function saveDraft(sheet: CharacterSheet) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(sheet));
  } catch {
    // ignore storage errors
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore storage errors
  }
}
