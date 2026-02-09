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
    background: "",
    motivation: "",
    attributes: {
      phys: 0,
      ref: 0,
      soc: 0,
      ment: 0,
    },
    skills: {},
    learningFocus: undefined,
    skillPoints: 0,
    stress: { current: 0, cuf: 0, cufLoss: 0 },
    wounds: { light: 0, moderate: 0, heavy: 0 },
    weapons: [],
    armour: undefined,
    inventory: [],
    credits: 0,
    feats: [],
    indomitable: false,
    notes: "",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function updateTimestamp(sheet: CharacterSheet): CharacterSheet {
  return { ...sheet, updatedAt: new Date().toISOString() };
}
