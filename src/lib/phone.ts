export function normalizePhoneNumber(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

export function isValidPhoneNumber(input: string): boolean {
  const normalized = normalizePhoneNumber(input);
  return normalized.length >= 10 && normalized.length <= 15;
}

export function uniqPhones(items: string[]): string[] {
  return [...new Set(items.map(normalizePhoneNumber).filter(Boolean))];
}
