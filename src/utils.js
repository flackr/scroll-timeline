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

/**
 * Split an input string into a list of individual component value strings,
 * so that each can be handled as a keyword or parsed with `CSSNumericValue.parse()`;
 *
 * Examples:
 * splitIntoComponentValues('cover'); // ['cover']
 * splitIntoComponentValues('auto 0%'); // ['auto', '100%']
 * splitIntoComponentValues('calc(0% + 50px) calc(100% - 50px)'); // ['calc(0% + 50px)', 'calc(100% - 50px)']
 * splitIntoComponentValues('1px 2px').map(val => CSSNumericValue.parse(val)) // [new CSSUnitValue(1, 'px'), new CSSUnitValue(2, 'px')]
 *
 * @param {string} input
 * @return {string[]}
 */
export function splitIntoComponentValues(input) {
  const res = [];
  let i = 0;

  function consumeComponentValue() {
    let level = 0;
    const startIndex = i;
    while (i < input.length) {
      const nextChar = input.slice(i, i + 1);
      if (/\s/.test(nextChar) && level === 0) {
        break;
      } else if (nextChar === '(') {
        level += 1;
      } else if (nextChar === ')') {
        level -= 1;
        if (level === 0) {
          // Consume the next character and break
          i++;
          break;
        }
      }
      i++;
    }
    return input.slice(startIndex, i);
  }

  function consumeWhitespace() {
    while (/\s/.test(input.slice(i, i + 1))) {
      i++;
    }
  }

  while(i < input.length) {
    const nextChar = input.slice(i, i + 1);
    if (/\s/.test(nextChar)) {
      consumeWhitespace();
    } else {
      res.push(consumeComponentValue());
    }
  }
  return res;
}