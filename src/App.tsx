import { useEffect, useMemo, useRef, useState } from "react";
 
import type { AttributeKey, BuilderStep, CharacterSheet } from "./model/character";
import { createBlankCharacter, updateTimestamp } from "./model/character";
import { CHARACTER_API_BASE } from "./model/api";
import { validateCharacterRecordV1 } from "./model/validate";
import { loadDraft, saveDraft } from "./storage/local";
import { downloadCharacter, readCharacterFile } from "./storage/transfer";
import { fetchCharacter, listCharacters, saveCharacter } from "./storage/remote";
 

const STEPS: { id: BuilderStep; label: string; hint: string }[] = [
  { id: "origin", label: "Origin", hint: "Concept and start" },
  { id: "archetype", label: "Archetype", hint: "Background and role" },
  { id: "feats", label: "Feats", hint: "Core advantages" },
  { id: "skills", label: "Skills & Attributes", hint: "Ranks and derived profile" },
  { id: "equipment", label: "Equipment", hint: "Loadout and credits" },
  { id: "review", label: "Review", hint: "Summary" },
];

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  phys: "Phys",
  ref: "Ref",
  soc: "Soc",
  ment: "Ment",
};

const ATTRIBUTE_FULL_LABELS: Record<AttributeKey, string> = {
  phys: "Physique",
  ref: "Reflex",
  soc: "Social",
  ment: "Mental",
};

const ATTRIBUTE_GROUP_META: Record<AttributeKey, { title: string; short: string }> = {
  phys: { title: "Physique Skills", short: "Physique" },
  ref: { title: "Reflex Skills", short: "Reflex" },
  soc: { title: "Social Skills", short: "Social" },
  ment: { title: "Mental Skills", short: "Mental" },
};

const FOCUS_META: Record<LearningFocus, { title: string }> = {
  combat: { title: "Combat Focus Skills" },
  education: { title: "Education Focus Skills" },
  vehicles: { title: "Vehicle Focus Skills" },
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
  attributesById?: Record<string, string>;
  attributesByShort?: Record<string, string>;
  skillsById?: Record<string, string>;
  skillsByLabel?: Record<string, string>;
};

type BackgroundOption = {
  name: string;
  description: string;
};

type MotivationOption = {
  name: string;
};

type AuthUser = { id: string; email: string };
type SaveTarget = "cloud" | "local";
type AppPage = "builder" | "view" | "characters" | "settings";
type SortDirection = "asc" | "desc";
type CharacterSortKey =
  | "name"
  | "updatedAt"
  | "skillPoints"
  | "phys"
  | "ref"
  | "soc"
  | "ment"
  | "weapon"
  | "armour";

const MAX_RANK_INHERENT = 5;
const MAX_RANK_ON_FOCUS = 5;
const MAX_RANK_OFF_FOCUS = 2;
const STEP_KEY = "ws_builder_step";
const LOCAL_SAVED_KEY = "ws_character_saved_local_v1";
const LAST_SAVED_KEY = "ws_character_last_saved_v1";

type GearType = "item" | "cyberware" | "narcotics" | "hacker_gear";
type GameplayCategory = "attribute" | "inherent_skill" | "learning_focus_skill" | "other";

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
  const detectPage = (): AppPage => {
    const path = window.location.pathname;
    if (path.startsWith("/character/")) return "view";
    if (path.startsWith("/characters")) return "characters";
    if (path.startsWith("/settings")) return "settings";
    return "builder";
  };
  const [page, setPage] = useState<AppPage>(() => detectPage());
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
  const [step, setStep] = useState<BuilderStep>("origin");
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
  const [conceptIntro, setConceptIntro] = useState<string>("");
  const [creditsIntro, setCreditsIntro] = useState<string>("");
  const [archetypeIntro, setArchetypeIntro] = useState<string>("");
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
  const [saveMenuOpen, setSaveMenuOpen] = useState<boolean>(false);
  const [authDialogOpen, setAuthDialogOpen] = useState<boolean>(false);
  const [saveOptionsOpen, setSaveOptionsOpen] = useState<boolean>(false);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("cloud");
  const [saveVisibility, setSaveVisibility] = useState<"private" | "public">(
    () => ((localStorage.getItem("ws_pref_visibility") as "private" | "public") || "private")
  );
  const [saveNew, setSaveNew] = useState<boolean>(false);
  const [saveNewAvailable, setSaveNewAvailable] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");
  const [saveExistingRecord, setSaveExistingRecord] = useState<boolean>(false);
  const [skillGroupsCollapsed, setSkillGroupsCollapsed] = useState<Record<string, boolean>>({
    "inherent-phys": false,
    "inherent-ref": false,
    "inherent-soc": false,
    "inherent-ment": false,
    "focus-combat": false,
    "focus-education": false,
    "focus-vehicles": false,
  });
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const [importDragActive, setImportDragActive] = useState<boolean>(false);
  const [characterLimit, setCharacterLimit] = useState<number>(20);
  const [characterSummaries, setCharacterSummaries] = useState<
    Array<{ id: string; name: string; updatedAt: string }>
  >([]);
  const [characterSheetsById, setCharacterSheetsById] = useState<Record<string, CharacterSheet>>({});
  const [characterListLoading, setCharacterListLoading] = useState<boolean>(false);
  const [characterListError, setCharacterListError] = useState<string>("");
  const [characterSearch, setCharacterSearch] = useState<string>("");
  const [characterSortKey, setCharacterSortKey] = useState<CharacterSortKey>("name");
  const [characterSortDirection, setCharacterSortDirection] = useState<SortDirection>("asc");
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState<boolean>(false);
  const [pendingEditorAction, setPendingEditorAction] = useState<
    null | { type: "add" } | { type: "edit"; id: string; name: string }
  >(null);
  const [baselineSheetJson, setBaselineSheetJson] = useState<string>("");
  const [settingsVisibilityDefault, setSettingsVisibilityDefault] = useState<"private" | "public">(
    () => ((localStorage.getItem("ws_pref_visibility") as "private" | "public") || "private")
  );
  const [settingsLandingPage, setSettingsLandingPage] = useState<"builder" | "characters">(
    () => ((localStorage.getItem("ws_pref_landing") as "builder" | "characters") || "builder")
  );
  const [settingsStatus, setSettingsStatus] = useState<string>("");
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
  const [draggingInventoryIndex, setDraggingInventoryIndex] = useState<number | null>(null);
  const [draggingWeaponIndex, setDraggingWeaponIndex] = useState<number | null>(null);
  const [inventoryExpanded, setInventoryExpanded] = useState<Record<string, boolean>>({});
  const [weaponExpanded, setWeaponExpanded] = useState<Record<string, boolean>>({});
  const [inventoryGameplayDrafts, setInventoryGameplayDrafts] = useState<
    Record<string, { open: boolean; category: GameplayCategory; target: string; amount: number }>
  >({});
  const [weaponGameplayDrafts, setWeaponGameplayDrafts] = useState<
    Record<string, { open: boolean; category: GameplayCategory; target: string; amount: number }>
  >({});
  const [armourGameplayDraft, setArmourGameplayDraft] = useState<{
    open: boolean;
    category: GameplayCategory;
    target: string;
    amount: number;
  }>({
    open: false,
    category: "attribute",
    target: "phys",
    amount: 0,
  });
  const [skillValidation, setSkillValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    spent: number;
    remaining: number;
  } | null>(null);
  const [deriveDebug, setDeriveDebug] = useState<{
    lastRunAt: string;
    request: {
      attributes: unknown;
      cuf: unknown;
      speed: unknown;
      capacity: unknown;
    };
    response: {
      attributes?: unknown;
      cuf?: unknown;
      speed?: unknown;
      capacity?: unknown;
    };
    applied: {
      attributes: CharacterSheet["attributes"];
      cuf: number;
      speed: number;
      capacity: number;
    };
    error?: string;
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
      setAuthDialogOpen(true);
    }
    if (url.pathname.startsWith("/character/")) {
      setViewId(url.pathname.replace("/character/", ""));
    }
  }, []);

  useEffect(() => {
    const savedStep = localStorage.getItem(STEP_KEY) as BuilderStep | null;
    if (
      savedStep &&
      savedStep !== "review" &&
      (savedStep === "origin" ||
        savedStep === "archetype" ||
        savedStep === "feats" ||
        savedStep === "skills" ||
        savedStep === "equipment")
    ) {
      setStep(savedStep);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, step);
  }, [step]);

  useEffect(() => {
    const onPop = () => {
      setPage(detectPage());
      if (window.location.pathname.startsWith("/character/")) {
        setViewId(window.location.pathname.replace("/character/", ""));
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!baselineSheetJson) {
      setBaselineSheetJson(JSON.stringify(sheet));
    }
  }, [baselineSheetJson, sheet]);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    if (settingsLandingPage === "characters" && user) {
      navigate("/characters");
    }
  }, [settingsLandingPage, user]);

  const fetchSession = async (force = false) => {
    const cached = localStorage.getItem("ws_auth_session");
    const cachedAt = localStorage.getItem("ws_auth_session_at");
    if (!force && cached && cachedAt) {
      const ageMs = Date.now() - Number(cachedAt);
      if (ageMs >= 0 && ageMs < 5 * 60 * 1000) {
        try {
          const payload = JSON.parse(cached) as {
            user: AuthUser | null;
            characterLimit?: number;
            limits?: { characterLimit?: number; maxCharacters?: number; characters?: number };
          };
          // Trust cache only for positive authenticated session.
          // If cached user is null, re-check server to avoid stale post-OAuth state.
          if (payload.user) {
            setUser(payload.user);
            const limit =
              payload.characterLimit ??
              payload.limits?.characterLimit ??
              payload.limits?.maxCharacters ??
              payload.limits?.characters;
            if (typeof limit === "number" && limit > 0) setCharacterLimit(limit);
            return;
          }
        } catch {
          // ignore cache errors
        }
      }
    }
    try {
      const res = await fetch(`${apiBase}/auth/session`, { credentials: "include" });
      if (!res.ok) return;
      const payload = (await res.json()) as {
        user: AuthUser | null;
        characterLimit?: number;
        limits?: { characterLimit?: number; maxCharacters?: number; characters?: number };
      };
      setUser(payload.user ?? null);
      const limit =
        payload.characterLimit ??
        payload.limits?.characterLimit ??
        payload.limits?.maxCharacters ??
        payload.limits?.characters;
      if (typeof limit === "number" && limit > 0) setCharacterLimit(limit);
      localStorage.setItem("ws_auth_session", JSON.stringify(payload));
      localStorage.setItem("ws_auth_session_at", String(Date.now()));
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    void fetchSession();
  }, [apiBase]);

  const extractRulesNarrative = (data: any) => {
    const paragraphs: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        if (typeof node.text === "string" && node.text.trim()) {
          paragraphs.push(node.text.trim());
        }
        if (node.type === "paragraph") {
          const text = Array.isArray(node.children)
            ? node.children
                .map((child: any) => (typeof child?.text === "string" ? child.text : ""))
                .join("")
                .trim()
            : "";
          if (text) paragraphs.push(text);
        }
        Object.values(node).forEach(walk);
      }
    };
    walk(data);
    const concept =
      paragraphs.find((p) => /modeling your character around a concept/i.test(p)) ??
      paragraphs.find((p) => /character concept/i.test(p)) ??
      "";
    const credits =
      paragraphs.find((p) => /1d12/i.test(p) && /50/.test(p) && /800/.test(p) && /credits/i.test(p)) ??
      "";
    const archetype =
      paragraphs.find((p) => /ripley from alien/i.test(p) && /archetype/i.test(p)) ??
      paragraphs.find((p) => /in whisperspace, an archetype is defined/i.test(p)) ??
      "";
    return { concept, credits, archetype };
  };

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
        const narrative = extractRulesNarrative(data);
        if (narrative.concept) setConceptIntro(narrative.concept);
        if (narrative.credits) setCreditsIntro(narrative.credits);
        if (narrative.archetype) setArchetypeIntro(narrative.archetype);
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
        const narrative = extractRulesNarrative(data);
        setConceptIntro(narrative.concept);
        setCreditsIntro(narrative.credits);
        setArchetypeIntro(narrative.archetype);
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
    const cachedTooltips = localStorage.getItem("ws_rules_skill_tooltips_json");
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
    if (cachedTooltips) {
      try {
        setSkillTooltips(JSON.parse(cachedTooltips) as SkillTooltips);
      } catch {
        // ignore cache errors
      }
    }

    fetch(`${rulesBase}/skills.json`)
      .then((res) =>
        res.ok ? (res.json() as Promise<SkillsData>) : Promise.reject(new Error("bad response"))
      )
      .then((data) => {
        if (!active) return;
        localStorage.setItem("ws_rules_skills_json", JSON.stringify(data));
        setSkillsData(data);
        setSkillsStatus("ready");
        setRulesCacheNote("");
      })
      .catch(() => {
        if (!active) return;
        setSkillsError("Unable to load skills from the Rules API.");
        setSkillsStatus(skillsData ? "cached" : "error");
        if (skillsData) setRulesCacheNote("Can't connect to Rules API; using cached data.");
      });

    fetch(`${rulesBase}/skill_tooltips.json`)
      .then((res) => (res.ok ? (res.json() as Promise<SkillTooltips>) : Promise.reject(new Error("bad response"))))
      .then((tooltips) => {
        if (!active) return;
        localStorage.setItem("ws_rules_skill_tooltips_json", JSON.stringify(tooltips));
        setSkillTooltips(tooltips);
      })
      .catch(() => {
        // keep skills usable even if tooltip file is unavailable
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
        const normalizeTarget = (raw: string) => {
          const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
          if (key === "physique") return "phys";
          if (key === "reflex") return "ref";
          if (key === "social") return "soc";
          if (key === "mental") return "ment";
          if (key === "cool_under_fire" || key === "coolunderfire" || key === "cuf") return "cool_under_fire";
          if (key === "carryingcapacity" || key === "inventoryslots" || key === "inventory_slots")
            return "carrying_capacity";
          return key;
        };
        const normalizeEffect = (effect: string) => {
          const match = effect.trim().match(/^([a-zA-Z0-9 _-]+)\s*([+-]\d+)$/);
          if (!match) return effect.trim();
          return `${normalizeTarget(match[1])}${match[2]}`;
        };
        const normalizeEffectsField = (value?: string[] | string) => {
          if (!value) return undefined;
          const parts = Array.isArray(value) ? value : String(value).split(",");
          const normalized = parts.map((p) => normalizeEffect(String(p))).filter(Boolean);
          return normalized.length ? normalized.join(", ") : undefined;
        };
        const normalizedWeapons = (sheet.weapons ?? []).map((weapon) => ({
          ...weapon,
          gameplayEffects: normalizeEffectsField(weapon.gameplayEffects),
        }));
        const normalizedItems = (sheet.inventory ?? []).map((item) => ({
          ...item,
          gameplayEffects: normalizeEffectsField(item.gameplayEffects),
        }));
        const normalizedArmour = sheet.armour
          ? { ...sheet.armour, gameplayEffects: normalizeEffectsField(sheet.armour.gameplayEffects) }
          : undefined;
        const normalizedFeats = (sheet.feats ?? []).map((feat) => ({
          ...feat,
          gameplayEffects: normalizeEffectsField(feat.gameplayEffects),
        }));
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
            weapons: normalizedWeapons,
            armour: normalizedArmour,
            items: normalizedItems,
            feats: normalizedFeats,
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
        const normalizeTarget = (raw: string) => {
          const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
          if (key === "physique") return "phys";
          if (key === "reflex") return "ref";
          if (key === "social") return "soc";
          if (key === "mental") return "ment";
          if (key === "cool_under_fire" || key === "coolunderfire" || key === "cuf") return "cool_under_fire";
          if (key === "carryingcapacity" || key === "inventoryslots" || key === "inventory_slots")
            return "carrying_capacity";
          return key;
        };
        const normalizeEffect = (effect: string) => {
          const match = effect.trim().match(/^([a-zA-Z0-9 _-]+)\s*([+-]\d+)$/);
          if (!match) return effect.trim();
          return `${normalizeTarget(match[1])}${match[2]}`;
        };
        const normalizeEffectsField = (value?: string[] | string) => {
          if (!value) return undefined;
          const parts = Array.isArray(value) ? value : String(value).split(",");
          const normalized = parts.map((p) => normalizeEffect(String(p))).filter(Boolean);
          return normalized.length ? normalized.join(", ") : undefined;
        };
        const normalizedWeapons = (sheet.weapons ?? []).map((weapon) => ({
          ...weapon,
          gameplayEffects: normalizeEffectsField(weapon.gameplayEffects),
        }));
        const normalizedItems = (sheet.inventory ?? []).map((item) => ({
          ...item,
          gameplayEffects: normalizeEffectsField(item.gameplayEffects),
        }));
        const normalizedArmour = sheet.armour
          ? { ...sheet.armour, gameplayEffects: normalizeEffectsField(sheet.armour.gameplayEffects) }
          : undefined;
        const normalizedFeats = (sheet.feats ?? []).map((feat) => ({
          ...feat,
          gameplayEffects: normalizeEffectsField(feat.gameplayEffects),
        }));
        const attrsRequestBody = {
          skills: sheet.skills ?? {},
          inherentSkills: skillsData.inherent,
          weapons: normalizedWeapons,
          armour: normalizedArmour,
          items: normalizedItems,
          feats: normalizedFeats,
        };
        const cufRequestBody = {
          skills: sheet.skills ?? {},
          weapons: normalizedWeapons,
          armour: normalizedArmour,
          items: normalizedItems,
          feats: normalizedFeats,
        };

        const [attrsRes, cufRes] = await Promise.all([
          fetch(`${calcBase}/derive-attributes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(attrsRequestBody),
          }),
          fetch(`${calcBase}/derive-cuf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cufRequestBody),
          }),
        ]);
        if (!attrsRes.ok || !cufRes.ok) return;
        const attrsPayload = (await attrsRes.json()) as
          | CharacterSheet["attributes"]
          | { attributes?: CharacterSheet["attributes"] };
        const attrs = ((attrsPayload as { attributes?: CharacterSheet["attributes"] }).attributes ??
          attrsPayload) as CharacterSheet["attributes"];
        const cufPayload = (await cufRes.json()) as { cuf?: number; coolUnderFire?: number };
        const phys = attrs.phys ?? sheet.attributes.phys;
        const speedRequestBody = {
          phys,
          weapons: normalizedWeapons,
          armour: normalizedArmour,
          items: normalizedItems,
          feats: normalizedFeats,
        };
        const capacityRequestBody = {
          phys,
          weapons: normalizedWeapons,
          armour: normalizedArmour,
          items: normalizedItems,
          feats: normalizedFeats,
        };
        const [speedRes, capacityRes] = await Promise.all([
          fetch(`${calcBase}/derive-speed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(speedRequestBody),
          }),
          fetch(`${calcBase}/derive-capacity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(capacityRequestBody),
          }),
        ]);
        let speedApplied = derivedStats.speed;
        let capacityApplied = derivedStats.capacity;
        let speedPayload: { speed?: number } = {};
        let capacityPayload: { capacity?: number; carryingCapacity?: number } = {};
        if (speedRes.ok && capacityRes.ok) {
          speedPayload = (await speedRes.json()) as { speed: number };
          capacityPayload = (await capacityRes.json()) as {
            capacity?: number;
            carryingCapacity?: number;
          };
          speedApplied = speedPayload.speed ?? 0;
          capacityApplied = capacityPayload.carryingCapacity ?? capacityPayload.capacity ?? 0;
          setDerivedStats({
            speed: speedApplied,
            capacity: capacityApplied,
          });
        }
        const appliedAttrs = {
          phys: attrs.phys ?? sheet.attributes.phys,
          ref: attrs.ref ?? sheet.attributes.ref,
          soc: attrs.soc ?? sheet.attributes.soc,
          ment: attrs.ment ?? sheet.attributes.ment,
        };
        const appliedCuf = cufPayload.cuf ?? cufPayload.coolUnderFire ?? sheet.stress.cuf;
        updateSheet({
          ...sheet,
          attributes: appliedAttrs,
          stress: {
            ...sheet.stress,
            cuf: appliedCuf,
          },
        });
        setDeriveDebug({
          lastRunAt: new Date().toISOString(),
          request: {
            attributes: attrsRequestBody,
            cuf: cufRequestBody,
            speed: speedRequestBody,
            capacity: capacityRequestBody,
          },
          response: {
            attributes: attrsPayload,
            cuf: cufPayload,
            speed: speedPayload,
            capacity: capacityPayload,
          },
          applied: {
            attributes: appliedAttrs,
            cuf: appliedCuf,
            speed: speedApplied,
            capacity: capacityApplied,
          },
        });
      } catch {
        // ignore derive failures
        setDeriveDebug((prev) => ({
          ...(prev ?? {
            lastRunAt: new Date().toISOString(),
            request: { attributes: {}, cuf: {}, speed: {}, capacity: {} },
            response: {},
            applied: {
              attributes: sheet.attributes,
              cuf: sheet.stress.cuf,
              speed: derivedStats.speed,
              capacity: derivedStats.capacity,
            },
          }),
          error: "derive request failed",
        }));
      }
    }, 400);
    return () => {
      if (deriveTimer.current) window.clearTimeout(deriveTimer.current);
    };
  }, [
    skillsData,
    sheet.skills,
    sheet.weapons,
    sheet.inventory,
    sheet.armour,
    sheet.feats,
    sheet.attributes,
    sheet.stress.cuf,
    derivedStats.speed,
    derivedStats.capacity,
  ]);

 

  const currentStepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === step),
    [step]
  );
  const accountName = useMemo(() => {
    if (!user?.email) return "";
    return user.email.split("@")[0] || user.email;
  }, [user]);
  const isDirty = useMemo(() => {
    if (!baselineSheetJson) return false;
    return JSON.stringify(sheet) !== baselineSheetJson;
  }, [sheet, baselineSheetJson]);
  const renderSkillIcon = (key: string) => {
    if (key === "phys") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 15c1-2 3-3 5-3h3v3a5 5 0 0 1-5 5H7v-5Z" fill="currentColor" />
          <path d="M17 5h-2a3 3 0 0 0-3 3v2h3a4 4 0 0 0 4-4V5h-2Z" fill="currentColor" />
        </svg>
      );
    }
    if (key === "ref") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    }
    if (key === "soc") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="9" r="3" fill="currentColor" />
          <circle cx="16" cy="10" r="2.5" fill="currentColor" opacity="0.85" />
          <path d="M4 18a5 5 0 0 1 10 0H4Z" fill="currentColor" />
          <path d="M13.5 18a4 4 0 0 1 6.5-2.8V18h-6.5Z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    }
    if (key === "ment") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a7 7 0 0 0-7 7c0 3 2 4.5 3 5.5V19h8v-3.5c1-1 3-2.5 3-5.5a7 7 0 0 0-7-7Z" fill="currentColor" />
          <rect x="9" y="20" width="6" height="2" rx="1" fill="currentColor" />
        </svg>
      );
    }
    if (key === "combat") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 18 8-8 4 4-8 8H6v-4Z" fill="currentColor" />
          <path d="m13 7 2-2 4 4-2 2-4-4Z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    }
    if (key === "education") {
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9 12 4l9 5-9 5-9-5Z" fill="currentColor" />
          <path d="M6 12v4l6 3 6-3v-4l-6 3-6-3Z" fill="currentColor" opacity="0.85" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="10" width="16" height="8" rx="2" fill="currentColor" />
        <rect x="7" y="6" width="4" height="4" rx="1" fill="currentColor" opacity="0.85" />
        <rect x="13" y="6" width="4" height="4" rx="1" fill="currentColor" opacity="0.85" />
      </svg>
    );
  };
  const inherentSkillGroups = useMemo(() => {
    const grouped: Record<AttributeKey, SkillEntry[]> = {
      phys: [],
      ref: [],
      soc: [],
      ment: [],
    };
    (skillsData?.inherent ?? []).forEach((skill) => {
      grouped[skill.attribute].push(skill);
    });
    return grouped;
  }, [skillsData]);

  const skillLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    (skillsData?.inherent ?? []).forEach((skill) => {
      map[skill.id] = skill.label;
    });
    if (skillsData?.learned) {
      Object.values(skillsData.learned).forEach((list) => {
        list.forEach((skill) => {
          map[skill.id] = skill.label;
        });
      });
    }
    return map;
  }, [skillsData]);

  const tooltipBySkillId = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(skillTooltips?.skillsById ?? {}).forEach(([id, tooltip]) => {
      map.set(id.toLowerCase(), tooltip);
    });
    Object.entries(skillTooltips?.skills ?? {}).forEach(([id, tooltip]) => {
      map.set(id.toLowerCase(), tooltip);
    });
    return map;
  }, [skillTooltips]);

  const tooltipByLowerLabel = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(skillTooltips?.skillsByLabel ?? {}).forEach(([label, tooltip]) => {
      map.set(label.toLowerCase(), tooltip);
    });
    Object.entries(skillTooltips?.skills ?? {}).forEach(([label, tooltip]) => {
      map.set(label.toLowerCase(), tooltip);
    });
    return map;
  }, [skillTooltips]);

  const resolveSkillTooltip = (skill: { id: string; label: string }) => {
    const byId = tooltipBySkillId.get(skill.id.toLowerCase());
    if (byId) return byId;
    const direct = tooltipByLowerLabel.get(skill.label.toLowerCase());
    if (direct) return direct;
    const fromId = skill.id
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return tooltipByLowerLabel.get(fromId.toLowerCase()) ?? "";
  };

  const gameplayTargets = useMemo(() => {
    const base = {
      attribute: [
        { key: "phys", label: "Physique" },
        { key: "ref", label: "Reflex" },
        { key: "soc", label: "Social" },
        { key: "ment", label: "Mental" },
      ],
      inherent_skill: (skillsData?.inherent ?? []).map((skill) => ({
        key: skill.id,
        label: skill.label,
      })),
      learning_focus_skill: Object.values(skillsData?.learned ?? {})
        .flat()
        .map((skill) => ({ key: skill.id, label: skill.label })),
      other: [
        { key: "cool_under_fire", label: "Cool Under Fire" },
        { key: "speed", label: "Speed" },
        { key: "carrying_capacity", label: "Carrying Capacity" },
      ],
    };
    return base;
  }, [skillsData]);

  const toGameplayEffect = (target: string, amount: number) => `${target}${amount >= 0 ? "+" : ""}${amount}`;

  const parseGameplayEffect = (effect: string) => {
    const match = effect.trim().match(/^([a-z0-9_]+)\s*([+-]\d+)$/i);
    if (!match) return { target: effect, amount: 0 };
    return { target: match[1], amount: Number(match[2]) || 0 };
  };

  const gameplayLabel = (target: string) =>
    gameplayTargets.attribute.find((entry) => entry.key === target)?.label ??
    gameplayTargets.other.find((entry) => entry.key === target)?.label ??
    skillLabelById[target] ??
    target;

  const sortedFilteredCharacters = useMemo(() => {
    const filtered = characterSummaries.filter((entry) =>
      (entry.name || "Unnamed Character")
        .toLowerCase()
        .includes(characterSearch.trim().toLowerCase())
    );
    const getValue = (entry: { id: string; name: string; updatedAt: string }) => {
      const full = characterSheetsById[entry.id];
      if (characterSortKey === "name") return (entry.name || "").toLowerCase();
      if (characterSortKey === "updatedAt") return entry.updatedAt || "";
      if (characterSortKey === "skillPoints") return full?.skillPoints ?? 0;
      if (characterSortKey === "phys") return full?.attributes?.phys ?? 0;
      if (characterSortKey === "ref") return full?.attributes?.ref ?? 0;
      if (characterSortKey === "soc") return full?.attributes?.soc ?? 0;
      if (characterSortKey === "ment") return full?.attributes?.ment ?? 0;
      if (characterSortKey === "weapon") return full?.weapons?.[0]?.name ?? "";
      if (characterSortKey === "armour") return full?.armour?.name ?? "";
      return "";
    };
    filtered.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "number" && typeof bv === "number") {
        return characterSortDirection === "asc" ? av - bv : bv - av;
      }
      const result = String(av).localeCompare(String(bv));
      return characterSortDirection === "asc" ? result : -result;
    });
    return filtered;
  }, [
    characterSummaries,
    characterSheetsById,
    characterSearch,
    characterSortKey,
    characterSortDirection,
  ]);

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
      const next = { ...imported, id: imported.id || crypto.randomUUID() };
      setSheet(next);
      setBaselineSheetJson(JSON.stringify(next));
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

  const nudgeSkillRank = (id: string, delta: number, max: number) => {
    const current = sheet.skills?.[id] ?? 0;
    updateSkillRank(id, current + delta, max);
  };

  const toggleSkillGroup = (key: string) => {
    setSkillGroupsCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addInventoryItem = (item: CharacterSheet["inventory"][number]) => {
    const current = [...(sheet.inventory ?? [])];
    const signature = (entry: CharacterSheet["inventory"][number]) => {
      const clone: Record<string, unknown> = { ...entry };
      delete clone.id;
      delete clone.quantity;
      return JSON.stringify(clone);
    };
    const targetSignature = signature(item);
    const matchIndex = current.findIndex((entry) => signature(entry) === targetSignature);
    if (matchIndex >= 0) {
      const existing = current[matchIndex];
      current[matchIndex] = {
        ...existing,
        quantity: (existing.quantity ?? 1) + (item.quantity ?? 1),
      } as CharacterSheet["inventory"][number];
      updateSheet({ ...sheet, inventory: current });
      return;
    }
    updateSheet({ ...sheet, inventory: [...current, item] });
  };

  const inventoryRowKey = (item: CharacterSheet["inventory"][number], idx: number) =>
    item.id ?? `inventory-${idx}`;
  const weaponRowKey = (weapon: CharacterSheet["weapons"][number], idx: number) =>
    `${weapon.id ?? "weapon"}-${idx}`;

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
    const removed = nextInventory[index];
    if (removed) {
      const key = inventoryRowKey(removed, index);
      setInventoryExpanded((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setInventoryGameplayDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    nextInventory.splice(index, 1);
    updateSheet({ ...sheet, inventory: nextInventory });
  };

  const reorder = <T,>(items: T[], from: number, to: number): T[] => {
    if (from === to) return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const reorderInventory = (from: number, to: number) => {
    const current = sheet.inventory ?? [];
    if (from < 0 || to < 0 || from >= current.length || to >= current.length) return;
    updateSheet({ ...sheet, inventory: reorder(current, from, to) });
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
    const removed = nextWeapons[index];
    if (removed) {
      const key = weaponRowKey(removed, index);
      setWeaponExpanded((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setWeaponGameplayDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    nextWeapons.splice(index, 1);
    updateSheet({ ...sheet, weapons: nextWeapons });
  };

  const setInventoryGameplayEffects = (index: number, effects: string[]) => {
    const current = sheet.inventory?.[index];
    if (!current) return;
    updateInventoryItem(index, { gameplayEffects: effects });
  };

  const setWeaponGameplayEffects = (index: number, effects: string[]) => {
    const current = sheet.weapons?.[index];
    if (!current) return;
    updateWeapon(index, { gameplayEffects: effects });
  };

  const setArmourGameplayEffects = (effects: string[]) => {
    if (!sheet.armour) return;
    updateSheet({ ...sheet, armour: { ...sheet.armour, gameplayEffects: effects } });
  };

  const reorderWeapons = (from: number, to: number) => {
    const current = sheet.weapons ?? [];
    if (from < 0 || to < 0 || from >= current.length || to >= current.length) return;
    updateSheet({ ...sheet, weapons: reorder(current, from, to) });
  };

  const nudgeWeaponAmmo = (index: number, delta: number) => {
    const current = sheet.weapons?.[index];
    if (!current) return;
    updateWeapon(index, { ammo: Math.max(0, (current.ammo ?? 0) + delta) });
  };

  const reloadWeaponAmmo = (index: number) => {
    const weapon = sheet.weapons?.[index];
    if (!weapon || !gearData) return;
    const fromCatalog =
      gearData.weapons.weapons.find((entry) => entry.id === weapon.id) ??
      gearData.weapons.weapons.find((entry) => entry.name === weapon.name);
    updateWeapon(index, { ammo: Math.max(0, fromCatalog?.ammo ?? weapon.ammo ?? 0) });
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

  const addFeat = () => {
    updateSheet({
      ...sheet,
      feats: [...(sheet.feats ?? []), { name: "", description: "", gameplayEffects: [] }],
    });
  };

  const updateFeat = (index: number, next: Partial<CharacterSheet["feats"][number]>) => {
    const feats = [...(sheet.feats ?? [])];
    const current = feats[index];
    if (!current) return;
    feats[index] = { ...current, ...next };
    updateSheet({ ...sheet, feats });
  };

  const removeFeat = (index: number) => {
    const feats = [...(sheet.feats ?? [])];
    feats.splice(index, 1);
    updateSheet({ ...sheet, feats });
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

  const readLocalSaves = (): Record<string, CharacterSheet> => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVED_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, CharacterSheet>;
    } catch {
      return {};
    }
  };

  const writeLocalSaves = (next: Record<string, CharacterSheet>) => {
    localStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify(next));
  };

  const saveToLocalStorage = (targetSheet: CharacterSheet) => {
    const saves = readLocalSaves();
    saves[targetSheet.id] = targetSheet;
    writeLocalSaves(saves);
    localStorage.setItem(LAST_SAVED_KEY, JSON.stringify(targetSheet));
    saveDraft(targetSheet);
    setSaveStatus("saved locally");
    updateSheet(targetSheet);
    setBaselineSheetJson(JSON.stringify(targetSheet));
  };

  const localSaveExists = (id: string) => {
    const saves = readLocalSaves();
    return Boolean(saves[id]);
  };

  const checkCloudExists = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/characters/${id}`, {
        credentials: "include",
        headers: { ...csrfHeader() },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setPage(detectPage());
    if (path.startsWith("/character/")) {
      setViewId(path.replace("/character/", ""));
    }
  };

  const refreshCharacterList = async () => {
    if (!user) return;
    setCharacterListLoading(true);
    setCharacterListError("");
    try {
      const summaries = await listCharacters();
      setCharacterSummaries(summaries);
      const details = await Promise.all(
        summaries.map(async (entry) => {
          try {
            const full = await fetchCharacter(entry.id);
            return [entry.id, full] as const;
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, CharacterSheet> = {};
      details.forEach((pair) => {
        if (!pair) return;
        map[pair[0]] = pair[1];
      });
      setCharacterSheetsById(map);
    } catch (err) {
      setCharacterListError(err instanceof Error ? err.message : "Failed to load characters");
    } finally {
      setCharacterListLoading(false);
    }
  };

  const applyEditorAction = async (action: { type: "add" } | { type: "edit"; id: string; name: string }) => {
    if (action.type === "add") {
      const blank = createBlankCharacter();
      setSheet(blank);
      setBaselineSheetJson(JSON.stringify(blank));
      setStep("origin");
      navigate("/");
      return;
    }
    try {
      const loaded = await fetchCharacter(action.id);
      setSheet(loaded);
      setBaselineSheetJson(JSON.stringify(loaded));
      setStep("origin");
      navigate("/");
    } catch {
      setSaveError("Failed to load character for edit.");
    }
  };

  const beginEditorAction = (action: { type: "add" } | { type: "edit"; id: string; name: string }) => {
    if (isDirty) {
      setPendingEditorAction(action);
      setUnsavedPromptOpen(true);
      return;
    }
    void applyEditorAction(action);
  };

  const toggleSort = (key: CharacterSortKey) => {
    if (characterSortKey === key) {
      setCharacterSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setCharacterSortKey(key);
    setCharacterSortDirection("asc");
  };

  const sortHeaderLabel = (label: string, key: CharacterSortKey) => {
    if (characterSortKey !== key) return label;
    return `${label} ${characterSortDirection === "asc" ? "▲" : "▼"}`;
  };

  const saveSettings = () => {
    localStorage.setItem("ws_pref_visibility", settingsVisibilityDefault);
    localStorage.setItem("ws_pref_landing", settingsLandingPage);
    setSaveVisibility(settingsVisibilityDefault);
    setSettingsStatus("saved");
    window.setTimeout(() => setSettingsStatus(""), 1500);
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
        setAuthDialogOpen(false);
        setSaveMenuOpen(true);
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
        if (page !== "builder" && page !== "view") {
          navigate("/");
        }
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

  const handleCloudSave = async (opts?: { redirect?: boolean }): Promise<boolean> => {
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
      return false;
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
        return false;
      }
      if (res.status === 404 && method === "PUT") {
        res = await doRequest(`${apiBase}/characters?visibility=${saveVisibility}`, "POST");
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setSaveStatus("failed");
        setSaveError(payload?.error || "Save failed");
        return false;
      }
      const saved = (await res.json()) as CharacterSheet;
      updateSheet(saved);
      localStorage.setItem(LAST_SAVED_KEY, JSON.stringify(saved));
      setBaselineSheetJson(JSON.stringify(saved));
      setSaveStatus("saved");
      if (opts?.redirect !== false) {
        window.location.href = `${window.location.origin}/character/${saved.id}`;
      }
      return true;
    } catch (err) {
      setSaveStatus("failed");
      setSaveError(err instanceof Error ? err.message : "Save failed");
      return false;
    }
  };

  const openSaveMenu = async () => {
    await fetchSession(true);
    setSaveError("");
    setAuthError("");
    setSaveMenuOpen(true);
  };

  const openSaveOptions = async (target: SaveTarget) => {
    setSaveTarget(target);
    setSaveNew(false);
    if (target === "cloud") {
      const exists = await checkCloudExists(sheet.id);
      setSaveExistingRecord(exists);
      setSaveNewAvailable(exists);
    } else {
      const exists = localSaveExists(sheet.id);
      setSaveExistingRecord(exists);
      setSaveNewAvailable(exists);
    }
    setSaveMenuOpen(false);
    setSaveOptionsOpen(true);
  };

  const executeSave = async () => {
    if (saveTarget === "cloud") {
      const creatingNew = saveNew || !saveExistingRecord;
      if (creatingNew) {
        try {
          const count = (await listCharacters()).length;
          if (count >= characterLimit) {
            setSaveError(`Character limit reached (${characterLimit}). Delete one before creating a new copy.`);
            return;
          }
        } catch {
          setSaveError("Unable to verify character limit right now.");
          return;
        }
      }
      const continueAction = pendingEditorAction;
      const ok = await handleCloudSave({ redirect: !continueAction });
      if (ok) {
        setSaveOptionsOpen(false);
        setSaveMenuOpen(false);
        if (continueAction) {
          setPendingEditorAction(null);
          await applyEditorAction(continueAction);
        }
      }
      return;
    }
    if (saveNew || !saveExistingRecord) {
      const used = Object.keys(readLocalSaves()).length;
      if (used >= characterLimit) {
        setSaveError(`Character limit reached (${characterLimit}). Remove a local character before creating a new copy.`);
        return;
      }
    }
    const targetSheet = saveNew
      ? {
          ...sheet,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : { ...sheet };
    saveToLocalStorage(targetSheet);
    setSaveOptionsOpen(false);
    setSaveMenuOpen(false);
    if (pendingEditorAction) {
      const continueAction = pendingEditorAction;
      setPendingEditorAction(null);
      await applyEditorAction(continueAction);
    }
  };

  const resetToLastSaved = async () => {
    const ok = window.confirm("Are you sure? All unsaved changes will be lost.");
    if (!ok) return;
    try {
      const saves = readLocalSaves();
      const localMatch = saves[sheet.id];
      if (localMatch) {
        setSheet(localMatch);
        setBaselineSheetJson(JSON.stringify(localMatch));
        setSaveStatus("reset to local saved copy");
        setStep("origin");
        return;
      }
      const lastSavedRaw = localStorage.getItem(LAST_SAVED_KEY);
      if (lastSavedRaw) {
        const lastSaved = JSON.parse(lastSavedRaw) as CharacterSheet;
        setSheet(lastSaved);
        setBaselineSheetJson(JSON.stringify(lastSaved));
        setSaveStatus("reset to last saved copy");
        setStep("origin");
        return;
      }
      if (user) {
        const res = await fetch(`${apiBase}/characters/${sheet.id}`, {
          credentials: "include",
          headers: { ...csrfHeader() },
        });
        if (res.ok) {
          const remote = (await res.json()) as CharacterSheet;
          setSheet(remote);
          setBaselineSheetJson(JSON.stringify(remote));
          localStorage.setItem(LAST_SAVED_KEY, JSON.stringify(remote));
          setSaveStatus("reset to cloud saved copy");
          setStep("origin");
          return;
        }
      }
    } catch {
      // ignore parse errors and reset to blank
    }
    const blank = createBlankCharacter();
    setSheet(blank);
    setBaselineSheetJson(JSON.stringify(blank));
    setSaveStatus("reset to blank sheet");
    setStep("origin");
  };

  const handleImportDrop = async (file: File | null) => {
    if (!file) return;
    await handleImport(file);
    setImportDialogOpen(false);
    setImportDragActive(false);
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

  useEffect(() => {
    if (page === "characters" && user) {
      void refreshCharacterList();
    }
  }, [page, user]);

  useEffect(() => {
    // Public pages: builder + character view.
    // Protected pages: characters + settings.
    if (user) return;
    if (page === "characters" || page === "settings") {
      navigate("/");
    }
  }, [page, user]);

  const activeMenuPage = page === "view" ? "builder" : page;
  const renderAccountMenu = () => {
    if (!user) {
      return (
        <button className="ghost" onClick={() => setAuthDialogOpen(true)}>
          Log in / Sign up
        </button>
      );
    }
    return (
      <div className="account-block">
        <div className="account-name">{accountName}</div>
        <div className="account-links">
          <button
            className={activeMenuPage === "builder" ? "primary" : "ghost"}
            onClick={() => navigate("/")}
          >
            Character Builder
          </button>
          <button
            className={activeMenuPage === "characters" ? "primary" : "ghost"}
            onClick={() => navigate("/characters")}
          >
            Character List
          </button>
          <button
            className={activeMenuPage === "settings" ? "primary" : "ghost"}
            onClick={() => navigate("/settings")}
          >
            Settings
          </button>
          <button className="ghost" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      </div>
    );
  };

  const renderHeader = (title: string, subtitle?: string, builderControls = false) => (
    <header className="header cut-corner-padded">
      <div className="eyebrow">Whisperspace</div>
      <div className="header-row">
        <div className="header-title-stack">
          <h1>{title}</h1>
          {page !== "builder" ? (
            <button className="ghost" onClick={() => navigate("/")}>
              Back to Character Builder
            </button>
          ) : null}
          {subtitle ? <p className="status">{subtitle}</p> : null}
        </div>
        <div className="auth-chip">{renderAccountMenu()}</div>
      </div>
      {builderControls ? (
        <div className="header-row">
          <div className="header-actions">
            <button className="primary" onClick={() => void openSaveMenu()}>
              Save
            </button>
            <button className="ghost" onClick={() => setImportDialogOpen(true)}>
              Import
            </button>
            <button className="ghost danger" onClick={() => void resetToLastSaved()}>
              Reset
            </button>
          </div>
        </div>
      ) : null}
      {builderControls && importError ? <p className="error">{importError}</p> : null}
      {builderControls && saveStatus ? <p className="muted">Save: {saveStatus}</p> : null}
      {builderControls && validationErrors.length > 0 ? (
        <div className="validation">
          <p className="error">Validation errors:</p>
          <ul>
            {validationErrors.map((err, idx) => (
              <li key={`${err}-${idx}`}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {builderControls && conflictSheet ? (
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
  );

  const renderFooter = () => (
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
    </footer>
  );

  const filteredInventoryRows = useMemo(() => {
    const q = gearSearch.trim().toLowerCase();
    return (sheet.inventory ?? [])
      .map((gear, index) => ({ gear, index }))
      .filter(({ gear }) => {
        if (!q) return true;
        return `${gear.name ?? ""} ${gear.type}`.toLowerCase().includes(q);
      });
  }, [sheet.inventory, gearSearch]);

  const filteredWeaponRows = useMemo(() => {
    const q = weaponSearch.trim().toLowerCase();
    return (sheet.weapons ?? [])
      .map((weapon, index) => ({ weapon, index }))
      .filter(({ weapon }) => {
        if (!q) return true;
        const skill = skillLabelById[weapon.skillId ?? ""] ?? weapon.skillId ?? "";
        return `${weapon.name ?? ""} ${skill}`.toLowerCase().includes(q);
      });
  }, [sheet.weapons, weaponSearch, skillLabelById]);

  const armourMatchesSearch = useMemo(() => {
    if (!activeArmour) return false;
    const q = armourSearch.trim().toLowerCase();
    if (!q) return true;
    return (activeArmour.name ?? "").toLowerCase().includes(q);
  }, [activeArmour, armourSearch]);

  const categoryTargetOptions = (category: GameplayCategory) => {
    if (category === "attribute") return gameplayTargets.attribute;
    if (category === "inherent_skill") return gameplayTargets.inherent_skill;
    if (category === "learning_focus_skill") return gameplayTargets.learning_focus_skill;
    return gameplayTargets.other;
  };

  const defaultDraft = (open = false, category: GameplayCategory = "attribute") => {
    const first = categoryTargetOptions(category)[0]?.key ?? "";
    return { open, category, target: first, amount: 0 };
  };

  const renderGameplayTags = (
    effects: string[] | undefined,
    onRemove: (effectIndex: number) => void
  ) => {
    if (!effects?.length) return null;
    return (
      <div className="gameplay-tags">
        {effects.map((effect, effectIndex) => {
          const parsed = parseGameplayEffect(effect);
          const tone = parsed.amount < 0 ? "penalty" : parsed.amount > 0 ? "bonus" : "neutral";
          return (
            <span key={`${effect}-${effectIndex}`} className={`gameplay-tag ${tone}`}>
              {gameplayLabel(parsed.target)} {parsed.amount >= 0 ? `+${parsed.amount}` : parsed.amount}
              <button
                data-no-expand="true"
                className="gameplay-tag-remove"
                onClick={() => onRemove(effectIndex)}
                aria-label="Remove gameplay effect"
              >
                x
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  if (page === "view" && viewId) {
    return (
      <div className="app">
        {renderHeader("Character View")}
        {viewError ? <p className="error">{viewError}</p> : null}
        <section className="card cut-corner-padded">
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
        {renderFooter()}
      </div>
    );
  }

  if (page === "settings") {
    return (
      <div className="app">
        {renderHeader("Settings")}
        <section className="card cut-corner-padded">
          <div className="grid two">
            <div className="stack">
              <h3>Account</h3>
              <p className="muted">Email: {user?.email || "Not signed in"}</p>
              <p className="muted">Character limit: {characterLimit}</p>
            </div>
            <div className="stack">
              <h3>Builder Preferences</h3>
              <div>
                <label>Default Save Visibility</label>
                <select
                  value={settingsVisibilityDefault}
                  onChange={(e) =>
                    setSettingsVisibilityDefault(e.target.value as "private" | "public")
                  }
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label>Default Landing Page</label>
                <select
                  value={settingsLandingPage}
                  onChange={(e) =>
                    setSettingsLandingPage(e.target.value as "builder" | "characters")
                  }
                >
                  <option value="builder">Builder</option>
                  <option value="characters">Character List</option>
                </select>
              </div>
              <button className="primary" onClick={saveSettings}>
                Save Settings
              </button>
              {settingsStatus ? <span className="success">Settings saved.</span> : null}
            </div>
          </div>
        </section>
        {renderFooter()}
      </div>
    );
  }

  if (page === "characters") {
    const showEmptySlots = characterSearch.trim().length === 0;
    const emptySlots = showEmptySlots ? Math.max(0, characterLimit - characterSummaries.length) : 0;
    return (
      <div className="app">
        {renderHeader(
          "Character List",
          `${sortedFilteredCharacters.length} / ${characterLimit} slots used`
        )}
        <section className="card cut-corner-padded">
          <div className="character-list-toolbar">
            <button
              className="primary"
              onClick={() => beginEditorAction({ type: "add" })}
              disabled={!user}
            >
              Add Character
            </button>
            <input
              value={characterSearch}
              onChange={(e) => setCharacterSearch(e.target.value)}
              placeholder="Search by name"
            />
          </div>
        </section>
        <section className="card cut-corner-padded">
          {characterListError ? <p className="error">{characterListError}</p> : null}
          {characterListLoading ? <p className="muted">Loading characters...</p> : null}
          <div className="character-table">
            <div className="character-table-head">
              <button className="ghost" onClick={() => toggleSort("name")}>{sortHeaderLabel("Name", "name")}</button>
              <button className="ghost" onClick={() => toggleSort("updatedAt")}>{sortHeaderLabel("Last Saved", "updatedAt")}</button>
              <button className="ghost" onClick={() => toggleSort("skillPoints")}>{sortHeaderLabel("Skill Points", "skillPoints")}</button>
              <button className="ghost" onClick={() => toggleSort("phys")}>{sortHeaderLabel("Phys", "phys")}</button>
              <button className="ghost" onClick={() => toggleSort("ref")}>{sortHeaderLabel("Ref", "ref")}</button>
              <button className="ghost" onClick={() => toggleSort("soc")}>{sortHeaderLabel("Soc", "soc")}</button>
              <button className="ghost" onClick={() => toggleSort("ment")}>{sortHeaderLabel("Ment", "ment")}</button>
              <button className="ghost" onClick={() => toggleSort("weapon")}>{sortHeaderLabel("Weapon", "weapon")}</button>
              <button className="ghost" onClick={() => toggleSort("armour")}>{sortHeaderLabel("Armour", "armour")}</button>
              <span>Actions</span>
            </div>
            {sortedFilteredCharacters.map((entry) => {
              const full = characterSheetsById[entry.id];
              const shareUrl = `${window.location.origin}/character/${entry.id}`;
              return (
                <div className="character-row" key={entry.id}>
                  <a className="character-name-link" href={shareUrl}>
                    {entry.name || "Unnamed Character"}
                  </a>
                  <span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "-"}</span>
                  <span className="num">{full?.skillPoints ?? 0}</span>
                  <span className="num">{full?.attributes?.phys ?? 0}</span>
                  <span className="num">{full?.attributes?.ref ?? 0}</span>
                  <span className="num">{full?.attributes?.soc ?? 0}</span>
                  <span className="num">{full?.attributes?.ment ?? 0}</span>
                  <span>{full?.weapons?.[0]?.name ?? "-"}</span>
                  <span>{full?.armour?.name ?? "-"}</span>
                  <div className="inline">
                    <button
                      className="ghost"
                      onClick={() => {
                        void navigator.clipboard?.writeText(shareUrl);
                      }}
                    >
                      {"Copy\u00A0Link"}
                    </button>
                    <button
                      className="ghost"
                      onClick={() =>
                        beginEditorAction({
                          type: "edit",
                          id: entry.id,
                          name: entry.name || "Unnamed Character",
                        })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: emptySlots }).map((_, idx) => (
              <div className="character-row empty" key={`empty-${idx}`}>
                <span>Empty slot</span>
              </div>
            ))}
          </div>
        </section>
        {renderFooter()}
        {unsavedPromptOpen ? (
          <div className="modal" onClick={() => setUnsavedPromptOpen(false)}>
            <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h2>You have unsaved changes</h2>
                <button className="ghost" onClick={() => setUnsavedPromptOpen(false)}>
                  Close
                </button>
              </div>
              <p className="muted">
                {pendingEditorAction?.type === "edit"
                  ? pendingEditorAction.name
                  : sheet.name || "Current character"}
              </p>
              <div className="stack">
                <button
                  className="primary"
                  onClick={() => {
                    setUnsavedPromptOpen(false);
                    navigate("/");
                    setSaveMenuOpen(true);
                  }}
                >
                  Save
                </button>
                <button
                  className="ghost danger"
                  onClick={() => {
                    const action = pendingEditorAction;
                    setUnsavedPromptOpen(false);
                    setPendingEditorAction(null);
                    if (action) void applyEditorAction(action);
                  }}
                >
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app">
      {renderHeader("Character Builder", undefined, true)}

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

      <section className="card cut-corner-padded">
        {step === "origin" && (
          <div className="grid two">
            <div>
              <label>Name</label>
              <input
                value={sheet.name}
                onChange={(e) => updateSheet({ ...sheet, name: e.target.value })}
                placeholder="Nyx"
              />
            </div>
            <div>
              <label>Credits</label>
              <input
                type="number"
                min={0}
                value={sheet.credits ?? 0}
                onChange={(e) =>
                  updateSheet({
                    ...sheet,
                    credits: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            {conceptIntro ? <p className="muted span-2">{conceptIntro}</p> : null}
            {creditsIntro ? <p className="muted span-2">{creditsIntro}</p> : null}
            <div className="span-2 inline wrap">
              <button
                className="ghost"
                onClick={() =>
                  updateSheet({
                    ...sheet,
                    credits: (Math.floor(Math.random() * 12) + 1) * 50 + 800,
                  })
                }
              >
                Generate Starting Money
              </button>
            </div>
            <h3 className="span-2">Motivation</h3>
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
            <h3 className="span-2">Background</h3>
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

        {step === "archetype" && (
          <div className="stack">
            {archetypeIntro ? <p className="muted">{archetypeIntro}</p> : null}
          </div>
        )}

        {step === "feats" && (
          <div className="stack">
            <div className="inline wrap">
              <button className="ghost" onClick={addFeat}>
                Add Feat
              </button>
            </div>
            {(sheet.feats ?? []).length === 0 ? (
              <p className="muted">No feats added yet.</p>
            ) : (
              <div className="stack">
                {(sheet.feats ?? []).map((feat, featIndex) => (
                  <div key={`feat-${featIndex}`} className="reset-block">
                    <div className="inline wrap">
                      <div style={{ flex: 1 }}>
                        <label>Name</label>
                        <input
                          value={feat.name ?? ""}
                          onChange={(e) => updateFeat(featIndex, { name: e.target.value })}
                        />
                      </div>
                      <button className="ghost danger" onClick={() => removeFeat(featIndex)}>
                        Remove
                      </button>
                    </div>
                    <label>Description</label>
                    <textarea
                      value={feat.description ?? ""}
                      onChange={(e) => updateFeat(featIndex, { description: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "skills" && (
          <div className="stack">
            <h3>Attributes</h3>
            <div className="metric-cards">
              {Object.entries(ATTRIBUTE_FULL_LABELS).map(([key, label]) => (
                <div key={key} className="metric-card">
                  <span className="metric-label">{label}</span>
                  <strong className="metric-value">{sheet.attributes[key as AttributeKey]}</strong>
                </div>
              ))}
            </div>
            <div className="metric-cards">
              <div className="metric-card">
                <span className="metric-label">Cool Under Fire</span>
                <strong className="metric-value">{sheet.stress?.cuf ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Speed</span>
                <strong className="metric-value">{derivedStats.speed}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">Carrying Capacity</span>
                <strong className="metric-value">{derivedStats.capacity}</strong>
              </div>
            </div>
            <h3>Skills</h3>
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
                      placeholder="Search by name"
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

                <details className="derive-debug">
                  <summary>Calc Debug Panel</summary>
                  <p className="muted">
                    Last run: {deriveDebug?.lastRunAt ? new Date(deriveDebug.lastRunAt).toLocaleString() : "n/a"}
                  </p>
                  {deriveDebug?.error ? <p className="error">{deriveDebug.error}</p> : null}
                  <div className="derive-debug-grid">
                    <div>
                      <h4>Request</h4>
                      <pre>{JSON.stringify(deriveDebug?.request ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <h4>Response</h4>
                      <pre>{JSON.stringify(deriveDebug?.response ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <h4>Applied</h4>
                      <pre>{JSON.stringify(deriveDebug?.applied ?? {}, null, 2)}</pre>
                    </div>
                  </div>
                </details>

                <div className="skills-section">
                  <h3>Inherent Skills</h3>
                  {(Object.keys(inherentSkillGroups) as AttributeKey[]).map((attrKey) => {
                    const groupKey = `inherent-${attrKey}`;
                    const filtered = inherentSkillGroups[attrKey].filter((skill) => {
                      const q = skillSearch.trim().toLowerCase();
                      if (!q) return true;
                      return skill.label.toLowerCase().includes(q);
                    });
                    if (!filtered.length) return null;
                    return (
                      <div key={groupKey} className="skills-subsection">
                        <button className="skill-group-header" onClick={() => toggleSkillGroup(groupKey)}>
                          <span className="skill-group-title">
                            <span className={`skill-icon skill-icon-${attrKey}`}>
                              {renderSkillIcon(attrKey)}
                            </span>
                            {ATTRIBUTE_GROUP_META[attrKey].title}
                          </span>
                          <span className="muted">{skillGroupsCollapsed[groupKey] ? "▸" : "▾"}</span>
                        </button>
                        {skillGroupsCollapsed[groupKey] ? null : (
                          <div className="skills-table">
                            {filtered.map((skill) => {
                              const tooltip = resolveSkillTooltip(skill);
                              return (
                                <div className="skill-row" key={skill.id}>
                                  <div className="skill-meta">
                                    <strong>{skill.label}</strong>
                                    <span className="skill-hint">{ATTRIBUTE_GROUP_META[attrKey].short}</span>
                                    <button
                                      className="skill-info"
                                      title={tooltip || "No tooltip published for this skill yet."}
                                      aria-label={`${skill.label} info`}
                                    >
                                      i
                                    </button>
                                  </div>
                                  <div className="skill-rank-controls">
                                    <button
                                      className="ghost"
                                    onClick={() => nudgeSkillRank(skill.id, -1, MAX_RANK_INHERENT)}
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={MAX_RANK_INHERENT}
                                    value={sheet.skills?.[skill.id] ?? 0}
                                    onChange={(e) =>
                                      updateSkillRank(skill.id, Number(e.target.value) || 0, MAX_RANK_INHERENT)
                                    }
                                  />
                                    <button
                                      className="ghost"
                                      onClick={() => nudgeSkillRank(skill.id, 1, MAX_RANK_INHERENT)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="skills-section">
                  <h3>Learning Focus Skills</h3>
                  {(Object.entries(skillsData.learned) as Array<[LearningFocus, SkillEntry[]]>).map(
                    ([focus, list]) => {
                      const maxRank = focus === learningFocus ? MAX_RANK_ON_FOCUS : MAX_RANK_OFF_FOCUS;
                      const groupKey = `focus-${focus}`;
                      const filtered = list.filter((skill) => {
                        const q = skillSearch.trim().toLowerCase();
                        if (!q) return true;
                        return skill.label.toLowerCase().includes(q);
                      });
                      if (!filtered.length) return null;
                      return (
                        <div key={focus} className="skills-subsection">
                          <button className="skill-group-header" onClick={() => toggleSkillGroup(groupKey)}>
                            <span className="skill-group-title">
                              <span className={`skill-icon skill-icon-${focus}`}>{renderSkillIcon(focus)}</span>
                              {FOCUS_META[focus].title}
                              {focus === learningFocus ? " (Selected Focus)" : ""}
                            </span>
                            <span className="muted">{skillGroupsCollapsed[groupKey] ? "▸" : "▾"}</span>
                          </button>
                          {skillGroupsCollapsed[groupKey] ? null : (
                            <div className="skills-table">
                              {filtered.map((skill) => {
                                const tooltip = resolveSkillTooltip(skill);
                                return (
                                  <div className="skill-row" key={skill.id}>
                                    <div className="skill-meta">
                                      <strong>{skill.label}</strong>
                                      <span className="skill-hint">
                                        {focus.charAt(0).toUpperCase() + focus.slice(1)}
                                      </span>
                                      <button
                                        className="skill-info"
                                        title={tooltip || "No tooltip published for this skill yet."}
                                        aria-label={`${skill.label} info`}
                                      >
                                        i
                                      </button>
                                    </div>
                                  <div className="skill-rank-controls">
                                    <button className="ghost" onClick={() => nudgeSkillRank(skill.id, -1, maxRank)}>
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={maxRank}
                                      value={sheet.skills?.[skill.id] ?? 0}
                                      onChange={(e) => updateSkillRank(skill.id, Number(e.target.value) || 0, maxRank)}
                                    />
                                    <button className="ghost" onClick={() => nudgeSkillRank(skill.id, 1, maxRank)}>
                                      +
                                    </button>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {step === "equipment" && (
          <div className="stack">
            {gearStatus === "loading" ? (
              <p className="muted">Loading gear catalogs from the Rules API...</p>
            ) : null}
            {gearStatus === "error" ? <p className="error">{gearError}</p> : null}
            {gearStatus === "ready" && gearData ? (
              <>
                <div className="gear-summary">
                  <span>Total Bulk: {gearTotals.bulk}</span>
                  <span>Credits: {sheet.credits ?? 0}</span>
                </div>

                <div className="gear-arsenal">
                  <div className="gear-section stack">
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
                        <select value={weaponPickId} onChange={(e) => setWeaponPickId(e.target.value)}>
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
                    {filteredWeaponRows.length === 0 ? (
                      <p className="muted">
                        {(sheet.weapons ?? []).length === 0
                          ? "No weapons equipped."
                          : "No weapons match your search."}
                      </p>
                    ) : (
                      <div className="gear-list">
                        <div className="gear-row gear-row-header">
                          <span>Move</span>
                          <span>Name</span>
                          <span>Skill</span>
                          <span>Use DC</span>
                          <span>Damage</span>
                          <span>Range</span>
                          <span>Ammo</span>
                          <span>Actions</span>
                        </div>
                        {filteredWeaponRows.map(({ weapon, index: weaponIndex }) => {
                          const key = weaponRowKey(weapon, weaponIndex);
                          const expanded = Boolean(weaponExpanded[key]);
                          const draft = weaponGameplayDrafts[key] ?? defaultDraft(false);
                          return (
                            <div
                              className={`gear-card cut-corner-padded ${expanded ? "expanded" : "collapsed"}`}
                              key={key}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(event) => {
                                const fromRaw = event.dataTransfer.getData("text/plain");
                                const parsed = Number(fromRaw);
                                const from = Number.isFinite(parsed) ? parsed : draggingWeaponIndex;
                                if (from === null) return;
                                reorderWeapons(from, weaponIndex);
                                setDraggingWeaponIndex(null);
                              }}
                            >
                              <div
                                className="gear-row"
                                onClick={(event) => {
                                  const target = event.target as HTMLElement;
                                  if (target.closest("[data-no-expand='true']")) return;
                                  setWeaponExpanded((prev) => ({ ...prev, [key]: !expanded }));
                                }}
                              >
                                <div
                                  data-no-expand="true"
                                  className="drag-handle"
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", String(weaponIndex));
                                    setDraggingWeaponIndex(weaponIndex);
                                  }}
                                  onDragEnd={() => setDraggingWeaponIndex(null)}
                                  aria-label="Drag to reorder weapon"
                                  title="Drag to reorder"
                                >
                                  ::
                                </div>
                                <span>{weapon.name || "Unnamed"}</span>
                                <span>{skillLabelById[weapon.skillId ?? ""] ?? weapon.skillId ?? "-"}</span>
                                <span>{weapon.useDC ?? 0}</span>
                                <span>{weapon.damage ?? 0}</span>
                                <span>{weapon.range ?? "-"}</span>
                                <div className="inline row-controls" data-no-expand="true">
                                  <button className="ghost" onClick={() => nudgeWeaponAmmo(weaponIndex, -1)}>
                                    -
                                  </button>
                                  <span>{weapon.ammo ?? 0}</span>
                                  <button
                                    className="ghost icon-only"
                                    onClick={() => reloadWeaponAmmo(weaponIndex)}
                                    title="Reload"
                                    aria-label="Reload"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        d="M20 12a8 8 0 1 1-2.4-5.7"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                      />
                                      <path d="M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  data-no-expand="true"
                                  className="ghost danger"
                                  onClick={() => removeWeapon(weaponIndex)}
                                >
                                  Remove
                                </button>
                              </div>
                              {expanded ? (
                                <div className="gear-expand">
                                  <div className="grid three">
                                    <div>
                                      <label>Name</label>
                                      <input
                                        value={weapon.name ?? ""}
                                        onChange={(e) => updateWeapon(weaponIndex, { name: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label>Skill</label>
                                      <select
                                        value={weapon.skillId ?? ""}
                                        onChange={(e) => updateWeapon(weaponIndex, { skillId: e.target.value })}
                                      >
                                        <option value="">Unspecified</option>
                                        {Object.entries(skillLabelById)
                                          .sort((a, b) => a[1].localeCompare(b[1]))
                                          .map(([id, label]) => (
                                            <option key={id} value={id}>
                                              {label}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label>Use DC</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={weapon.useDC ?? 0}
                                        onChange={(e) =>
                                          updateWeapon(weaponIndex, { useDC: Number(e.target.value) || 0 })
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
                                          updateWeapon(weaponIndex, { damage: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label>Range</label>
                                      <input
                                        value={weapon.range ?? ""}
                                        onChange={(e) => updateWeapon(weaponIndex, { range: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label>Ammo</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={weapon.ammo ?? 0}
                                        onChange={(e) =>
                                          updateWeapon(weaponIndex, { ammo: Number(e.target.value) || 0 })
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
                                          updateWeapon(weaponIndex, { bulk: Number(e.target.value) || 0 })
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
                                          updateWeapon(weaponIndex, { cost: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label>Req</label>
                                      <input
                                        value={weapon.req ?? ""}
                                        onChange={(e) => updateWeapon(weaponIndex, { req: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                  <div className="gameplay-block">
                                    {renderGameplayTags(weapon.gameplayEffects, (effectIndex) => {
                                      const next = [...(weapon.gameplayEffects ?? [])];
                                      next.splice(effectIndex, 1);
                                      setWeaponGameplayEffects(weaponIndex, next);
                                    })}
                                    {draft.open ? (
                                      <div className="gameplay-editor">
                                        <select
                                          value={draft.category}
                                          onChange={(e) => {
                                            const category = e.target.value as GameplayCategory;
                                            const target = categoryTargetOptions(category)[0]?.key ?? "";
                                            setWeaponGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, category, target },
                                            }));
                                          }}
                                        >
                                          <option value="attribute">Attribute</option>
                                          <option value="inherent_skill">Inherent Skill</option>
                                          <option value="learning_focus_skill">Learning Focus Skill</option>
                                          <option value="other">Other</option>
                                        </select>
                                        <select
                                          value={draft.target}
                                          onChange={(e) =>
                                            setWeaponGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, target: e.target.value },
                                            }))
                                          }
                                        >
                                          {categoryTargetOptions(draft.category).map((opt) => (
                                            <option key={opt.key} value={opt.key}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="skill-rank-controls">
                                          <button
                                            className="ghost"
                                            onClick={() =>
                                              setWeaponGameplayDrafts((prev) => ({
                                                ...prev,
                                                [key]: { ...draft, amount: Math.max(-5, draft.amount - 1) },
                                              }))
                                            }
                                          >
                                            -
                                          </button>
                                          <input type="number" min={-5} max={5} value={draft.amount} readOnly />
                                          <button
                                            className="ghost"
                                            onClick={() =>
                                              setWeaponGameplayDrafts((prev) => ({
                                                ...prev,
                                                [key]: { ...draft, amount: Math.min(5, draft.amount + 1) },
                                              }))
                                            }
                                          >
                                            +
                                          </button>
                                        </div>
                                        <button
                                          className="ghost"
                                          onClick={() => {
                                            const next = [
                                              ...(weapon.gameplayEffects ?? []),
                                              toGameplayEffect(draft.target, draft.amount),
                                            ];
                                            setWeaponGameplayEffects(weaponIndex, next);
                                            setWeaponGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, open: false, amount: 0 },
                                            }));
                                          }}
                                        >
                                          Add
                                        </button>
                                      </div>
                                    ) : null}
                                    <button
                                      className="ghost"
                                      onClick={() =>
                                        setWeaponGameplayDrafts((prev) => ({
                                          ...prev,
                                          [key]: defaultDraft(true),
                                        }))
                                      }
                                    >
                                      Add Gameplay Effect
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="gear-section stack">
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
                        <select value={armourPickId} onChange={(e) => setArmourPickId(e.target.value)}>
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
                    {activeArmour && armourMatchesSearch ? (
                      <div className="gear-card expanded cut-corner-padded">
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
                                updateSheet({ ...sheet, armour: { ...activeArmour, name: e.target.value } })
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
                                  armour: { ...activeArmour, protection: Number(e.target.value) || 0 },
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
                                updateSheet({ ...sheet, armour: { ...activeArmour, bulk: Number(e.target.value) || 0 } })
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
                                updateSheet({ ...sheet, armour: { ...activeArmour, cost: Number(e.target.value) || 0 } })
                              }
                            />
                          </div>
                          <div>
                            <label>Req</label>
                            <input
                              value={activeArmour.req ?? ""}
                              onChange={(e) =>
                                updateSheet({ ...sheet, armour: { ...activeArmour, req: e.target.value } })
                              }
                            />
                          </div>
                          <div className="span-2">
                            <label>Special</label>
                            <textarea
                              value={activeArmour.special ?? ""}
                              onChange={(e) =>
                                updateSheet({ ...sheet, armour: { ...activeArmour, special: e.target.value } })
                              }
                            />
                          </div>
                        </div>
                        <div className="gameplay-block">
                          {renderGameplayTags(activeArmour.gameplayEffects, (effectIndex) => {
                            const next = [...(activeArmour.gameplayEffects ?? [])];
                            next.splice(effectIndex, 1);
                            setArmourGameplayEffects(next);
                          })}
                          {armourGameplayDraft.open ? (
                            <div className="gameplay-editor">
                              <select
                                value={armourGameplayDraft.category}
                                onChange={(e) => {
                                  const category = e.target.value as GameplayCategory;
                                  const target = categoryTargetOptions(category)[0]?.key ?? "";
                                  setArmourGameplayDraft((prev) => ({ ...prev, category, target }));
                                }}
                              >
                                <option value="attribute">Attribute</option>
                                <option value="inherent_skill">Inherent Skill</option>
                                <option value="learning_focus_skill">Learning Focus Skill</option>
                                <option value="other">Other</option>
                              </select>
                              <select
                                value={armourGameplayDraft.target}
                                onChange={(e) =>
                                  setArmourGameplayDraft((prev) => ({ ...prev, target: e.target.value }))
                                }
                              >
                                {categoryTargetOptions(armourGameplayDraft.category).map((opt) => (
                                  <option key={opt.key} value={opt.key}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <div className="skill-rank-controls">
                                <button
                                  className="ghost"
                                  onClick={() =>
                                    setArmourGameplayDraft((prev) => ({
                                      ...prev,
                                      amount: Math.max(-5, prev.amount - 1),
                                    }))
                                  }
                                >
                                  -
                                </button>
                                <input type="number" min={-5} max={5} value={armourGameplayDraft.amount} readOnly />
                                <button
                                  className="ghost"
                                  onClick={() =>
                                    setArmourGameplayDraft((prev) => ({
                                      ...prev,
                                      amount: Math.min(5, prev.amount + 1),
                                    }))
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <button
                                className="ghost"
                                onClick={() => {
                                  setArmourGameplayEffects([
                                    ...(activeArmour.gameplayEffects ?? []),
                                    toGameplayEffect(armourGameplayDraft.target, armourGameplayDraft.amount),
                                  ]);
                                  setArmourGameplayDraft((prev) => ({
                                    ...prev,
                                    open: false,
                                    amount: 0,
                                  }));
                                }}
                              >
                                Add
                              </button>
                            </div>
                          ) : null}
                          <button
                            className="ghost"
                            onClick={() => setArmourGameplayDraft(defaultDraft(true))}
                          >
                            Add Gameplay Effect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="muted">
                        {activeArmour ? "No armour matches your search." : "No armour equipped."}
                      </p>
                    )}
                  </div>

                  <div className="gear-section stack">
                    <h3>Items</h3>
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
                        <select value={gearPickName} onChange={(e) => setGearPickName(e.target.value)}>
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
                    {filteredInventoryRows.length === 0 ? (
                      <p className="muted">
                        {(sheet.inventory ?? []).length === 0
                          ? "No inventory items yet."
                          : "No inventory items match your search."}
                      </p>
                    ) : (
                      <div className="gear-list">
                        <div className="gear-row gear-row-header">
                          <span>Move</span>
                          <span>Name</span>
                          <span>Type</span>
                          <span>Bulk</span>
                          <span>Quantity</span>
                          <span>Uses</span>
                          <span>Cost</span>
                          <span>Actions</span>
                        </div>
                        {filteredInventoryRows.map(({ gear, index: inventoryIndex }) => {
                          const key = inventoryRowKey(gear, inventoryIndex);
                          const expanded = Boolean(inventoryExpanded[key]);
                          const draft = inventoryGameplayDrafts[key] ?? defaultDraft(false);
                          return (
                            <div
                              className={`gear-card cut-corner-padded ${expanded ? "expanded" : "collapsed"}`}
                              key={key}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                              }}
                              onDrop={(event) => {
                                const fromRaw = event.dataTransfer.getData("text/plain");
                                const parsed = Number(fromRaw);
                                const from = Number.isFinite(parsed) ? parsed : draggingInventoryIndex;
                                if (from === null) return;
                                reorderInventory(from, inventoryIndex);
                                setDraggingInventoryIndex(null);
                              }}
                            >
                              <div
                                className="gear-row"
                                onClick={(event) => {
                                  const target = event.target as HTMLElement;
                                  if (target.closest("[data-no-expand='true']")) return;
                                  setInventoryExpanded((prev) => ({ ...prev, [key]: !expanded }));
                                }}
                              >
                                <div
                                  data-no-expand="true"
                                  className="drag-handle"
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", String(inventoryIndex));
                                    setDraggingInventoryIndex(inventoryIndex);
                                  }}
                                  onDragEnd={() => setDraggingInventoryIndex(null)}
                                  aria-label="Drag to reorder item"
                                  title="Drag to reorder"
                                >
                                  ::
                                </div>
                                <span>{gear.name || "Unnamed"}</span>
                                <span>{gear.type}</span>
                                <span>{gear.bulk ?? 0}</span>
                                <div className="inline row-controls" data-no-expand="true">
                                  <button
                                    className="ghost"
                                    onClick={() =>
                                      updateInventoryItem(inventoryIndex, {
                                        quantity: Math.max(0, (gear.quantity ?? 1) - 1),
                                      })
                                    }
                                  >
                                    -
                                  </button>
                                  <span>{gear.quantity ?? 1}</span>
                                  <button
                                    className="ghost"
                                    onClick={() =>
                                      updateInventoryItem(inventoryIndex, { quantity: (gear.quantity ?? 1) + 1 })
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                                <span>{"uses" in gear ? gear.uses ?? "-" : "-"}</span>
                                <span>{gear.cost ?? 0}</span>
                                <button
                                  data-no-expand="true"
                                  className="ghost danger"
                                  onClick={() => removeInventoryItem(inventoryIndex)}
                                >
                                  Remove
                                </button>
                              </div>
                              {expanded ? (
                                <div className="gear-expand">
                                  <div className="grid three">
                                    <div>
                                      <label>Name</label>
                                      <input
                                        value={gear.name ?? ""}
                                        onChange={(e) =>
                                          updateInventoryItem(inventoryIndex, { name: e.target.value })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label>Quantity</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={gear.quantity ?? 1}
                                        onChange={(e) =>
                                          updateInventoryItem(inventoryIndex, {
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
                                          updateInventoryItem(inventoryIndex, { bulk: Number(e.target.value) || 0 })
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
                                          updateInventoryItem(inventoryIndex, { cost: Number(e.target.value) || 0 })
                                        }
                                      />
                                    </div>
                                    {gear.type === "item" ? (
                                      <>
                                        <div>
                                          <label>Uses</label>
                                          <input
                                            value={gear.uses ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { uses: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="span-2">
                                          <label>Effect</label>
                                          <textarea
                                            value={gear.effect ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { effect: e.target.value })
                                            }
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
                                              updateInventoryItem(inventoryIndex, {
                                                tier: Number(e.target.value) || 0,
                                              })
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
                                              updateInventoryItem(inventoryIndex, {
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
                                              updateInventoryItem(inventoryIndex, {
                                                requirements: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label>Physical Impact</label>
                                          <input
                                            value={gear.physicalImpact ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, {
                                                physicalImpact: e.target.value,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="span-2">
                                          <label>Effect</label>
                                          <textarea
                                            value={gear.effect ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { effect: e.target.value })
                                            }
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
                                              updateInventoryItem(inventoryIndex, {
                                                uses: Number(e.target.value) || 0,
                                              })
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
                                              updateInventoryItem(inventoryIndex, {
                                                addictionScore: Number(e.target.value) || 0,
                                              })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label>Legality</label>
                                          <input
                                            value={gear.legality ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { legality: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div className="span-2">
                                          <label>Effect</label>
                                          <textarea
                                            value={gear.effect ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { effect: e.target.value })
                                            }
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
                                              updateInventoryItem(inventoryIndex, {
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
                                              updateInventoryItem(inventoryIndex, {
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
                                              updateInventoryItem(inventoryIndex, {
                                                tier: Number(e.target.value) || 0,
                                              })
                                            }
                                          />
                                        </div>
                                        <div className="span-2">
                                          <label>Notes</label>
                                          <textarea
                                            value={gear.notes ?? ""}
                                            onChange={(e) =>
                                              updateInventoryItem(inventoryIndex, { notes: e.target.value })
                                            }
                                          />
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                  <div className="gameplay-block">
                                    {renderGameplayTags(gear.gameplayEffects, (effectIndex) => {
                                      const next = [...(gear.gameplayEffects ?? [])];
                                      next.splice(effectIndex, 1);
                                      setInventoryGameplayEffects(inventoryIndex, next);
                                    })}
                                    {draft.open ? (
                                      <div className="gameplay-editor">
                                        <select
                                          value={draft.category}
                                          onChange={(e) => {
                                            const category = e.target.value as GameplayCategory;
                                            const target = categoryTargetOptions(category)[0]?.key ?? "";
                                            setInventoryGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, category, target },
                                            }));
                                          }}
                                        >
                                          <option value="attribute">Attribute</option>
                                          <option value="inherent_skill">Inherent Skill</option>
                                          <option value="learning_focus_skill">Learning Focus Skill</option>
                                          <option value="other">Other</option>
                                        </select>
                                        <select
                                          value={draft.target}
                                          onChange={(e) =>
                                            setInventoryGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, target: e.target.value },
                                            }))
                                          }
                                        >
                                          {categoryTargetOptions(draft.category).map((opt) => (
                                            <option key={opt.key} value={opt.key}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="skill-rank-controls">
                                          <button
                                            className="ghost"
                                            onClick={() =>
                                              setInventoryGameplayDrafts((prev) => ({
                                                ...prev,
                                                [key]: { ...draft, amount: Math.max(-5, draft.amount - 1) },
                                              }))
                                            }
                                          >
                                            -
                                          </button>
                                          <input type="number" min={-5} max={5} value={draft.amount} readOnly />
                                          <button
                                            className="ghost"
                                            onClick={() =>
                                              setInventoryGameplayDrafts((prev) => ({
                                                ...prev,
                                                [key]: { ...draft, amount: Math.min(5, draft.amount + 1) },
                                              }))
                                            }
                                          >
                                            +
                                          </button>
                                        </div>
                                        <button
                                          className="ghost"
                                          onClick={() => {
                                            const next = [
                                              ...(gear.gameplayEffects ?? []),
                                              toGameplayEffect(draft.target, draft.amount),
                                            ];
                                            setInventoryGameplayEffects(inventoryIndex, next);
                                            setInventoryGameplayDrafts((prev) => ({
                                              ...prev,
                                              [key]: { ...draft, open: false, amount: 0 },
                                            }));
                                          }}
                                        >
                                          Add
                                        </button>
                                      </div>
                                    ) : null}
                                    <button
                                      className="ghost"
                                      onClick={() =>
                                        setInventoryGameplayDrafts((prev) => ({
                                          ...prev,
                                          [key]: defaultDraft(true),
                                        }))
                                      }
                                    >
                                      Add Gameplay Effect
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {step === "review" && (
          <div className="stack review-layout">
            <div className="review-hero">
              <h2>{sheet.name || "Unnamed Character"}</h2>
              <p className="muted">{sheet.motivation || "Motivation missing"}</p>
            </div>

            <div className="review-metrics">
              <div className="review-pill">
                <span>Credits</span>
                <strong>{sheet.credits ?? 0}</strong>
              </div>
              <div className="review-pill">
                <span>Total Bulk</span>
                <strong>{gearTotals.bulk}</strong>
              </div>
              <div className="review-pill">
                <span>CUF</span>
                <strong>{sheet.stress?.cuf ?? 0}</strong>
              </div>
              <div className="review-pill">
                <span>Speed</span>
                <strong>{derivedStats.speed}</strong>
              </div>
              <div className="review-pill">
                <span>Capacity</span>
                <strong>{derivedStats.capacity}</strong>
              </div>
            </div>

            <div className="review-grid">
              <section className="review-card">
                <h3>Attributes</h3>
                <ul className="review-list">
                  {Object.entries(ATTRIBUTE_LABELS).map(([key, short]) => (
                    <li key={key}>
                      <span>{ATTRIBUTE_FULL_LABELS[key as AttributeKey]}</span>
                      <strong>{sheet.attributes[key as AttributeKey]}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="review-card">
                <h3>Skills</h3>
                <ul className="review-list">
                  {Object.keys(sheet.skills ?? {}).length ? (
                    Object.entries(sheet.skills ?? {})
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([key, rank]) => (
                        <li key={key}>
                          <span>{skillLabelById[key] ?? key}</span>
                          <strong>{rank}</strong>
                        </li>
                      ))
                  ) : (
                    <li>
                      <span>None</span>
                    </li>
                  )}
                </ul>
              </section>

              <section className="review-card">
                <h3>Equipment</h3>
                <ul className="review-list">
                  {(sheet.weapons ?? []).map((weapon, idx) => (
                    <li key={`weapon-${weapon.id ?? idx}`}>
                      <span>{weapon.name || "Unnamed Weapon"}</span>
                      <strong>Weapon</strong>
                    </li>
                  ))}
                  {sheet.armour ? (
                    <li>
                      <span>{sheet.armour.name || "Armour"}</span>
                      <strong>Armour</strong>
                    </li>
                  ) : null}
                  {(sheet.inventory ?? []).map((gear, idx) => (
                    <li key={gear.id ?? String(idx)}>
                      <span>{gear.name || "Unnamed Item"}</span>
                      <strong>{gear.type}</strong>
                    </li>
                  ))}
                  {(sheet.weapons ?? []).length === 0 && !sheet.armour && (sheet.inventory ?? []).length === 0 ? (
                    <li>
                      <span>None</span>
                    </li>
                  ) : null}
                </ul>
              </section>

              <section className="review-card">
                <h3>Health</h3>
                <ul className="review-list">
                  <li>
                    <span>Stress (Current)</span>
                    <strong>{sheet.stress?.current ?? 0}</strong>
                  </li>
                  <li>
                    <span>CUF Loss</span>
                    <strong>{sheet.stress?.cufLoss ?? 0}</strong>
                  </li>
                  <li>
                    <span>Wounds (Light)</span>
                    <strong>{sheet.wounds?.light ?? 0}</strong>
                  </li>
                  <li>
                    <span>Wounds (Moderate)</span>
                    <strong>{sheet.wounds?.moderate ?? 0}</strong>
                  </li>
                  <li>
                    <span>Wounds (Heavy)</span>
                    <strong>{sheet.wounds?.heavy ?? 0}</strong>
                  </li>
                </ul>
              </section>
            </div>

            <div className="review-card">
              <h3>Notes</h3>
              <textarea
                value={sheet.notes}
                onChange={(e) => updateSheet({ ...sheet, notes: e.target.value })}
              />
            </div>
          </div>
        )}
        <div className="steps-nav in-card">
          <button className="ghost" onClick={goPrev} disabled={currentStepIndex === 0}>
            Previous
          </button>
          <button
            className="primary"
            onClick={goNext}
            disabled={currentStepIndex === STEPS.length - 1}
          >
            Next
          </button>
        </div>
      </section>


      {renderFooter()}

      {saveMenuOpen ? (
        <div className="modal" onClick={() => setSaveMenuOpen(false)}>
          <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Save Character</h2>
              <button className="ghost" onClick={() => setSaveMenuOpen(false)}>
                Close
              </button>
            </div>
            <div className="stack">
              <button
                className="primary"
                onClick={() => {
                  if (!user) {
                    setSaveMenuOpen(false);
                    setAuthDialogOpen(true);
                    return;
                  }
                  void openSaveOptions("cloud");
                }}
              >
                Save
              </button>
              <button className="ghost" onClick={() => void openSaveOptions("local")}>
                Save (LocalStorage)
              </button>
              <button className="ghost" onClick={() => downloadCharacter(sheet)}>
                Export (JSON)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {authDialogOpen ? (
        <div className="modal" onClick={() => setAuthDialogOpen(false)}>
          <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Log In / Sign Up</h2>
              <button className="ghost" onClick={() => setAuthDialogOpen(false)}>
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
            ) : (
              <div className="stack">
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
            )}
            {authFeedback ? (
              <p className={authFeedback.tone === "success" ? "success" : "error"}>
                {authFeedback.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {saveOptionsOpen ? (
        <div className="modal" onClick={() => setSaveOptionsOpen(false)}>
          <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{saveTarget === "cloud" ? "Save" : "Save (LocalStorage)"}</h2>
              <button className="ghost" onClick={() => setSaveOptionsOpen(false)}>
                Close
              </button>
            </div>
            <div className="stack">
              {saveTarget === "cloud" ? (
                <div>
                  <label>Visibility</label>
                  <select
                    value={saveVisibility}
                    onChange={(e) => setSaveVisibility(e.target.value as "private" | "public")}
                  >
                    <option value="private">Private (just you)</option>
                    <option value="public">Public</option>
                  </select>
                  <p className="muted">
                    {saveVisibility === "private"
                      ? "Private characters can be viewed only by you."
                      : "Public characters can be viewed by anyone."}
                  </p>
                </div>
              ) : null}
              {saveNewAvailable ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={saveNew}
                    onChange={(e) => setSaveNew(e.target.checked)}
                  />
                  <span>New copy</span>
                  <span className="muted" title="Creates a new character instead of overwriting the existing one.">
                    i
                  </span>
                </label>
              ) : null}
              <button className="primary" onClick={() => void executeSave()}>
                Save
              </button>
            </div>
            {saveError ? <p className="error">{saveError}</p> : null}
          </div>
        </div>
      ) : null}

      {importDialogOpen ? (
        <div className="modal" onClick={() => setImportDialogOpen(false)}>
          <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Character</h2>
              <button className="ghost" onClick={() => setImportDialogOpen(false)}>
                Close
              </button>
            </div>
            <div
              className={`dropzone ${importDragActive ? "active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setImportDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setImportDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setImportDragActive(false);
                const file = event.dataTransfer.files?.[0] ?? null;
                void handleImportDrop(file);
              }}
            >
              <p>Drag and drop a character JSON file here</p>
              <label className="ghost">
                Choose File
                <input
                  type="file"
                  accept="application/json"
                  onChange={(event) => void handleImportDrop(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {unsavedPromptOpen ? (
        <div className="modal" onClick={() => setUnsavedPromptOpen(false)}>
          <div className="modal-card cut-corner-padded" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>You have unsaved changes</h2>
              <button className="ghost" onClick={() => setUnsavedPromptOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted">
              {pendingEditorAction?.type === "edit"
                ? pendingEditorAction.name
                : sheet.name || "Current character"}
            </p>
            <div className="stack">
              <button
                className="primary"
                onClick={() => {
                  setUnsavedPromptOpen(false);
                  setSaveMenuOpen(true);
                }}
              >
                Save
              </button>
              <button
                className="ghost danger"
                onClick={() => {
                  const action = pendingEditorAction;
                  setUnsavedPromptOpen(false);
                  setPendingEditorAction(null);
                  if (action) void applyEditorAction(action);
                }}
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
