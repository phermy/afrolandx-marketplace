// A name comparison is an aid to an administrator, never a registry lookup.
export function normalizeCacBusinessName(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(?:\s+(?:limited|ltd|plc|incorporated|inc|llc))+$/g, "")
    .trim();
}

export function cacBusinessNamesMatch(registeredName: string, vendorName: string): boolean {
  const registered = normalizeCacBusinessName(registeredName);
  return Boolean(registered) && registered === normalizeCacBusinessName(vendorName);
}