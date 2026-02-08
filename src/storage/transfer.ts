import type { CharacterSheet } from "../model/character";

export function downloadCharacter(sheet: CharacterSheet) {
  const blob = new Blob([JSON.stringify(sheet, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(sheet.name || "whisperspace-character")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readCharacterFile(file: File): Promise<CharacterSheet> {
  const text = await file.text();
  const data = JSON.parse(text) as CharacterSheet;
  return data;
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_{2,}/g, "_");
}
