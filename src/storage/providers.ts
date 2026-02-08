import type { CharacterSheet } from "../model/character";
import { saveDraft } from "./local";
import { downloadCharacter } from "./transfer";
import { listCharacters, fetchCharacter, saveCharacter, deleteCharacter } from "./remote";

export type StorageTarget = "draft" | "cloud" | "export";

export type SaveResult = {
  ok: boolean;
  message?: string;
  conflict?: CharacterSheet;
};

export type StorageProvider = {
  id: StorageTarget;
  label: string;
  save: (sheet: CharacterSheet) => Promise<SaveResult>;
  list?: () => Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  load?: (id: string) => Promise<CharacterSheet>;
  remove?: (id: string) => Promise<void>;
};

export function getProviders(): StorageProvider[] {
  return [
    {
      id: "draft",
      label: "Local Draft",
      save: async (sheet) => {
        saveDraft(sheet);
        return { ok: true, message: "Draft saved" };
      },
    },
    {
      id: "cloud",
      label: "Cloud",
      save: async (sheet) => saveCharacter(sheet),
      list: async () => listCharacters(),
      load: async (id) => fetchCharacter(id),
      remove: async (id) => deleteCharacter(id),
    },
    {
      id: "export",
      label: "Export JSON",
      save: async (sheet) => {
        downloadCharacter(sheet);
        return { ok: true, message: "Downloaded JSON" };
      },
    },
  ];
}
