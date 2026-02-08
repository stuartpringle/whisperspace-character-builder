import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_API_BASE, RULES_API_BASE } from "@whisperspace/sdk";
import type { AttributeKey, BuilderStep, CharacterSheet } from "./model/character";
import { createBlankCharacter, updateTimestamp } from "./model/character";
import { clearDraft, loadDraft, saveDraft } from "./storage/local";
import { readCharacterFile } from "./storage/transfer";
import { getLastSync, syncToCloud } from "./storage/sync";
import { getProviders, type StorageTarget } from "./storage/providers";
import { saveCharacter } from "./storage/remote";

const STEPS: { id: BuilderStep; label: string; hint: string }[] = [
  { id: "basics", label: "Basics", hint: "Who are they?" },
  { id: "attributes", label: "Attributes", hint: "Core stats" },
  { id: "skills", label: "Skills", hint: "Focus and ranks" },
  { id: "gear", label: "Gear", hint: "Loadout" },
  { id: "review", label: "Review", hint: "Summary" },
];

const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  phys: "Phys",
  dex: "Dex",
  int: "Int",
  will: "Will",
  cha: "Cha",
  emp: "Emp",
};

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");
  const apiBase = useMemo(
    () => (import.meta as any).env?.VITE_CHARACTER_API_BASE || CHARACTER_API_BASE,
    []
  );
  const [sheet, setSheet] = useState<CharacterSheet>(() => loadDraft() ?? createBlankCharacter());
  const [step, setStep] = useState<BuilderStep>("basics");
  const [importError, setImportError] = useState<string>("");
  const [cloudEnabled, setCloudEnabled] = useState<boolean>(
    localStorage.getItem("ws_character_cloud_enabled") === "true"
  );
  const [cloudStatus, setCloudStatus] = useState<string>(getLastSync() || "not synced");
  const [cloudError, setCloudError] = useState<string>("");
  const [cloudId, setCloudId] = useState<string>("");
  const [cloudList, setCloudList] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const [cloudLoading, setCloudLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [storageTarget, setStorageTarget] = useState<StorageTarget>("draft");
  const [conflictSheet, setConflictSheet] = useState<CharacterSheet | null>(null);
  const [apiKey, setApiKey] = useState<string>(
    localStorage.getItem("ws_character_api_key") || ""
  );
  const syncTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${RULES_API_BASE}/meta.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((meta) => {
        if (!active) return;
        setApiStatus(`rules v${meta.version}`);
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
    saveDraft(sheet);
  }, [sheet]);

  useEffect(() => {
    localStorage.setItem("ws_character_cloud_enabled", String(cloudEnabled));
  }, [cloudEnabled]);

  useEffect(() => {
    localStorage.setItem("ws_character_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (!cloudEnabled) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(async () => {
      setCloudError("");
      setCloudStatus("syncing...");
      const result = await syncToCloud(sheet);
      if (result.ok) {
        setCloudStatus(`synced ${new Date(result.at || "").toLocaleTimeString()}`);
      } else {
        setCloudStatus("sync failed");
        setCloudError(result.error || "Sync failed");
      }
    }, 800);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [sheet, cloudEnabled]);

  const providers = useMemo(() => getProviders(), []);
  const activeProvider = providers.find((p) => p.id === storageTarget) || providers[0];
  const cloudProvider = providers.find((p) => p.id === "cloud");

  const refreshCloudList = async () => {
    if (!cloudEnabled) return;
    setCloudLoading(true);
    try {
      const list = await cloudProvider?.list?.();
      if (list) setCloudList(list);
    } catch {
      setCloudError("Could not load cloud list.");
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    void refreshCloudList();
  }, [cloudEnabled]);

  const handleSave = async () => {
    setSaveStatus("saving...");
    setCloudError("");
    setConflictSheet(null);
    const result = await activeProvider.save(sheet);
    if (result.ok) {
      setSaveStatus(result.message || "saved");
      if (storageTarget === "cloud") {
        await refreshCloudList();
      }
    } else if (result.conflict) {
      setSaveStatus("conflict");
      setCloudError("Conflict: remote has a newer version.");
      setConflictSheet(result.conflict);
    } else {
      setSaveStatus("failed");
      setCloudError(result.message || "Save failed");
    }
  };

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
        {importError ? <p className="error">{importError}</p> : null}
        {cloudError ? <p className="error">{cloudError}</p> : null}
        {saveStatus ? <p className="muted">Save: {saveStatus}</p> : null}
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
                    await refreshCloudList();
                  } else {
                    setCloudError("Force save failed");
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
            <div>
              <label>Concept</label>
              <input
                value={sheet.concept}
                onChange={(e) => updateSheet({ ...sheet, concept: e.target.value })}
                placeholder="Street doc with a debt"
              />
            </div>
            <div className="span-2">
              <label>Background</label>
              <textarea
                value={sheet.background}
                onChange={(e) => updateSheet({ ...sheet, background: e.target.value })}
                placeholder="A few lines about their story."
              />
            </div>
          </div>
        )}

        {step === "attributes" && (
          <div className="grid three">
            {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
              <div key={key} className="stat">
                <label>{label}</label>
                <input
                  type="number"
                  value={sheet.attributes[key as AttributeKey]}
                  onChange={(e) =>
                    updateSheet({
                      ...sheet,
                      attributes: {
                        ...sheet.attributes,
                        [key]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

        {step === "skills" && (
          <div className="stack">
            <p className="muted">
              Add skills manually for now. We will wire these to rules data next.
            </p>
            <button
              className="ghost"
              onClick={() =>
                updateSheet({
                  ...sheet,
                  skills: [
                    ...sheet.skills,
                    { key: crypto.randomUUID(), label: "", rank: 0 },
                  ],
                })
              }
            >
              Add Skill
            </button>
            {sheet.skills.map((skill, idx) => (
              <div className="grid two" key={skill.key}>
                <input
                  value={skill.label}
                  placeholder="Athletics"
                  onChange={(e) => {
                    const next = [...sheet.skills];
                    next[idx] = { ...skill, label: e.target.value };
                    updateSheet({ ...sheet, skills: next });
                  }}
                />
                <input
                  type="number"
                  value={skill.rank}
                  onChange={(e) => {
                    const next = [...sheet.skills];
                    next[idx] = { ...skill, rank: Number(e.target.value) || 0 };
                    updateSheet({ ...sheet, skills: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {step === "gear" && (
          <div className="stack">
            <p className="muted">Add gear manually for now.</p>
            <button
              className="ghost"
              onClick={() =>
                updateSheet({
                  ...sheet,
                  gear: [
                    ...sheet.gear,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      type: "item",
                    },
                  ],
                })
              }
            >
              Add Gear
            </button>
            {sheet.gear.map((gear, idx) => (
              <div className="grid two" key={gear.id}>
                <input
                  value={gear.name}
                  placeholder="Shotgun"
                  onChange={(e) => {
                    const next = [...sheet.gear];
                    next[idx] = { ...gear, name: e.target.value };
                    updateSheet({ ...sheet, gear: next });
                  }}
                />
                <select
                  value={gear.type}
                  onChange={(e) => {
                    const next = [...sheet.gear];
                    next[idx] = { ...gear, type: e.target.value as CharacterSheet["gear"][0]["type"] };
                    updateSheet({ ...sheet, gear: next });
                  }}
                >
                  <option value="weapon">Weapon</option>
                  <option value="armour">Armour</option>
                  <option value="item">Item</option>
                  <option value="cyberware">Cyberware</option>
                  <option value="narcotic">Narcotic</option>
                  <option value="hacker_gear">Hacker Gear</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {step === "review" && (
          <div className="stack">
            <h2>{sheet.name || "Unnamed Character"}</h2>
            <p className="muted">{sheet.concept || "Concept missing"}</p>
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
              </div>
              <div>
                <h3>Skills</h3>
                <ul>
                  {sheet.skills.length
                    ? sheet.skills.map((skill) => (
                        <li key={skill.key}>
                          {skill.label || "Unnamed"} ({skill.rank})
                        </li>
                      ))
                    : "None"}
                </ul>
              </div>
              <div>
                <h3>Gear</h3>
                <ul>
                  {sheet.gear.length
                    ? sheet.gear.map((gear) => (
                        <li key={gear.id}>
                          {gear.name || "Unnamed"} ({gear.type})
                        </li>
                      ))
                    : "None"}
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

      <section className="card cloud">
        <h2>Cloud Sync</h2>
        <p className="muted">
          Base URL: {apiBase}. Override with{" "}
          <code>VITE_CHARACTER_API_BASE</code>.
        </p>
        <div className="grid two">
          <div>
            <label>API Key (optional)</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Optional shared key"
            />
          </div>
          <div className="toggle">
            <label>Enable Cloud Sync</label>
            <button className={cloudEnabled ? "primary" : "ghost"} onClick={() => setCloudEnabled(!cloudEnabled)}>
              {cloudEnabled ? "Enabled" : "Disabled"}
            </button>
            <span className="muted">Status: {cloudStatus}</span>
          </div>
        </div>
        <div className="grid three">
          <div>
            <label>Save Target</label>
            <select value={storageTarget} onChange={(e) => setStorageTarget(e.target.value as StorageTarget)}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="stack">
            <label>Save</label>
            <button className="ghost" onClick={handleSave}>
              Save Now
            </button>
          </div>
          <div className="stack">
            <label>Cloud List</label>
            <button className="ghost" onClick={refreshCloudList} disabled={!cloudEnabled || cloudLoading}>
              {cloudLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        <div className="grid two">
          <div>
            <label>Load Character by ID</label>
            <div className="inline">
              <input
                value={cloudId}
                onChange={(e) => setCloudId(e.target.value)}
                placeholder="UUID"
              />
              <button
                className="ghost"
                onClick={async () => {
                  if (!cloudId) return;
                  setCloudError("");
                  try {
                    const data = await cloudProvider?.load?.(cloudId);
                    if (data) updateSheet(data);
                    setStep("review");
                  } catch {
                    setCloudError("Could not load that character.");
                  }
                }}
              >
                Load
              </button>
            </div>
          </div>
          <div className="stack">
            <label>Manual Sync</label>
            <button
              className="ghost"
              onClick={async () => {
                setCloudError("");
                setCloudStatus("syncing...");
                const result = await syncToCloud(sheet);
                if (result.ok) {
                  setCloudStatus(`synced ${new Date(result.at || "").toLocaleTimeString()}`);
                } else {
                  setCloudStatus("sync failed");
                  setCloudError(result.error || "Sync failed");
                }
              }}
            >
              Sync Now
            </button>
          </div>
        </div>
        <div className="cloud-list">
          <h3>Cloud Characters</h3>
          {cloudList.length === 0 ? (
            <p className="muted">No cloud characters found.</p>
          ) : (
            <ul>
              {cloudList.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name || "Unnamed"}</strong>
                    <span className="muted">{new Date(item.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="inline">
                    <button
                      className="ghost"
                      onClick={async () => {
                        setCloudError("");
                        try {
                          const data = await cloudProvider?.load?.(item.id);
                          if (data) updateSheet(data);
                          setStep("review");
                        } catch {
                          setCloudError("Could not load that character.");
                        }
                      }}
                    >
                      Load
                    </button>
                    <button
                      className="ghost danger"
                      onClick={async () => {
                        if (!cloudProvider?.remove) return;
                        try {
                          await cloudProvider.remove(item.id);
                          await refreshCloudList();
                        } catch {
                          setCloudError("Could not delete that character.");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">
        <button className="ghost" onClick={goPrev} disabled={currentStepIndex === 0}>
          Back
        </button>
        <button className="primary" onClick={goNext} disabled={currentStepIndex === STEPS.length - 1}>
          Next
        </button>
      </footer>
    </div>
  );
}
