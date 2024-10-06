/**
 * @typedef {{[string]: integer}} UnitMap
 * @typedef {[number, UnitMap]} SumValueItem
 * @typedef {SumValueItem[]} SumValue
 * @typedef {null} Failure
 * @typedef {{[string]: integer} & {percentHint: string | undefined}} Type
 * @typedef {{type: 'ADDITION'}|{type: 'MULTIPLICATION'}|{type: 'NEGATE'}|{type: 'INVERT'}} ASTNode
 */

const failure = null;
const baseTypes = ["percent", "length", "angle", "time", "frequency", "resolution", "flex"];

const unitGroups = {
  // https://www.w3.org/TR/css-values-4/#font-relative-lengths
  fontRelativeLengths: {
    units: new Set(["em", "rem", "ex", "rex", "cap", "rcap", "ch", "rch", "ic", "ric", "lh", "rlh"])
  },
  // https://www.w3.org/TR/css-values-4/#viewport-relative-lengths
  viewportRelativeLengths: {
    units: new Set(
      ["vw", "lvw", "svw", "dvw", "vh", "lvh", "svh", "dvh", "vi", "lvi", "svi", "dvi", "vb", "lvb", "svb", "dvb",
        "vmin", "lvmin", "svmin", "dvmin", "vmax", "lvmax", "svmax", "dvmax"])
  },
  // https://www.w3.org/TR/css-values-4/#absolute-lengths
  absoluteLengths: {
    units: new Set(["cm", "mm", "Q", "in", "pt", "pc", "px"]),
    compatible: true,
    canonicalUnit: "px",
    ratios: {
      "cm": 96 / 2.54, "mm": (96 / 2.54) / 10, "Q": (96 / 2.54) / 40, "in": 96, "pc": 96 / 6, "pt": 96 / 72, "px": 1
    }
  },
  // https://www.w3.org/TR/css-values-4/#angles
  angle: {
    units: new Set(["deg", "grad", "rad", "turn"]),
    compatible: true,
    canonicalUnit: "deg",
    ratios: {
      "deg": 1, "grad": 360 / 400, "rad": 180 / Math.PI, "turn": 360
    }
  },
  // https://www.w3.org/TR/css-values-4/#time
  time: {
    units: new Set(["s", "ms"]),
    compatible: true,
    canonicalUnit: "s",
    ratios: {
      "s": 1, "ms": 1 / 1000
    }
  },
  // https://www.w3.org/TR/css-values-4/#frequency
  frequency: {
    units: new Set(["hz", "khz"]),
    compatible: true,
    canonicalUnit: "hz",
    ratios: {
      "hz": 1, "khz": 1000
    }
  },
  // https://www.w3.org/TR/css-values-4/#resolution
  resolution: {
    units: new Set(["dpi", "dpcm", "dppx"]),
    compatible: true,
    canonicalUnit: "dppx",
    ratios: {
      "dpi": 1 / 96, "dpcm": 2.54 / 96, "dppx": 1
    }
  }
};

const unitToCompatibleUnitsMap = new Map();
for (const group of Object.values(unitGroups)) {
  if (!group.compatible) {
    continue;
  }
  for (const unit of group.units) {
    unitToCompatibleUnitsMap.set(unit, group);
  }
}

export function getSetOfCompatibleUnits(unit) {
  return unitToCompatibleUnitsMap.get(unit);
}

/**
 * Implementation of `product of two unit maps` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#product-of-two-unit-maps
 *
 * @param {UnitMap} units1 map of units (strings) to powers (integers)
 * @param {UnitMap} units2 map of units (strings) to powers (integers)
 * @return {UnitMap} map of units (strings) to powers (integers)
 */
function productOfTwoUnitMaps(units1, units2) {
  // 1. Let result be a copy of units1.
  const result = {...units1};
  // 2. For each unit → power in units2:
  for (const unit of Object.keys(units2)) {
    if (result[unit]) {
      // 1. If result[unit] exists, increment result[unit] by power.
      result[unit] += units2[unit];
    } else {
      // 2. Otherwise, set result[unit] to power.
      result[unit] = units2[unit];
    }
  }
  // 3. Return result.
  return result;
}

/**
 * Implementation of `create a type` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#create-a-type
 *
 * @param {string} unit
 * @return {Type|Failure}
 */
export function createAType(unit) {
  if (unit === "number") {
    return {};
  } else if (unit === "percent") {
    return {"percent": 1};
  } else if (unitGroups.absoluteLengths.units.has(unit) || unitGroups.fontRelativeLengths.units.has(unit) ||
    unitGroups.viewportRelativeLengths.units.has(unit)) {
    return {"length": 1};
  } else if (unitGroups.angle.units.has(unit)) {
    return {"angle": 1};
  } else if (unitGroups.time.units.has(unit)) {
    return {"time": 1};
  } else if (unitGroups.frequency.units.has(unit)) {
    return {"frequency": 1};
  } else if (unitGroups.resolution.units.has(unit)) {
    return {"resolution": 1};
  } else if (unit === "fr") {
    return {"flex": 1};
  } else {
    return failure;
  }
}

/**
 * Partial implementation of `create a sum value` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#create-a-sum-value
 *
 * Supports CSSUnitValue, CSSMathProduct and CSSMathInvert with a CSSUnitValue value.
 * Other types are not supported, and will throw an error.
 *
 * @param {CSSNumericValue} cssNumericValue
 * @return {SumValue} Abstract representation of a CSSNumericValue as a sum of numbers with (possibly complex) units
 */
export function createSumValue(cssNumericValue) {
  if (cssNumericValue instanceof CSSUnitValue) {
    let {unit, value} = cssNumericValue;
    // Let unit be the value of this’s unit internal slot, and value be the value of this’s value internal slot.
    // If unit is a member of a set of compatible units, and is not the set’s canonical unit,
    // multiply value by the conversion ratio between unit and the canonical unit, and change unit to the canonical unit.
    const compatibleUnits = getSetOfCompatibleUnits(cssNumericValue.unit);
    if (compatibleUnits && unit !== compatibleUnits.canonicalUnit) {
      value *= compatibleUnits.ratios[unit];
      unit = compatibleUnits.canonicalUnit;
    }

    if (unit === "number") {
      // If unit is "number", return «(value, «[ ]»)».
      return [[value, {}]];
    } else {
      // Otherwise, return «(value, «[unit → 1]»)».
      return [[value, {[unit]: 1}]];
    }
  } else if (cssNumericValue instanceof CSSMathInvert) {
    if (!(cssNumericValue.value instanceof CSSUnitValue)) {
      // Limit implementation to CSSMathInvert of CSSUnitValue
      throw new Error("Not implemented");
    }
    // 1. Let values be the result of creating a sum value from this’s value internal slot.
    const values = createSumValue(cssNumericValue.value);
    // 2. If values is failure, return failure.
    if (values === failure) {
      return failure;
    }
    // 3. If the length of values is more than one, return failure.
    if (values.length > 1) {
      return failure;
    }
    // 4. Invert (find the reciprocal of) the value of the item in values, and negate the value of each entry in its unit map.
    const item = values[0];
    const tempUnionMap = {};
    for (const [unit, power] of Object.entries(item[1])) {
      tempUnionMap[unit] = -1 * power;
    }
    values[0] = [1 / item[0], tempUnionMap];

    // 5. Return values.
    return values;
  } else if (cssNumericValue instanceof CSSMathProduct) {
    // 1. Let values initially be the sum value «(1, «[ ]»)». (I.e. what you’d get from 1.)

    let values = [[1, {}]];

    // 2. For each item in this’s values internal slot:
    for (const item of cssNumericValue.values) {
      // 1. Let new values be the result of creating a sum value from item. Let temp initially be an empty list.
      const newValues = createSumValue(item);
      const temp = [];
      // 2. If new values is failure, return failure.
      if (newValues === failure) {
        return failure;
      }
      // 3. For each item1 in values:
      for (const item1 of values) {
        // 1. For each item2 in new values:
        for (const item2 of newValues) {
          // 1. Let item be a tuple with its value set to the product of the values of item1 and item2, and its unit
          //    map set to the product of the unit maps of item1 and item2, with all entries with a zero value removed.
          // 2. Append item to temp.
          temp.push([item1[0] * item2[0], productOfTwoUnitMaps(item1[1], item2[1])]);
        }
      }
      // 4. Set values to temp.
      values = temp;
    }
    // Return values.
    return values;
  } else {
    throw new Error("Not implemented");
  }
}


/**
 * Implementation of `to(unit)` for CSSNumericValue from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#dom-cssnumericvalue-to
 *
 * Converts an existing CSSNumeric value into another with the specified unit, if possible.
 *
 * @param {CSSNumericValue} cssNumericValue value to convert
 * @param {string} unit
 * @return {CSSUnitValue}
 */
export function to(cssNumericValue, unit) {
  // Let type be the result of creating a type from unit. If type is failure, throw a SyntaxError.
  const type = createAType(unit);
  if (type === failure) {
    throw new SyntaxError("The string did not match the expected pattern.");
  }

  // Let sum be the result of creating a sum value from this.
  const sumValue = createSumValue(cssNumericValue);

  // If sum is failure, throw a TypeError.
  if (!sumValue) {
    throw new TypeError();
  }

  // If sum has more than one item, throw a TypeError.
  if (sumValue.length > 1) {
    throw new TypeError("Sum has more than one item");
  }

  // Otherwise, let item be the result of creating a CSSUnitValue
  // from the sole item in sum, then converting it to unit.
  const item = convertCSSUnitValue(createCSSUnitValue(sumValue[0]), unit);


  // If item is failure, throw a TypeError.
  if (item === failure) {
    throw new TypeError();
  }
  // Return item.
  return item;
}

/**
 * Implementation of `create a CSSUnitValue from a sum value item` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#create-a-cssunitvalue-from-a-sum-value-item
 *
 * @param {SumValueItem} sumValueItem  a tuple of a value, and a unit map
 * @return {CSSUnitValue|Failure}
 */
export function createCSSUnitValue(sumValueItem) {
  const [value, unitMap] = sumValueItem;
  // When asked to create a CSSUnitValue from a sum value item item, perform the following steps:
  // If item has more than one entry in its unit map, return failure.
  const entries = Object.entries(unitMap);
  if (entries.length > 1) {
    return failure;
  }
  // If item has no entries in its unit map, return a new CSSUnitValue whose unit internal slot is set to "number",
  // and whose value internal slot is set to item’s value.
  if (entries.length === 0) {
    return new CSSUnitValue(value, "number");
  }
  // Otherwise, item has a single entry in its unit map. If that entry’s value is anything other than 1, return failure.
  const entry = entries[0];
  if (entry[1] !== 1) {
    return failure;
  }
  // Otherwise, return a new CSSUnitValue whose unit internal slot is set to that entry’s key, and whose value internal slot is set to item’s value.
  else {
    return new CSSUnitValue(value, entry[0]);
  }
}

/**
 * Implementation of `convert a CSSUnitValue` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#convert-a-cssunitvalue

 * @param {CSSUnitValue} cssUnitValue
 * @param {string} unit
 * @return {CSSUnitValue|Failure}
 */
export function convertCSSUnitValue(cssUnitValue, unit) {
  // Let old unit be the value of this’s unit internal slot, and old value be the value of this’s value internal slot.
  const oldUnit = cssUnitValue.unit;
  const oldValue = cssUnitValue.value;
  // If old unit and unit are not compatible units, return failure.
  const oldCompatibleUnitGroup = getSetOfCompatibleUnits(oldUnit);
  const compatibleUnitGroup = getSetOfCompatibleUnits(unit);
  if (!compatibleUnitGroup || oldCompatibleUnitGroup !== compatibleUnitGroup) {
    return failure;
  }
  // Return a new CSSUnitValue whose unit internal slot is set to unit, and whose value internal slot is set to
  // old value multiplied by the conversation ratio between old unit and unit.
  return new CSSUnitValue(oldValue * compatibleUnitGroup.ratios[oldUnit] / compatibleUnitGroup.ratios[unit], unit);
}

/**
 * Partial implementation of `toSum(...units)`:
 * https://www.w3.org/TR/css-typed-om-1/#dom-cssnumericvalue-tosum
 *
 * The implementation is restricted to conversion without units.
 * It simplifies a CSSNumericValue into a minimal sum of CSSUnitValues.
 * Will throw an error if called with units.
 *
 * @param {CSSNumericValue} cssNumericValue value to convert to a CSSMathSum
 * @param {string[]} units Not supported in this implementation
 * @return {CSSMathSum}
 */
export function toSum(cssNumericValue, ...units) {
  // The toSum(...units) method converts an existing CSSNumericValue this into a CSSMathSum of only CSSUnitValues
  // with the specified units, if possible. (It’s like to(), but allows the result to have multiple units in it.)
  // If called without any units, it just simplifies this into a minimal sum of CSSUnitValues.
  // When called, it must perform the following steps:
  //
  // For each unit in units, if the result of creating a type from unit is failure, throw a SyntaxError.
  //
  if (units && units.length) {
    // Only unitless method calls are implemented in this polyfill
    throw new Error("Not implemented");
  }

  // Let sum be the result of creating a sum value from this. If sum is failure, throw a TypeError.
  const sum = createSumValue(cssNumericValue);

  // Let values be the result of creating a CSSUnitValue for each item in sum. If any item of values is failure,
  // throw a TypeError.
  const values = sum.map(item => createCSSUnitValue(item));
  if (values.some(value => value === failure)) {
    throw new TypeError("Type error");
  }

  // If units is empty, sort values in code point order according to the unit internal slot of its items,
  // then return a new CSSMathSum object whose values internal slot is set to values.
  return new CSSMathSum(...values);
}

/**
 * Implementation of `invert a type` from css-typed-om-1 Editors Draft:
 * https://drafts.css-houdini.org/css-typed-om/
 *
 * @param {Type} type
 * @return {Type}
 */
export function invertType(type) {
  // To invert a type type, perform the following steps:
  // Let result be a new type with an initially empty ordered map and an initially null percent hint
  // For each unit → exponent of type, set result[unit] to (-1 * exponent).
  // Return result.
  const result = {};
  for (const baseType of baseTypes) {
    result[baseType] = -1 * type[baseType];
  }
  return result;
}

/**
 * Implementation of `multiply two types` from css-typed-om-1 Editor's Draft:
 * https://drafts.css-houdini.org/css-typed-om/#cssnumericvalue-multiply-two-types
 *
 * @param {Type} type1 a map of base types to integers and an associated percent hint
 * @param {Type} type2 a map of base types to integers and an associated percent hint
 * @return {Type|Failure}
 */
export function multiplyTypes(type1, type2) {
  if (type1.percentHint && type2.percentHint && type1.percentHint !== type2.percentHint) {
    return failure;
  }
  const finalType = {
    ...type1, percentHint: type1.percentHint ?? type2.percentHint,
  };

  for (const baseType of baseTypes) {
    if (!type2[baseType]) {
      continue;
    }
    finalType[baseType] ??= 0;
    finalType[baseType] += type2[baseType];
  }
  return finalType;
}