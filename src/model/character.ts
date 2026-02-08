export type AttributeKey =
  | "phys"
  | "dex"
  | "int"
  | "will"
  | "cha"
  | "emp";

export type SkillEntry = {
  key: string;
  label: string;
  rank: number;
  focus?: string;
};

export type GearEntry = {
  id: string;
  name: string;
  type: "weapon" | "armour" | "item" | "cyberware" | "narcotic" | "hacker_gear";
  tags?: string[];
  notes?: string;
};

export type CharacterSheet = {
  id: string;
  name: string;
  concept: string;
  background: string;
  level: number;
  attributes: Record<AttributeKey, number>;
  skills: SkillEntry[];
  gear: GearEntry[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: 1;
};

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
      dex: 0,
      int: 0,
      will: 0,
      cha: 0,
      emp: 0,
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
