const canonicalUnits = new Set(["px", "deg", "s", "hz", "dppx", "number", "fr"]);

export function isCanonical(unit) {
  return canonicalUnits.has(unit.toLowerCase());
}

export function normalizeAxis(axis, computedStyle) {
  if (['x','y'].includes(axis)) return axis;

  if (!computedStyle) {
    throw new Error('To determine the normalized axis the computedStyle of the source is required.');
  }

  const horizontalWritingMode = computedStyle.writingMode == 'horizontal-tb';
  if (axis === "block") {
    axis = horizontalWritingMode ? "y" : "x";
  } else if (axis === "inline") {
    axis = horizontalWritingMode ? "x" : "y";
  } else {
    throw new TypeError(`Invalid axis “${axis}”`);
  }

  return axis;
}