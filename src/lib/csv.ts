import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { CsvImportResult } from "@/types/messaging";

function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

export function parsePhoneCsv(csvRaw: string): CsvImportResult {
  const lines = csvRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { imported: [], duplicates: [], invalid: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstCell = lines[0].split(delimiter)[0]?.trim() ?? "";
  const hasHeader = /[a-zA-Z]/.test(firstCell) && !isValidPhoneNumber(firstCell);
  const payloadLines = hasHeader ? lines.slice(1) : lines;

  const importedSet = new Set<string>();
  const duplicatesSet = new Set<string>();
  const invalidSet = new Set<string>();

  for (const line of payloadLines) {
    const firstColumn = line.split(delimiter)[0]?.trim() ?? "";
    const normalized = normalizePhoneNumber(firstColumn);

    if (!isValidPhoneNumber(normalized)) {
      if (firstColumn) invalidSet.add(firstColumn);
      continue;
    }

    if (importedSet.has(normalized)) {
      duplicatesSet.add(normalized);
      continue;
    }

    importedSet.add(normalized);
  }

  return {
    imported: [...importedSet],
    duplicates: [...duplicatesSet],
    invalid: [...invalidSet],
  };
}
