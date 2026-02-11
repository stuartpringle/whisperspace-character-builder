import { useEffect, useMemo, useRef, useState } from "react";
 
import type { AttributeKey, BuilderStep, CharacterSheet } from "./model/character";
import { createBlankCharacter, updateTimestamp } from "./model/character";
import { CHARACTER_API_BASE } from "./model/api";
import { validateCharacterRecordV1 } from "./model/validate";
import { clearDraft, loadDraft, saveDraft } from "./storage/local";
import { downloadCharacter, readCharacterFile } from "./storage/transfer";
import { saveCharacter } from "./storage/remote";
 

const STEPS: { id: BuilderStep; label: string; hint: string }[] = [
  { id: "basics", label: "Basics", hint: "Who are they?" },
  { id: "attributes", label: "Attributes", hint: "Core stats" },
  { id: "skills", label: "Skills", hint: "Focus and ranks" },
  { id: "gear", label: "Inventory", hint: "Loadout" },
  { id: "review", label: "Review", hint: "Summary" },
];

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  phys: "Phys",
  ref: "Ref",
  soc: "Soc",
  ment: "Ment",
};

type LearningFocus = "combat" | "education" | "vehicles";

type SkillEntry = {
  id: string;
  label: string;
  attribute: AttributeKey;
};

type SkillsData = {
  version: number;
  inherent: SkillEntry[];
  learned: Record<LearningFocus, SkillEntry[]>;
};
type SkillTooltips = {
  attributes?: Record<string, string>;
  skills?: Record<string, string>;
};

type BackgroundOption = {
  name: string;
  description: string;
};

type MotivationOption = {
  name: string;
};

type AuthUser = { id: string; email: string };

const MAX_RANK_INHERENT = 5;
const MAX_RANK_ON_FOCUS = 5;
const MAX_RANK_OFF_FOCUS = 2;

type GearType = "item" | "cyberware" | "narcotics" | "hacker_gear";

type ItemsData = { items: Array<{ name: string; effect?: string; uses?: string; bulk?: number; cost?: number }> };
type CyberwareData = {
  cyberware: Array<{
    name: string;
    tier?: number;
    effect?: string;
    installationDifficulty?: number;
    requirements?: string;
    physicalImpact?: string;
    bulk?: number;
    cost?: number;
  }>;
};
type NarcoticsData = {
  narcotics: Array<{
    name: string;
    effect?: string;
    uses?: number;
    addictionScore?: number;
    legality?: string;
    bulk?: number;
    cost?: number;
  }>;
};
type HackingGearData = {
  rigs: Array<{
    name: string;
    systemTierAccess?: number;
    maxSoftwareTier?: number;
    bulk?: number;
    cost?: number;
  }>;
  software: Array<{
    name: string;
    tier?: number;
    notes?: string;
    cost?: number;
  }>;
};

type WeaponsData = {
  weapons: Array<{
    id?: string;
    name: string;
    skillId?: string;
    useDC?: number;
    damage?: number;
    range?: string;
    ammo?: number;
    bulk?: number;
    cost?: number;
    req?: string;
    keywords?: string[];
  }>;
};

type ArmourData = {
  armor: Array<{
    id?: string;
    name: string;
    protection?: number;
    durability?: number;
    bulk?: number;
    cost?: number;
    req?: string;
    special?: string;
    keywords?: string[];
  }>;
};

type GearData = {
  items: ItemsData;
  cyberware: CyberwareData;
  narcotics: NarcoticsData;
  hacking: HackingGearData;
  weapons: WeaponsData;
  armour: ArmourData;
};

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");
  const [rulesVersion, setRulesVersion] = useState<string>("");
  const [rulesFetchedAt, setRulesFetchedAt] = useState<string>("");
  const rulesBase = useMemo(
    () =>
      (import.meta as any).env?.VITE_RULES_API_BASE ||
      "https://rules-api.whisperspace.com/rules-api/latest",
    []
  );
  const calcBase = useMemo(
    () =>
      (import.meta as any).env?.VITE_CALC_API_BASE ||
      "https://rules-api.whisperspace.com/rules-api/calc",
    []
  );
  const apiBase = useMemo(
    () => (import.meta as any).env?.VITE_CHARACTER_API_BASE || CHARACTER_API_BASE,
    []
  );
  const [sheet, setSheet] = useState<CharacterSheet>(() => loadDraft() ?? createBlankCharacter());
  const [step, setStep] = useState<BuilderStep>("basics");
  const [importError, setImportError] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [conflictSheet, setConflictSheet] = useState<CharacterSheet | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [skillsData, setSkillsData] = useState<SkillsData | null>(null);
  const [skillsStatus, setSkillsStatus] = useState<string>("idle");
  const [skillsError, setSkillsError] = useState<string>("");
  const [skillTooltips, setSkillTooltips] = useState<SkillTooltips | null>(null);
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [derivedStats, setDerivedStats] = useState<{ speed: number; capacity: number }>({
    speed: 0,
    capacity: 0,
  });
  const [backgroundOptions, setBackgroundOptions] = useState<BackgroundOption[]>([]);
  const [motivationOptions, setMotivationOptions] = useState<MotivationOption[]>([]);
  const [rulesStatus, setRulesStatus] = useState<string>("idle");
  const [rulesError, setRulesError] = useState<string>("");
  const [rulesCacheNote, setRulesCacheNote] = useState<string>("");
  const [backgroundPick, setBackgroundPick] = useState<string>("");
  const [motivationPick, setMotivationPick] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [showResetRequest, setShowResetRequest] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [resetPassword, setResetPassword] = useState<string>("");
  const [resetToken, setResetToken] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [saveVisibility, setSaveVisibility] = useState<"private" | "public">("private");
  const [saveNew, setSaveNew] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");
  const [viewId, setViewId] = useState<string>("");
  const [viewSheet, setViewSheet] = useState<CharacterSheet | null>(null);
  const [viewError, setViewError] = useState<string>("");
  const [gearData, setGearData] = useState<GearData | null>(null);
  const [gearStatus, setGearStatus] = useState<string>("idle");
  const [gearError, setGearError] = useState<string>("");
  const [gearPickType, setGearPickType] = useState<GearType>("item");
  const [gearPickName, setGearPickName] = useState<string>("");
  const [gearSearch, setGearSearch] = useState<string>("");
  const [customGearType, setCustomGearType] = useState<GearType>("item");
  const [weaponPickId, setWeaponPickId] = useState<string>("");
  const [weaponSearch, setWeaponSearch] = useState<string>("");
  const [armourPickId, setArmourPickId] = useState<string>("");
  const [armourSearch, setArmourSearch] = useState<string>("");
  const [skillValidation, setSkillValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    spent: number;
    remaining: number;
  } | null>(null);
  const skillCalcTimer = useRef<number | null>(null);
  const deriveTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const cachedMeta = localStorage.getItem("ws_rules_meta_json");
    if (cachedMeta) {
      try {
        const meta = JSON.parse(cachedMeta) as { version?: string };
        if (meta?.version) setRulesVersion(meta.version);
      } catch {
        // ignore cache errors
      }
    }

    fetch(`${rulesBase}/meta.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((meta) => {
        if (!active) return;
        setApiStatus(`rules v${meta.version}`);
        setRulesVersion(meta.version ?? "");
        setRulesFetchedAt(new Date().toISOString());
        localStorage.setItem("ws_rules_meta_json", JSON.stringify(meta));
        localStorage.setItem("ws_rules_meta_fetched_at", new Date().toISOString());
      })
      .catch(() => {
        if (!active) return;
        setApiStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token") || "";
    if (token) {
      setResetToken(token);
      setSaveDialogOpen(true);
    }
    if (url.pathname.startsWith("/character/")) {
      setViewId(url.pathname.replace("/character/", ""));
    }
  }, []);

  const fetchSession = async (force = false) => {
    const cached = localStorage.getItem("ws_auth_session");
    const cachedAt = localStorage.getItem("ws_auth_session_at");
    if (!force && cached && cachedAt) {
      const ageMs = Date.now() - Number(cachedAt);
      if (ageMs >= 0 && ageMs < 5 * 60 * 1000) {
        try {
          const payload = JSON.parse(cached) as { user: AuthUser | null };
          setUser(payload.user ?? null);
          return;
        } catch {
          // ignore cache errors
        }
      }
    }
    try {
      const res = await fetch(`${apiBase}/auth/session`, { credentials: "include" });
      if (!res.ok) return;
      const payload = (await res.json()) as { user: AuthUser | null };
      setUser(payload.user ?? null);
      localStorage.setItem("ws_auth_session", JSON.stringify(payload));
      localStorage.setItem("ws_auth_session_at", String(Date.now()));
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    void fetchSession();
  }, [apiBase]);

  useEffect(() => {
    let active = true;
    setRulesStatus("loading");
    setRulesError("");
    const cachedRules = localStorage.getItem("ws_rules_rules_json");
    const cachedMetaAt = localStorage.getItem("ws_rules_meta_fetched_at");
    if (cachedMetaAt) setRulesFetchedAt(cachedMetaAt);
    if (cachedRules) {
      try {
        const data = JSON.parse(cachedRules);
        const backgroundRows: BackgroundOption[] = [];
        const motivationRows: MotivationOption[] = [];
        const walk = (node: any) => {
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(walk);
            return;
          }
          if (typeof node === "object") {
            if (node.type === "table" && Array.isArray(node.rows)) {
              const rows = node.rows as Array<Array<{ text?: string }>>;
              const header = rows[0]?.map((cell) => (cell?.text ?? "").toLowerCase()).join("|");
              if (header?.includes("backgrounds")) {
                for (const row of rows.slice(2)) {
                  const name = row?.[1]?.text?.trim() ?? "";
                  const description = row?.[2]?.text?.trim() ?? "";
                  if (name) backgroundRows.push({ name, description });
                }
              }
              if (header?.includes("motivations")) {
                for (const row of rows.slice(2)) {
                  const name = row?.[1]?.text?.trim() ?? "";
                  if (name && !name.toLowerCase().startsWith("roll twice")) {
                    motivationRows.push({ name });
                  }
                }
              }
            }
            Object.values(node).forEach(walk);
          }
        };
        walk(data);
        if (backgroundRows.length) setBackgroundOptions(backgroundRows);
        if (motivationRows.length) setMotivationOptions(motivationRows);
        setRulesCacheNote("Using cached rules data.");
      } catch {
        // ignore cache errors
      }
    }

    fetch(`${rulesBase}/rules.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data) => {
        if (!active) return;
        localStorage.setItem("ws_rules_rules_json", JSON.stringify(data));
        const backgroundRows: BackgroundOption[] = [];
        const motivationRows: MotivationOption[] = [];

        const walk = (node: any) => {
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(walk);
            return;
          }
          if (typeof node === "object") {
            if (node.type === "table" && Array.isArray(node.rows)) {
              const rows = node.rows as Array<Array<{ text?: string }>>;
              const header = rows[0]?.map((cell) => (cell?.text ?? "").toLowerCase()).join("|");
              if (header?.includes("backgrounds")) {
                for (const row of rows.slice(2)) {
                  const name = row?.[1]?.text?.trim() ?? "";
                  const description = row?.[2]?.text?.trim() ?? "";
                  if (name) backgroundRows.push({ name, description });
                }
              }
              if (header?.includes("motivations")) {
                for (const row of rows.slice(2)) {
                  const name = row?.[1]?.text?.trim() ?? "";
                  if (name && !name.toLowerCase().startsWith("roll twice")) {
                    motivationRows.push({ name });
                  }
                }
              }
            }
            Object.values(node).forEach(walk);
          }
        };

        walk(data);
        setBackgroundOptions(backgroundRows);
        setMotivationOptions(motivationRows);
        if (!backgroundPick && backgroundRows.length) {
          setBackgroundPick(backgroundRows[0].name);
        }
        if (!motivationPick && motivationRows.length) {
          setMotivationPick(motivationRows[0].name);
        }
        setRulesStatus("ready");
        setRulesCacheNote("");
      })
      .catch(() => {
        if (!active) return;
        setRulesError("Unable to load background/motivation tables from Rules API.");
        setRulesStatus(backgroundOptions.length || motivationOptions.length ? "cached" : "error");
        if (backgroundOptions.length || motivationOptions.length) {
          setRulesCacheNote("Can't connect to Rules API; using cached data.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setSkillsStatus("loading");
    setSkillsError("");
    const cachedSkills = localStorage.getItem("ws_rules_skills_json");
    if (cachedSkills) {
      try {
        const data = JSON.parse(cachedSkills) as SkillsData;
        setSkillsData(data);
        setSkillsStatus("cached");
        setRulesCacheNote("Using cached rules data.");
      } catch {
        // ignore cache errors
      }
    }

    Promise.all([
      fetch(`${rulesBase}/skills.json`).then((res) =>
        res.ok ? (res.json() as Promise<SkillsData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/skill_tooltips.json`).then((res) =>
        res.ok ? (res.json() as Promise<SkillTooltips>) : Promise.reject(new Error("bad response"))
      ),
    ])
      .then(([data, tooltips]) => {
        if (!active) return;
        localStorage.setItem("ws_rules_skills_json", JSON.stringify(data));
        setSkillsData(data);
        setSkillTooltips(tooltips);
        setSkillsStatus("ready");
        setRulesCacheNote("");
      })
      .catch(() => {
        if (!active) return;
        setSkillsError("Unable to load skills from the Rules API.");
        setSkillsStatus(skillsData ? "cached" : "error");
        if (skillsData) setRulesCacheNote("Can't connect to Rules API; using cached data.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setGearStatus("loading");
    setGearError("");
    const cachedGear = localStorage.getItem("ws_rules_gear_json");
    if (cachedGear) {
      try {
        const data = JSON.parse(cachedGear) as GearData;
        setGearData(data);
        setGearStatus("cached");
        setRulesCacheNote("Using cached rules data.");
      } catch {
        // ignore cache errors
      }
    }

    Promise.all([
      fetch(`${rulesBase}/items.json`).then((res) =>
        res.ok ? (res.json() as Promise<ItemsData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/cyberware.json`).then((res) =>
        res.ok ? (res.json() as Promise<CyberwareData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/narcotics.json`).then((res) =>
        res.ok ? (res.json() as Promise<NarcoticsData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/hacking_gear.json`).then((res) =>
        res.ok ? (res.json() as Promise<HackingGearData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/weapons.json`).then((res) =>
        res.ok ? (res.json() as Promise<WeaponsData>) : Promise.reject(new Error("bad response"))
      ),
      fetch(`${rulesBase}/armour.json`).then((res) =>
        res.ok ? (res.json() as Promise<ArmourData>) : Promise.reject(new Error("bad response"))
      ),
    ])
      .then(([items, cyberware, narcotics, hacking, weapons, armour]) => {
        if (!active) return;
        const payload = { items, cyberware, narcotics, hacking, weapons, armour };
        localStorage.setItem("ws_rules_gear_json", JSON.stringify(payload));
        setGearData(payload);
        setGearStatus("ready");
        if (!gearPickName) {
          const firstItem = items.items?.[0]?.name ?? "";
          setGearPickName(firstItem);
        }
        if (!weaponPickId) {
          const firstWeapon = weapons.weapons?.[0]?.id ?? "";
          setWeaponPickId(firstWeapon);
        }
        if (!armourPickId) {
          const firstArmour = armour.armor?.[0]?.id ?? "";
          setArmourPickId(firstArmour);
        }
        setRulesCacheNote("");
      })
      .catch(() => {
        if (!active) return;
        setGearError("Unable to load gear catalogs from the Rules API.");
        setGearStatus(gearData ? "cached" : "error");
        if (gearData) setRulesCacheNote("Can't connect to Rules API; using cached data.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveDraft(sheet);
  }, [sheet]);

  // Cloud sync is now handled through the Save dialog and authenticated sessions.

  useEffect(() => {
    if (!skillsData) return;
    if (skillCalcTimer.current) window.clearTimeout(skillCalcTimer.current);
    skillCalcTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`${calcBase}/validate-sheet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheet: {
              ...sheet,
              learningFocus: sheet.learningFocus ?? "combat",
              skillPoints: sheet.skillPoints ?? 0,
            },
            learnedByFocus: skillsData.learned,
            inherentSkills: skillsData.inherent,
            maxRankInherent: MAX_RANK_INHERENT,
            maxRankOnFocus: MAX_RANK_ON_FOCUS,
            maxRankOffFocus: MAX_RANK_OFF_FOCUS,
          }),
        });
        if (!res.ok) throw new Error("bad response");
        const data = (await res.json()) as {
          valid: boolean;
          errors: string[];
          warnings: string[];
          spent: number;
          remaining: number;
        };
        setSkillValidation(data);
      } catch {
        setSkillValidation(null);
      }
    }, 300);
    return () => {
      if (skillCalcTimer.current) window.clearTimeout(skillCalcTimer.current);
    };
  }, [skillsData, sheet.skills, sheet.skillPoints, sheet.learningFocus]);

  useEffect(() => {
    if (!skillsData) return;
    if (deriveTimer.current) window.clearTimeout(deriveTimer.current);
    deriveTimer.current = window.setTimeout(async () => {
      try {
        const [attrsRes, cufRes] = await Promise.all([
          fetch(`${calcBase}/derive-attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skills: sheet.skills ?? {},
              inherentSkills: skillsData.inherent,
            }),
          }),
          fetch(`${calcBase}/derive-cuf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skills: sheet.skills ?? {} }),
          }),
        ]);
        if (!attrsRes.ok || !cufRes.ok) return;
        const attrs = (await attrsRes.json()) as CharacterSheet["attributes"];
        const cufPayload = (await cufRes.json()) as { cuf: number };
        const phys = attrs.phys ?? sheet.attributes.phys;
        const [speedRes, capacityRes] = await Promise.all([
          fetch(`${calcBase}/derive-speed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phys }),
          }),
          fetch(`${calcBase}/derive-capacity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phys }),
          }),
        ]);
        if (speedRes.ok && capacityRes.ok) {
          const speedPayload = (await speedRes.json()) as { speed: number };
          const capacityPayload = (await capacityRes.json()) as { capacity: number };
          setDerivedStats({
            speed: speedPayload.speed ?? 0,
            capacity: capacityPayload.capacity ?? 0,
          });
        }
        updateSheet({
          ...sheet,
          attributes: {
            phys: attrs.phys ?? sheet.attributes.phys,
            ref: attrs.ref ?? sheet.attributes.ref,
            soc: attrs.soc ?? sheet.attributes.soc,
            ment: attrs.ment ?? sheet.attributes.ment,
          },
          stress: {
            ...sheet.stress,
            cuf: cufPayload.cuf ?? sheet.stress.cuf,
          },
        });
      } catch {
        // ignore derive failures
      }
    }, 400);
    return () => {
      if (deriveTimer.current) window.clearTimeout(deriveTimer.current);
    };
  }, [skillsData, sheet.skills]);

 

  const currentStepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === step),
    [step]
  );

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const updateSheet = (next: CharacterSheet) => setSheet(updateTimestamp(next));

  const handleImport = async (file: File | null) => {
    setImportError("");
    if (!file) return;
    try {
      const imported = await readCharacterFile(file);
      updateSheet({ ...imported, id: imported.id || crypto.randomUUID() });
      setStep("review");
    } catch {
      setImportError("Could not read that file.");
    }
  };

  const learningFocus = (sheet.learningFocus ?? "combat") as LearningFocus;
  const activeArmour = sheet.armour;
  const authFeedback = useMemo(() => {
    if (!authError) return null;
    if (authError === "reset_email_sent") {
      return {
        tone: "success" as const,
        text: "If that email exists, a reset link has been sent.",
      };
    }
    if (authError === "password_reset_ok") {
      return {
        tone: "success" as const,
        text: "Password updated. You can now sign in.",
      };
    }
    if (authError === "logout_failed") {
      return {
        tone: "error" as const,
        text: "Could not sign out right now. Try again.",
      };
    }
    if (authError === "reset_request_failed") {
      return {
        tone: "error" as const,
        text: "Could not send reset email. Check the address and try again.",
      };
    }
    if (authError === "reset_failed") {
      return {
        tone: "error" as const,
        text: "Reset link is invalid or expired. Request a new link.",
      };
    }
    if (authError === "auth_failed") {
      return {
        tone: "error" as const,
        text: "Sign in failed. Check email/password and try again.",
      };
    }
    return { tone: "error" as const, text: authError };
  }, [authError]);

  const gearTotals = useMemo(() => {
    const inventory = sheet.inventory ?? [];
    const weapons = sheet.weapons ?? [];
    const armour = sheet.armour;
    const invBulk = inventory.reduce((sum, item) => {
      const bulk = typeof item.bulk === "number" ? item.bulk : 0;
      const qty = typeof item.quantity === "number" ? item.quantity : 1;
      return sum + bulk * Math.max(1, qty);
    }, 0);
    const invCost = inventory.reduce((sum, item) => {
      const cost = typeof item.cost === "number" ? item.cost : 0;
      const qty = typeof item.quantity === "number" ? item.quantity : 1;
      return sum + cost * Math.max(1, qty);
    }, 0);
    const weaponBulk = weapons.reduce((sum, weapon) => sum + (weapon.bulk ?? 0), 0);
    const weaponCost = weapons.reduce((sum, weapon) => sum + (weapon.cost ?? 0), 0);
    const armourBulk = armour?.bulk ?? 0;
    const armourCost = armour?.cost ?? 0;
    return {
      bulk: invBulk + weaponBulk + armourBulk,
      cost: invCost + weaponCost + armourCost,
    };
  }, [sheet.inventory, sheet.weapons, sheet.armour]);

  const updateSkillRank = (id: string, next: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, next));
    const nextSkills = { ...(sheet.skills ?? {}) };
    if (clamped <= 0) {
      delete nextSkills[id];
    } else {
      nextSkills[id] = clamped;
    }
    updateSheet({ ...sheet, skills: nextSkills });
  };

  const addInventoryItem = (item: CharacterSheet["inventory"][number]) => {
    updateSheet({ ...sheet, inventory: [...(sheet.inventory ?? []), item] });
  };

  const updateInventoryItem = (
    index: number,
    next: Partial<CharacterSheet["inventory"][number]>
  ) => {
    const nextInventory = [...(sheet.inventory ?? [])];
    const current = nextInventory[index];
    if (!current) return;
    nextInventory[index] = { ...current, ...next } as CharacterSheet["inventory"][number];
    updateSheet({ ...sheet, inventory: nextInventory });
  };

  const removeInventoryItem = (index: number) => {
    const nextInventory = [...(sheet.inventory ?? [])];
    nextInventory.splice(index, 1);
    updateSheet({ ...sheet, inventory: nextInventory });
  };

  const filterOptions = (options: Array<{ key: string; label: string }>, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  };

  const buildGearOptions = (type: GearType, query = "") => {
    if (!gearData) return [];
    if (type === "item") {
      return filterOptions(
        gearData.items.items.map((entry) => ({ key: entry.name, label: entry.name })),
        query
      );
    }
    if (type === "cyberware") {
      return filterOptions(
        gearData.cyberware.cyberware.map((entry) => ({ key: entry.name, label: entry.name })),
        query
      );
    }
    if (type === "narcotics") {
      return filterOptions(
        gearData.narcotics.narcotics.map((entry) => ({ key: entry.name, label: entry.name })),
        query
      );
    }
    return filterOptions(
      [
        ...gearData.hacking.rigs.map((entry) => ({
          key: `rig:${entry.name}`,
          label: `Rig: ${entry.name}`,
        })),
        ...gearData.hacking.software.map((entry) => ({
          key: `software:${entry.name}`,
          label: `Software: ${entry.name}`,
        })),
      ],
      query
    );
  };

  const buildWeaponOptions = (query = "") => {
    if (!gearData) return [];
    return filterOptions(
      gearData.weapons.weapons.map((entry) => ({ key: entry.id ?? entry.name, label: entry.name })),
      query
    );
  };

  const buildArmourOptions = (query = "") => {
    if (!gearData) return [];
    return filterOptions(
      gearData.armour.armor.map((entry) => ({ key: entry.id ?? entry.name, label: entry.name })),
      query
    );
  };

  const addSelectedGear = () => {
    if (!gearData || !gearPickName) return;
    if (gearPickType === "item") {
      const entry = gearData.items.items.find((item) => item.name === gearPickName);
      if (!entry) return;
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "item",
        name: entry.name,
        quantity: 1,
        uses: entry.uses,
        bulk: entry.bulk,
        effect: entry.effect,
        cost: entry.cost,
      });
      return;
    }
    if (gearPickType === "cyberware") {
      const entry = gearData.cyberware.cyberware.find((item) => item.name === gearPickName);
      if (!entry) return;
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "cyberware",
        name: entry.name,
        quantity: 1,
        tier: entry.tier,
        installationDifficulty: entry.installationDifficulty,
        requirements: entry.requirements,
        physicalImpact: entry.physicalImpact,
        bulk: entry.bulk,
        effect: entry.effect,
        cost: entry.cost,
      });
      return;
    }
    if (gearPickType === "narcotics") {
      const entry = gearData.narcotics.narcotics.find((item) => item.name === gearPickName);
      if (!entry) return;
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "narcotics",
        name: entry.name,
        quantity: 1,
        uses: entry.uses,
        addictionScore: entry.addictionScore,
        legality: entry.legality,
        bulk: entry.bulk,
        effect: entry.effect,
        cost: entry.cost,
      });
      return;
    }
    if (gearPickType === "hacker_gear") {
      if (gearPickName.startsWith("rig:")) {
        const name = gearPickName.replace("rig:", "");
        const entry = gearData.hacking.rigs.find((item) => item.name === name);
        if (!entry) return;
        addInventoryItem({
          id: crypto.randomUUID(),
          type: "hacker_gear",
          name: entry.name,
          quantity: 1,
          systemTierAccess: entry.systemTierAccess,
          maxSoftwareTier: entry.maxSoftwareTier,
          bulk: entry.bulk,
          cost: entry.cost,
        });
        return;
      }
      if (gearPickName.startsWith("software:")) {
        const name = gearPickName.replace("software:", "");
        const entry = gearData.hacking.software.find((item) => item.name === name);
        if (!entry) return;
        addInventoryItem({
          id: crypto.randomUUID(),
          type: "hacker_gear",
          name: entry.name,
          quantity: 1,
          tier: entry.tier,
          notes: entry.notes,
          cost: entry.cost,
        });
      }
    }
  };

  const addCustomGear = () => {
    if (customGearType === "item") {
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "item",
        name: "",
        quantity: 1,
        uses: "",
        bulk: 0,
        effect: "",
        cost: 0,
      });
      return;
    }
    if (customGearType === "cyberware") {
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "cyberware",
        name: "",
        quantity: 1,
        tier: 0,
        installationDifficulty: 0,
        requirements: "",
        physicalImpact: "",
        bulk: 0,
        effect: "",
        cost: 0,
      });
      return;
    }
    if (customGearType === "narcotics") {
      addInventoryItem({
        id: crypto.randomUUID(),
        type: "narcotics",
        name: "",
        quantity: 1,
        uses: 0,
        addictionScore: 0,
        legality: "",
        bulk: 0,
        effect: "",
        cost: 0,
      });
      return;
    }
    addInventoryItem({
      id: crypto.randomUUID(),
      type: "hacker_gear",
      name: "",
      quantity: 1,
      systemTierAccess: 0,
      maxSoftwareTier: 0,
      tier: 0,
      bulk: 0,
      cost: 0,
      notes: "",
    });
  };

  const addSelectedWeapon = () => {
    if (!gearData || !weaponPickId) return;
    const entry =
      gearData.weapons.weapons.find((weapon) => weapon.id === weaponPickId) ??
      gearData.weapons.weapons.find((weapon) => weapon.name === weaponPickId);
    if (!entry) return;
    updateSheet({
      ...sheet,
      weapons: [
        ...(sheet.weapons ?? []),
        {
          id: entry.id ?? crypto.randomUUID(),
          name: entry.name,
          skillId: entry.skillId,
          useDC: entry.useDC,
          damage: entry.damage,
          range: entry.range,
          ammo: entry.ammo,
          bulk: entry.bulk,
          cost: entry.cost,
          req: entry.req,
          keywords: entry.keywords,
        },
      ],
    });
  };

  const updateWeapon = (index: number, next: Partial<CharacterSheet["weapons"][number]>) => {
    const nextWeapons = [...(sheet.weapons ?? [])];
    const current = nextWeapons[index];
    if (!current) return;
    nextWeapons[index] = { ...current, ...next };
    updateSheet({ ...sheet, weapons: nextWeapons });
  };

  const removeWeapon = (index: number) => {
    const nextWeapons = [...(sheet.weapons ?? [])];
    nextWeapons.splice(index, 1);
    updateSheet({ ...sheet, weapons: nextWeapons });
  };

  const equipArmour = () => {
    if (!gearData || !armourPickId) return;
    const entry =
      gearData.armour.armor.find((armor) => armor.id === armourPickId) ??
      gearData.armour.armor.find((armor) => armor.name === armourPickId);
    if (!entry) return;
    updateSheet({
      ...sheet,
      armour: {
        name: entry.name,
        protection: entry.protection,
        durability: entry.durability
          ? { current: entry.durability, max: entry.durability }
          : undefined,
        bulk: entry.bulk,
        req: entry.req,
        cost: entry.cost,
        special: entry.special,
        keywords: entry.keywords,
      },
    });
  };

  const applyBackground = (name: string) => {
    const entry = backgroundOptions.find((opt) => opt.name === name);
    if (!entry) return;
    const text = entry.description ? `${entry.name} — ${entry.description}` : entry.name;
    updateSheet({ ...sheet, background: text });
  };

  const rollBackground = () => {
    if (!backgroundOptions.length) return;
    const index = Math.floor(Math.random() * backgroundOptions.length);
    const entry = backgroundOptions[index];
    setBackgroundPick(entry.name);
    applyBackground(entry.name);
  };

  const applyMotivation = (name: string) => {
    if (!name) return;
    updateSheet({ ...sheet, motivation: name });
  };

  const rollMotivation = () => {
    if (!motivationOptions.length) return;
    const roll = () => motivationOptions[Math.floor(Math.random() * motivationOptions.length)].name;
    const first = roll();
    let result = first;
    const d12 = Math.floor(Math.random() * 12) + 1;
    if (d12 === 12) {
      let second = roll();
      while (second === first && motivationOptions.length > 1) {
        second = roll();
      }
      result = `${first} + ${second}`;
    }
    setMotivationPick(first);
    updateSheet({ ...sheet, motivation: result });
  };

  const getCookie = (name: string) => {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
  };

  const csrfHeader = (): Record<string, string> => {
    const token = getCookie("ws_csrf");
    return token ? { "X-CSRF-Token": token } : {};
  };

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const payload = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || payload.error) {
        setAuthError(payload.error || "auth_failed");
      } else {
        setUser(payload.user ?? null);
        setAuthEmail("");
        setAuthPassword("");
        localStorage.setItem("ws_auth_session", JSON.stringify({ user: payload.user ?? null }));
        localStorage.setItem("ws_auth_session_at", String(Date.now()));
      }
    } catch {
      setAuthError("auth_failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthError("");
    try {
      const res = await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeader() },
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        localStorage.removeItem("ws_auth_session");
        localStorage.removeItem("ws_auth_session_at");
      }
    } catch {
      setAuthError("logout_failed");
    }
  };

  const handlePasswordRequest = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: resetEmail }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || payload.error) {
        setAuthError(payload.error || "reset_request_failed");
      } else {
        setAuthError("reset_email_sent");
      }
    } catch {
      setAuthError("reset_request_failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetToken) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || payload.error) {
        setAuthError(payload.error || "reset_failed");
      } else {
        setAuthError("password_reset_ok");
        setResetToken("");
        setResetPassword("");
      }
    } catch {
      setAuthError("reset_failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCloudSave = async () => {
    setSaveStatus("saving...");
    setSaveError("");
    setConflictSheet(null);
    setValidationErrors([]);
    const safeSkills =
      sheet.skills && !Array.isArray(sheet.skills)
        ? Object.fromEntries(Object.entries(sheet.skills))
        : {};
    const normalized: CharacterSheet = {
      ...sheet,
      skills: safeSkills,
      attributes: sheet.attributes ?? { phys: 0, ref: 0, soc: 0, ment: 0 },
      stress: sheet.stress ?? { current: 0, cuf: 0, cufLoss: 0 },
      wounds: sheet.wounds ?? { light: 0, moderate: 0, heavy: 0 },
      weapons: sheet.weapons ?? [],
      inventory: sheet.inventory ?? [],
    };
    const validation = validateCharacterRecordV1(normalized);
    if (!validation.ok) {
      setSaveStatus("invalid");
      setSaveError("Validation failed. See details below.");
      setValidationErrors(validation.errors);
      return;
    }
    const id = saveNew ? crypto.randomUUID() : sheet.id;
    const method = saveNew ? "POST" : "PUT";
    const url =
      method === "POST"
        ? `${apiBase}/characters?visibility=${saveVisibility}`
        : `${apiBase}/characters/${id}?visibility=${saveVisibility}`;
    try {
      const doRequest = async (targetUrl: string, targetMethod: "POST" | "PUT") =>
        fetch(targetUrl, {
          method: targetMethod,
          headers: { "Content-Type": "application/json", ...csrfHeader() },
          credentials: "include",
          body: JSON.stringify({ ...normalized, id }),
        });

      let res = await doRequest(url, method);
      if (res.status === 409) {
        const payload = await res.json();
        setSaveStatus("conflict");
        setSaveError("Conflict: remote has a newer version.");
        setConflictSheet(payload?.current as CharacterSheet);
        return;
      }
      if (res.status === 404 && method === "PUT") {
        res = await doRequest(`${apiBase}/characters?visibility=${saveVisibility}`, "POST");
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setSaveStatus("failed");
        setSaveError(payload?.error || "Save failed");
        return;
      }
      const saved = (await res.json()) as CharacterSheet;
      updateSheet(saved);
      setSaveStatus("saved");
      window.location.href = `${window.location.origin}/character/${saved.id}`;
    } catch (err) {
      setSaveStatus("failed");
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleViewLoad = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`${apiBase}/characters/${id}`, {
        credentials: "include",
        headers: { ...csrfHeader() },
      });
      if (!res.ok) {
        setViewError("Unable to load character.");
        return;
      }
      const data = (await res.json()) as CharacterSheet;
      setViewSheet(data);
    } catch {
      setViewError("Unable to load character.");
    }
  };

  useEffect(() => {
    if (viewId) void handleViewLoad(viewId);
  }, [viewId]);

  if (viewId) {
    return (
      <div className="app">
        <header className="header">
          <div className="eyebrow">Whisperspace</div>
          <div className="header-row">
            <div>
              <h1>Character View</h1>
              <p className="status">Rules API: {apiStatus}</p>
            </div>
            <div className="header-actions">
              <a className="ghost" href="/">
                Back to Builder
              </a>
            </div>
          </div>
          {viewError ? <p className="error">{viewError}</p> : null}
        </header>
        <section className="card">
          {viewSheet ? (
            <div className="stack">
              <h2>{viewSheet.name || "Unnamed Character"}</h2>
              <p className="muted">{viewSheet.motivation || "Motivation missing"}</p>
              <div className="summary">
                <div>
                  <h3>Attributes</h3>
                  <ul>
                    {Object.entries(viewSheet.attributes).map(([key, value]) => (
                      <li key={key}>
                        {ATTRIBUTE_LABELS[key as AttributeKey]}: {value}
                      </li>
                    ))}
                  </ul>
                  <p className="muted">CUF: {viewSheet.stress?.cuf ?? 0}</p>
                </div>
                <div>
                  <h3>Skills</h3>
                  <ul>
                    {Object.keys(viewSheet.skills ?? {}).length
                      ? Object.entries(viewSheet.skills ?? {}).map(([key, rank]) => (
                          <li key={key}>
                            {key} ({rank})
                          </li>
                        ))
                      : "None"}
                  </ul>
                </div>
                <div>
                  <h3>Inventory</h3>
                  <ul>
                    {(viewSheet.inventory ?? []).length
                      ? (viewSheet.inventory ?? []).map((gear, idx) => (
                          <li key={gear.id ?? String(idx)}>
                            {gear.name || "Unnamed"} ({gear.type})
                          </li>
                        ))
                      : "None"}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">Loading character...</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="eyebrow">Whisperspace</div>
        <div className="header-row">
          <div>
            <h1>Character Builder</h1>
            <p className="status">Rules API: {apiStatus}</p>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={() => downloadCharacter(sheet)}>
              Export JSON
            </button>
            <label className="ghost">
              Import JSON
              <input
                type="file"
                accept="application/json"
                onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              className="ghost danger"
              onClick={() => {
                clearDraft();
                setSheet(createBlankCharacter());
                setStep("basics");
              }}
            >
              Reset Draft
            </button>
          </div>
        </div>
        <div className="header-row">
          <div className="inline">
            {user ? (
              <>
                <span className="muted">Signed in as {user.email}</span>
                <button className="ghost" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <span className="muted">Not signed in</span>
                <button
                  className="ghost"
                  onClick={() => {
                    void fetchSession(true);
                    setSaveDialogOpen(true);
                  }}
                >
                  Log in / Sign up
                </button>
              </>
            )}
          </div>
        </div>
        {importError ? <p className="error">{importError}</p> : null}
        {saveStatus ? <p className="muted">Save: {saveStatus}</p> : null}
        {validationErrors.length > 0 ? (
          <div className="validation">
            <p className="error">Validation errors:</p>
            <ul>
              {validationErrors.map((err, idx) => (
                <li key={`${err}-${idx}`}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {conflictSheet ? (
          <div className="conflict">
            <p className="error">Conflict detected. Remote version is newer.</p>
            <div className="inline">
              <button
                className="ghost"
                onClick={() => {
                  updateSheet(conflictSheet);
                  setConflictSheet(null);
                  setStep("review");
                }}
              >
                Load Remote
              </button>
              <button
                className="ghost danger"
                onClick={async () => {
                  const result = await saveCharacter(sheet, { force: true });
                  if (result.ok) {
                    setConflictSheet(null);
                    setSaveStatus("overwrote remote");
                  } else {
                    setSaveStatus("force save failed");
                  }
                }}
              >
                Overwrite Remote
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <nav className="steps">
        {STEPS.map((s, index) => (
          <button
            key={s.id}
            className={`step ${s.id === step ? "active" : ""}`}
            onClick={() => setStep(s.id)}
          >
            <span className="step-index">{index + 1}</span>
            <span className="step-label">{s.label}</span>
            <span className="step-hint">{s.hint}</span>
          </button>
        ))}
      </nav>

      <section className="card">
        {step === "basics" && (
          <div className="grid two">
            <div>
              <label>Name</label>
              <input
                value={sheet.name}
                onChange={(e) => updateSheet({ ...sheet, name: e.target.value })}
                placeholder="Nyx"
              />
            </div>
            <div className="span-2">
              <label>Motivation</label>
              <input
                value={sheet.motivation ?? ""}
                onChange={(e) => updateSheet({ ...sheet, motivation: e.target.value })}
                placeholder="Keep the crew alive"
              />
            </div>
            <div className="span-2">
              <div className="inline">
                <div className="stack">
                  <label>Pick Motivation</label>
                  <select
                    value={motivationPick}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMotivationPick(value);
                      applyMotivation(value);
                    }}
                    disabled={rulesStatus !== "ready"}
                  >
                    {motivationOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="stack">
                  <label>&nbsp;</label>
                  <button className="ghost" onClick={rollMotivation} disabled={rulesStatus !== "ready"}>
                    Roll Motivation
                  </button>
                </div>
              </div>
              {rulesStatus === "error" ? <p className="error">{rulesError}</p> : null}
            </div>
            <div className="span-2">
              <label>Background</label>
              <textarea
                value={sheet.background}
                onChange={(e) => updateSheet({ ...sheet, background: e.target.value })}
                placeholder="A few lines about their story."
              />
            </div>
            <div className="span-2">
              <div className="inline">
                <div className="stack">
                  <label>Pick Background</label>
                  <select
                    value={backgroundPick}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBackgroundPick(value);
                      applyBackground(value);
                    }}
                    disabled={rulesStatus !== "ready"}
                  >
                    {backgroundOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="stack">
                  <label>&nbsp;</label>
                  <button className="ghost" onClick={rollBackground} disabled={rulesStatus !== "ready"}>
                    Roll Background
                  </button>
                </div>
              </div>
              {rulesStatus === "error" ? <p className="error">{rulesError}</p> : null}
            </div>
          </div>
        )}

        {step === "attributes" && (
          <div className="stack">
            <p className="muted">
              Attributes auto-derive from skills via the Rules API and are shown in Review.
            </p>
            <div className="grid three">
              {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
                <div key={key} className="stat">
                  <label>{label}</label>
                  <input type="number" value={sheet.attributes[key as AttributeKey]} disabled />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "skills" && (
          <div className="stack">
            {skillsStatus === "loading" ? (
              <p className="muted">Loading skills from the Rules API...</p>
            ) : null}
            {skillsStatus === "error" ? <p className="error">{skillsError}</p> : null}
            {skillsStatus === "ready" && skillsData ? (
              <>
                <div className="grid three">
                  <div>
                    <label>Learning Focus</label>
                    <select
                      value={learningFocus}
                      onChange={(e) =>
                        updateSheet({
                          ...sheet,
                          learningFocus: e.target.value as LearningFocus,
                        })
                      }
                    >
                      <option value="combat">Combat</option>
                      <option value="education">Education</option>
                      <option value="vehicles">Vehicles</option>
                    </select>
                  </div>
                  <div>
                    <label>Skill Points</label>
                    <input
                      type="number"
                      min={0}
                      value={sheet.skillPoints ?? 0}
                      onChange={(e) =>
                        updateSheet({
                          ...sheet,
                          skillPoints: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="skill-budget">
                    <label>Budget</label>
                    <div className="budget-line">
                      <span>Spent: {skillValidation?.spent ?? "-"}</span>
                      <span>Remaining: {skillValidation?.remaining ?? "-"}</span>
                    </div>
                    {skillValidation ? (
                      skillValidation.valid ? (
                        <span className="muted">Within limits</span>
                      ) : (
                        <span className="error">Invalid allocation</span>
                      )
                    ) : (
                      <span className="muted">Checking...</span>
                    )}
                  </div>
                </div>
                <div className="grid two">
                  <div>
                    <label>Search Skills</label>
                    <input
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      placeholder="Search by name or id"
                    />
                  </div>
                </div>

                {skillValidation?.errors?.length ? (
                  <div className="validation">
                    <p className="error">Skill errors:</p>
                    <ul>
                      {skillValidation.errors.map((err, idx) => (
                        <li key={`${err}-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {skillValidation?.warnings?.length ? (
                  <div className="validation">
                    <p className="muted">Skill warnings:</p>
                    <ul>
                      {skillValidation.warnings.map((warn, idx) => (
                        <li key={`${warn}-${idx}`}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="skills-section">
                  <h3>Inherent Skills</h3>
                  <div className="skills-table">
                    {skillsData.inherent
                      .filter((skill) => {
                        const q = skillSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          skill.label.toLowerCase().includes(q) ||
                          skill.id.toLowerCase().includes(q)
                        );
                      })
                      .map((skill) => (
                      <div className="skill-row" key={skill.id}>
                        <div className="skill-meta">
                          <strong title={skillTooltips?.skills?.[skill.label] ?? ""}>
                            {skill.label}
                          </strong>
                          <span className="muted">{skill.id}</span>
                        </div>
                        <div className="skill-attr">
                          <span title={skillTooltips?.attributes?.[ATTRIBUTE_LABELS[skill.attribute].toUpperCase()] ?? ""}>
                            {ATTRIBUTE_LABELS[skill.attribute]}
                          </span>
                        </div>
                        <div className="skill-rank">
                          <input
                            type="number"
                            min={0}
                            max={MAX_RANK_INHERENT}
                            value={sheet.skills?.[skill.id] ?? 0}
                            onChange={(e) =>
                              updateSkillRank(
                                skill.id,
                                Number(e.target.value) || 0,
                                MAX_RANK_INHERENT
                              )
                            }
                          />
                          <span className="muted">max {MAX_RANK_INHERENT}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="skills-section">
                  <h3>Learned Skills</h3>
                  {(Object.entries(skillsData.learned) as Array<[LearningFocus, SkillEntry[]]>).map(
                    ([focus, list]) => {
                      const maxRank =
                        focus === learningFocus ? MAX_RANK_ON_FOCUS : MAX_RANK_OFF_FOCUS;
                      const filtered = list.filter((skill) => {
                        const q = skillSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          skill.label.toLowerCase().includes(q) ||
                          skill.id.toLowerCase().includes(q)
                        );
                      });
                      return (
                        <div key={focus} className="skills-subsection">
                          <h4>
                            {focus.charAt(0).toUpperCase() + focus.slice(1)}
                            {focus === learningFocus ? " (Focus)" : ""}
                          </h4>
                          <div className="skills-table">
                            {filtered.map((skill) => (
                              <div className="skill-row" key={skill.id}>
                                <div className="skill-meta">
                                  <strong title={skillTooltips?.skills?.[skill.label] ?? ""}>
                                    {skill.label}
                                  </strong>
                                  <span className="muted">{skill.id}</span>
                                </div>
                                <div className="skill-attr">
                                  <span title={skillTooltips?.attributes?.[ATTRIBUTE_LABELS[skill.attribute].toUpperCase()] ?? ""}>
                                    {ATTRIBUTE_LABELS[skill.attribute]}
                                  </span>
                                </div>
                                <div className="skill-rank">
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxRank}
                                    value={sheet.skills?.[skill.id] ?? 0}
                                    onChange={(e) =>
                                      updateSkillRank(
                                        skill.id,
                                        Number(e.target.value) || 0,
                                        maxRank
                                      )
                                    }
                                  />
                                  <span className="muted">max {maxRank}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {step === "gear" && (
          <div className="stack">
            {gearStatus === "loading" ? (
              <p className="muted">Loading gear catalogs from the Rules API...</p>
            ) : null}
            {gearStatus === "error" ? <p className="error">{gearError}</p> : null}
            {gearStatus === "ready" && gearData ? (
              <>
                <div className="gear-summary">
                  <span>Total Bulk: {gearTotals.bulk}</span>
                  <span>Total Credits: {gearTotals.cost}</span>
                </div>
                <div className="gear-picker">
                  <div>
                    <label>Gear Type</label>
                    <select
                      value={gearPickType}
                      onChange={(e) => {
                        const nextType = e.target.value as GearType;
                        setGearPickType(nextType);
                        const options = buildGearOptions(nextType, gearSearch);
                        setGearPickName(options[0]?.key ?? "");
                      }}
                    >
                      <option value="item">Item</option>
                      <option value="cyberware">Cyberware</option>
                      <option value="narcotics">Narcotics</option>
                      <option value="hacker_gear">Hacker Gear</option>
                    </select>
                  </div>
                  <div>
                    <label>Catalog</label>
                    <select
                      value={gearPickName}
                      onChange={(e) => setGearPickName(e.target.value)}
                    >
                      {buildGearOptions(gearPickType, gearSearch).map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="gear-actions">
                    <label>&nbsp;</label>
                    <button className="ghost" onClick={addSelectedGear}>
                      Add Gear
                    </button>
                  </div>
                </div>
                <div className="gear-tools">
                  <div>
                    <label>Search Catalog</label>
                    <input
                      value={gearSearch}
                      onChange={(e) => {
                        const next = e.target.value;
                        setGearSearch(next);
                        const options = buildGearOptions(gearPickType, next);
                        if (!options.find((opt) => opt.key === gearPickName)) {
                          setGearPickName(options[0]?.key ?? "");
                        }
                      }}
                      placeholder="Search gear"
                    />
                  </div>
                  <div>
                    <label>Custom Gear Type</label>
                    <select
                      value={customGearType}
                      onChange={(e) => setCustomGearType(e.target.value as GearType)}
                    >
                      <option value="item">Item</option>
                      <option value="cyberware">Cyberware</option>
                      <option value="narcotics">Narcotics</option>
                      <option value="hacker_gear">Hacker Gear</option>
                    </select>
                  </div>
                  <div className="gear-actions">
                    <label>&nbsp;</label>
                    <button className="ghost" onClick={addCustomGear}>
                      Add Custom
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {(sheet.inventory ?? []).length === 0 ? (
              <p className="muted">No inventory items yet.</p>
            ) : (
              <div className="gear-list">
                {(sheet.inventory ?? []).map((gear, idx) => (
                  <div className="gear-card" key={gear.id ?? String(idx)}>
                    <div className="gear-header">
                      <div>
                        <strong>{gear.name || "Unnamed"}</strong>
                        <span className="muted">{gear.type}</span>
                      </div>
                      <button className="ghost danger" onClick={() => removeInventoryItem(idx)}>
                        Remove
                      </button>
                    </div>
                    <div className="grid three">
                      <div>
                        <label>Name</label>
                        <input
                          value={gear.name ?? ""}
                          onChange={(e) => updateInventoryItem(idx, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label>Quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={gear.quantity ?? 1}
                          onChange={(e) =>
                            updateInventoryItem(idx, {
                              quantity: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Bulk</label>
                        <input
                          type="number"
                          min={0}
                          value={gear.bulk ?? 0}
                          onChange={(e) =>
                            updateInventoryItem(idx, { bulk: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <label>Cost</label>
                        <input
                          type="number"
                          min={0}
                          value={gear.cost ?? 0}
                          onChange={(e) =>
                            updateInventoryItem(idx, { cost: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      {gear.type === "item" ? (
                        <>
                          <div>
                            <label>Uses</label>
                            <input
                              value={gear.uses ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { uses: e.target.value })}
                            />
                          </div>
                          <div className="span-2">
                            <label>Effect</label>
                            <textarea
                              value={gear.effect ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { effect: e.target.value })}
                            />
                          </div>
                        </>
                      ) : null}
                      {gear.type === "cyberware" ? (
                        <>
                          <div>
                            <label>Tier</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.tier ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, { tier: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div>
                            <label>Install Difficulty</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.installationDifficulty ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, {
                                  installationDifficulty: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label>Requirements</label>
                            <input
                              value={gear.requirements ?? ""}
                              onChange={(e) =>
                                updateInventoryItem(idx, { requirements: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label>Physical Impact</label>
                            <input
                              value={gear.physicalImpact ?? ""}
                              onChange={(e) =>
                                updateInventoryItem(idx, { physicalImpact: e.target.value })
                              }
                            />
                          </div>
                          <div className="span-2">
                            <label>Effect</label>
                            <textarea
                              value={gear.effect ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { effect: e.target.value })}
                            />
                          </div>
                        </>
                      ) : null}
                      {gear.type === "narcotics" ? (
                        <>
                          <div>
                            <label>Uses</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.uses ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, { uses: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div>
                            <label>Addiction Score</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.addictionScore ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, {
                                  addictionScore: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label>Legality</label>
                            <input
                              value={gear.legality ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { legality: e.target.value })}
                            />
                          </div>
                          <div className="span-2">
                            <label>Effect</label>
                            <textarea
                              value={gear.effect ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { effect: e.target.value })}
                            />
                          </div>
                        </>
                      ) : null}
                      {gear.type === "hacker_gear" ? (
                        <>
                          <div>
                            <label>System Tier Access</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.systemTierAccess ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, {
                                  systemTierAccess: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label>Max Software Tier</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.maxSoftwareTier ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, {
                                  maxSoftwareTier: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label>Tier</label>
                            <input
                              type="number"
                              min={0}
                              value={gear.tier ?? 0}
                              onChange={(e) =>
                                updateInventoryItem(idx, { tier: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div className="span-2">
                            <label>Notes</label>
                            <textarea
                              value={gear.notes ?? ""}
                              onChange={(e) => updateInventoryItem(idx, { notes: e.target.value })}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {gearStatus === "ready" && gearData ? (
              <div className="gear-arsenal">
                <div className="stack">
                  <h3>Weapons</h3>
                  <div className="gear-picker">
                    <div>
                      <label>Search Weapons</label>
                      <input
                        value={weaponSearch}
                        onChange={(e) => {
                          const next = e.target.value;
                          setWeaponSearch(next);
                          const options = buildWeaponOptions(next);
                          if (!options.find((opt) => opt.key === weaponPickId)) {
                            setWeaponPickId(options[0]?.key ?? "");
                          }
                        }}
                        placeholder="Search weapons"
                      />
                    </div>
                    <div>
                      <label>Weapon Catalog</label>
                      <select
                        value={weaponPickId}
                        onChange={(e) => setWeaponPickId(e.target.value)}
                      >
                        {buildWeaponOptions(weaponSearch).map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="gear-actions">
                      <label>&nbsp;</label>
                      <button className="ghost" onClick={addSelectedWeapon}>
                        Add Weapon
                      </button>
                    </div>
                  </div>
                  {(sheet.weapons ?? []).length === 0 ? (
                    <p className="muted">No weapons equipped.</p>
                  ) : (
                    <div className="gear-list">
                      {(sheet.weapons ?? []).map((weapon, idx) => (
                        <div className="gear-card" key={weapon.id ?? String(idx)}>
                          <div className="gear-header">
                            <div>
                              <strong>{weapon.name || "Unnamed"}</strong>
                              <span className="muted">{weapon.skillId || "Unspecified skill"}</span>
                            </div>
                            <button className="ghost danger" onClick={() => removeWeapon(idx)}>
                              Remove
                            </button>
                          </div>
                          <div className="grid three">
                            <div>
                              <label>Name</label>
                              <input
                                value={weapon.name ?? ""}
                                onChange={(e) => updateWeapon(idx, { name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label>Skill Id</label>
                              <input
                                value={weapon.skillId ?? ""}
                                onChange={(e) => updateWeapon(idx, { skillId: e.target.value })}
                              />
                            </div>
                            <div>
                              <label>Use DC</label>
                              <input
                                type="number"
                                min={0}
                                value={weapon.useDC ?? 0}
                                onChange={(e) =>
                                  updateWeapon(idx, { useDC: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <label>Damage</label>
                              <input
                                type="number"
                                min={0}
                                value={weapon.damage ?? 0}
                                onChange={(e) =>
                                  updateWeapon(idx, { damage: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <label>Range</label>
                              <input
                                value={weapon.range ?? ""}
                                onChange={(e) => updateWeapon(idx, { range: e.target.value })}
                              />
                            </div>
                            <div>
                              <label>Ammo</label>
                              <input
                                type="number"
                                min={0}
                                value={weapon.ammo ?? 0}
                                onChange={(e) =>
                                  updateWeapon(idx, { ammo: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <label>Bulk</label>
                              <input
                                type="number"
                                min={0}
                                value={weapon.bulk ?? 0}
                                onChange={(e) =>
                                  updateWeapon(idx, { bulk: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <label>Cost</label>
                              <input
                                type="number"
                                min={0}
                                value={weapon.cost ?? 0}
                                onChange={(e) =>
                                  updateWeapon(idx, { cost: Number(e.target.value) || 0 })
                                }
                              />
                            </div>
                            <div>
                              <label>Req</label>
                              <input
                                value={weapon.req ?? ""}
                                onChange={(e) => updateWeapon(idx, { req: e.target.value })}
                              />
                            </div>
                            <div className="span-2">
                              <label>Keywords (comma)</label>
                              <input
                                value={(weapon.keywords ?? []).join(", ")}
                                onChange={(e) =>
                                  updateWeapon(idx, {
                                    keywords: e.target.value
                                      .split(",")
                                      .map((kw) => kw.trim())
                                      .filter(Boolean),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="stack">
                  <h3>Armour</h3>
                  <div className="gear-picker">
                    <div>
                      <label>Search Armour</label>
                      <input
                        value={armourSearch}
                        onChange={(e) => {
                          const next = e.target.value;
                          setArmourSearch(next);
                          const options = buildArmourOptions(next);
                          if (!options.find((opt) => opt.key === armourPickId)) {
                            setArmourPickId(options[0]?.key ?? "");
                          }
                        }}
                        placeholder="Search armour"
                      />
                    </div>
                    <div>
                      <label>Armour Catalog</label>
                      <select
                        value={armourPickId}
                        onChange={(e) => setArmourPickId(e.target.value)}
                      >
                        {buildArmourOptions(armourSearch).map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="gear-actions">
                      <label>&nbsp;</label>
                      <button className="ghost" onClick={equipArmour}>
                        Equip Armour
                      </button>
                    </div>
                  </div>
                  {activeArmour ? (
                    <div className="gear-card">
                      <div className="gear-header">
                        <div>
                          <strong>{activeArmour.name || "Armour"}</strong>
                          <span className="muted">Protection {activeArmour.protection ?? 0}</span>
                        </div>
                        <button
                          className="ghost danger"
                          onClick={() => updateSheet({ ...sheet, armour: undefined })}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid three">
                        <div>
                          <label>Name</label>
                          <input
                            value={activeArmour.name ?? ""}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: { ...activeArmour, name: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Protection</label>
                          <input
                            type="number"
                            min={0}
                            value={activeArmour.protection ?? 0}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: {
                                  ...activeArmour,
                                  protection: Number(e.target.value) || 0,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Bulk</label>
                          <input
                            type="number"
                            min={0}
                            value={activeArmour.bulk ?? 0}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: { ...activeArmour, bulk: Number(e.target.value) || 0 },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Durability (current)</label>
                          <input
                            type="number"
                            min={0}
                            value={activeArmour.durability?.current ?? 0}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: {
                                  ...activeArmour,
                                  durability: {
                                    current: Number(e.target.value) || 0,
                                    max: activeArmour.durability?.max ?? 0,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Durability (max)</label>
                          <input
                            type="number"
                            min={0}
                            value={activeArmour.durability?.max ?? 0}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: {
                                  ...activeArmour,
                                  durability: {
                                    current: activeArmour.durability?.current ?? 0,
                                    max: Number(e.target.value) || 0,
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Cost</label>
                          <input
                            type="number"
                            min={0}
                            value={activeArmour.cost ?? 0}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: { ...activeArmour, cost: Number(e.target.value) || 0 },
                              })
                            }
                          />
                        </div>
                        <div>
                          <label>Req</label>
                          <input
                            value={activeArmour.req ?? ""}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: { ...activeArmour, req: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="span-2">
                          <label>Special</label>
                          <textarea
                            value={activeArmour.special ?? ""}
                            onChange={(e) =>
                              updateSheet({
                                ...sheet,
                                armour: { ...activeArmour, special: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">No armour equipped.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {step === "review" && (
          <div className="stack">
            <h2>{sheet.name || "Unnamed Character"}</h2>
            <p className="muted">{sheet.motivation || "Motivation missing"}</p>
            <div className="summary">
              <div>
                <h3>Attributes</h3>
                <ul>
                  {Object.entries(sheet.attributes).map(([key, value]) => (
                    <li key={key}>
                      {ATTRIBUTE_LABELS[key as AttributeKey]}: {value}
                    </li>
                  ))}
                </ul>
                <p className="muted">CUF: {sheet.stress?.cuf ?? 0}</p>
                <p className="muted">Speed: {derivedStats.speed}</p>
                <p className="muted">Carrying Capacity: {derivedStats.capacity}</p>
              </div>
              <div>
                <h3>Skills</h3>
                <ul>
                  {Object.keys(sheet.skills ?? {}).length
                    ? Object.entries(sheet.skills ?? {}).map(([key, rank]) => (
                        <li key={key}>
                          {key} ({rank})
                        </li>
                      ))
                    : "None"}
                </ul>
              </div>
              <div>
                <h3>Inventory</h3>
                <ul>
                  {(sheet.inventory ?? []).length
                    ? (sheet.inventory ?? []).map((gear, idx) => (
                        <li key={gear.id ?? String(idx)}>
                          {gear.name || "Unnamed"} ({gear.type})
                        </li>
                      ))
                    : "None"}
                </ul>
                <p className="muted">
                  Total Bulk: {gearTotals.bulk} · Total Credits: {gearTotals.cost}
                </p>
              </div>
              <div>
                <h3>Stress</h3>
                <ul>
                  <li>Current: {sheet.stress?.current ?? 0}</li>
                  <li>CUF Loss: {sheet.stress?.cufLoss ?? 0}</li>
                </ul>
              </div>
              <div>
                <h3>Wounds</h3>
                <ul>
                  <li>Light: {sheet.wounds?.light ?? 0}</li>
                  <li>Moderate: {sheet.wounds?.moderate ?? 0}</li>
                  <li>Heavy: {sheet.wounds?.heavy ?? 0}</li>
                </ul>
              </div>
            </div>
            <label>Notes</label>
            <textarea
              value={sheet.notes}
              onChange={(e) => updateSheet({ ...sheet, notes: e.target.value })}
            />
          </div>
        )}
      </section>


      <footer className="footer">
        <div className="footer-info">
          {rulesCacheNote ? <span className="muted">{rulesCacheNote}</span> : null}
          {rulesVersion || rulesFetchedAt ? (
            <span className="muted">
              {rulesVersion ? `Rules version: ${rulesVersion}` : "Rules version: unknown"}
              {rulesFetchedAt ? ` · Cached: ${new Date(rulesFetchedAt).toLocaleString()}` : ""}
            </span>
          ) : null}
        </div>
        <button className="ghost" onClick={goPrev} disabled={currentStepIndex === 0}>
          Back
        </button>
        {step === "review" ? (
          <button
            className="primary"
            onClick={() => {
              void fetchSession(true);
              setSaveDialogOpen(true);
            }}
          >
            Save Character
          </button>
        ) : (
          <button className="primary" onClick={goNext} disabled={currentStepIndex === STEPS.length - 1}>
            Next
          </button>
        )}
      </footer>

      {saveDialogOpen ? (
        <div className="modal">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Save Character</h2>
              <button className="ghost" onClick={() => setSaveDialogOpen(false)}>
                Close
              </button>
            </div>
            {resetToken ? (
              <div className="stack">
                <p className="muted">Reset your password.</p>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="New password"
                />
                <button className="primary" onClick={handlePasswordReset} disabled={authLoading}>
                  Set New Password
                </button>
              </div>
            ) : null}
            {!user ? (
              <div className="stack">
                <p className="muted">
                  Sign in to save to your account and manage who can open the character link.
                </p>
                <div className="inline">
                  <button
                    className={authMode === "login" ? "primary" : "ghost"}
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Log in
                  </button>
                  <button
                    className={authMode === "signup" ? "primary" : "ghost"}
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                    }}
                  >
                    Sign up
                  </button>
                </div>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                />
                <button className="primary" onClick={handleAuth} disabled={authLoading}>
                  {authMode === "login" ? "Log in" : "Create account"}
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    (window.location.href = `${apiBase}/auth/oauth/google?state=${encodeURIComponent(
                      window.location.origin
                    )}`)
                  }
                >
                  Continue with Google
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setShowResetRequest(!showResetRequest);
                    setAuthError("");
                  }}
                >
                  {showResetRequest ? "Hide password reset" : "Forgot password?"}
                </button>
                <div className={showResetRequest ? "stack reset-block" : "hidden"}>
                  <label>Password reset email</label>
                  <div className="inline wrap">
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <button className="ghost" onClick={handlePasswordRequest} disabled={authLoading}>
                      Send reset link
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stack">
                <p className="muted">Signed in as {user.email}</p>
                <div className="grid two">
                  <div>
                    <label>Visibility</label>
                    <select
                      value={saveVisibility}
                      onChange={(e) => setSaveVisibility(e.target.value as "private" | "public")}
                    >
                      <option value="private">Private (owner/admin only)</option>
                      <option value="public">Public (anyone with link)</option>
                    </select>
                    <p className="muted">
                      {saveVisibility === "private"
                        ? "Private keeps the character restricted to your account and admins."
                        : "Public allows read-only viewing by anyone with the URL."}
                    </p>
                  </div>
                  <div className="toggle">
                    <label>Save As New</label>
                    <button
                      className={saveNew ? "primary" : "ghost"}
                      onClick={() => setSaveNew(!saveNew)}
                    >
                      {saveNew ? "Enabled" : "Disabled"}
                    </button>
                    <p className="muted">
                      {saveNew
                        ? "A new character ID will be created, leaving the current sheet untouched."
                        : "Saves updates to this existing character ID."}
                    </p>
                  </div>
                </div>
                <button className="primary" onClick={handleCloudSave}>
                  {saveNew ? "Create Saved Copy" : "Save Changes"}
                </button>
              </div>
            )}
            <div className="stack">
              <p className="muted">Local options</p>
              <button className="ghost" onClick={() => downloadCharacter(sheet)}>
                Export JSON
              </button>
              <button
                className="ghost"
                onClick={() => {
                  saveDraft(sheet);
                  setSaveStatus("saved locally");
                }}
              >
                Save Draft
              </button>
            </div>
            {saveError ? <p className="error">{saveError}</p> : null}
            {authFeedback ? (
              <p className={authFeedback.tone === "success" ? "success" : "error"}>
                {authFeedback.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
