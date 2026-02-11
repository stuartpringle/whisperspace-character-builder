import type { CharacterSheet } from "./character";

const ALLOWED_INVENTORY_TYPES = new Set(["item", "cyberware", "narcotics", "hacker_gear"]);

export function validateCharacterRecordV1(sheet: CharacterSheet): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sheet.id) errors.push("Missing id.");
  if (!sheet.attributes) errors.push("Missing attributes.");
  if (!sheet.skills) errors.push("Missing skills.");
  if (!sheet.createdAt) errors.push("Missing createdAt.");
  if (!sheet.updatedAt) errors.push("Missing updatedAt.");
  if (sheet.version !== 1) errors.push("Invalid version.");

  const attrs = sheet.attributes || ({} as CharacterSheet["attributes"]);
  for (const key of ["phys", "ref", "soc", "ment"] as const) {
    const value = attrs[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      errors.push(`Attribute '${key}' must be a number.`);
    }
  }

  if (!Array.isArray(sheet.inventory)) {
    errors.push("Inventory must be an array.");
  } else {
    sheet.inventory.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`Inventory item #${idx + 1} is invalid.`);
        return;
      }
      if (!ALLOWED_INVENTORY_TYPES.has((item as { type?: string }).type ?? "")) {
        errors.push(`Inventory item #${idx + 1} has invalid type.`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}
