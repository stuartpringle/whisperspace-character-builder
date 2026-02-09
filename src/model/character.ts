import type {
  CharacterRecordAttributeKey as AttributeKey,
  CharacterRecordV1 as CharacterSheet,
} from "@whisperspace/sdk";

export type BuilderStep = "basics" | "attributes" | "skills" | "gear" | "review";

export function createBlankCharacter(): CharacterSheet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    concept: "",
    background: "",
    level: 1,
    attributes: {
      phys: 0,
      ref: 0,
      soc: 0,
      ment: 0,
    },
    skills: [],
    gear: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function updateTimestamp(sheet: CharacterSheet): CharacterSheet {
  return { ...sheet, updatedAt: new Date().toISOString() };
}
