const canonicalUnits = new Set(["px", "deg", "s", "hz", "dppx", "number", "fr"]);

export function isCanonical(unit) {
  return canonicalUnits.has(unit.toLowerCase());
}