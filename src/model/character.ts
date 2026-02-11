export type AttributeKey = "phys" | "ref" | "soc" | "ment";

export type Weapon = {
  id?: string;
  name?: string;
  skillId?: string;
  useDC?: number;
  damage?: number;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
  range?: string;
  ammo?: number;
  bulk?: number;
  req?: string;
  cost?: number;
};

export type Armour = {
  name?: string;
  keywords?: string[];
  keywordParams?: Record<string, string | number | boolean>;
  protection?: number;
  durability?: { current?: number; max?: number };
  bulk?: number;
  req?: string;
  cost?: number;
  special?: string;
};

export type InventoryItem =
  | {
      id?: string;
      type: "item";
      name?: string;
      quantity?: number;
      uses?: string;
      bulk?: number;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    }
  | {
      id?: string;
      type: "cyberware";
      name?: string;
      quantity?: number;
      bulk?: number;
      tier?: number;
      installationDifficulty?: number;
      requirements?: string;
      physicalImpact?: string;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    }
  | {
      id?: string;
      type: "narcotics";
      name?: string;
      bulk?: number;
      quantity?: number;
      uses?: number;
      addictionScore?: number;
      legality?: string;
      effect?: string;
      cost?: number;
      statusEffects?: string;
    }
  | {
      id?: string;
      type: "hacker_gear";
      name?: string;
      quantity?: number;
      bulk?: number;
      cost?: number;
      notes?: string;
      systemTierAccess?: number;
      maxSoftwareTier?: number;
      tier?: number;
    };

export type CharacterSheet = {
  id: string;
  name: string;
  background: string;
  motivation: string;
  attributes: Record<AttributeKey, number>;
  skills: Record<string, number>;
  learningFocus?: "combat" | "education" | "vehicles";
  skillPoints?: number;
  stress: { current: number; cuf: number; cufLoss: number };
  wounds: { light: number; moderate: number; heavy: number };
  weapons: Weapon[];
  armour?: Armour;
  inventory: InventoryItem[];
  credits: number;
  feats: Array<{ name?: string; description?: string; statusEffects?: string }>;
  indomitable: boolean;
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
