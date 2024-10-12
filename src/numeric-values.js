import {
  CommaToken,
  DelimToken,
  DimensionToken,
  FunctionToken, IdentToken,
  LeftCurlyBracketToken,
  LeftParenthesisToken,
  LeftSquareBracketToken,
  NumberToken,
  PercentageToken, RightCurlyBracketToken,
  RightParenthesisToken, RightSquareBracketToken,
  Token,
  tokenizeString,
  WhitespaceToken
} from './tokenizer';
import {simplifyCalculation} from './simplify-calculation';

/**
 * @typedef {{[string]: integer}} UnitMap
 * @typedef {[number, UnitMap]} SumValueItem
 * @typedef {SumValueItem[]} SumValue
 * @typedef {null} Failure
 * @typedef {{[string]: integer} & {percentHint: string | undefined}} CSSNumericType
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
    units: new Set(["cm", "mm", "q", "in", "pt", "pc", "px"]),
    compatible: true,
    canonicalUnit: "px",
    ratios: {
      "cm": 96 / 2.54, "mm": (96 / 2.54) / 10, "q": (96 / 2.54) / 40, "in": 96, "pc": 96 / 6, "pt": 96 / 72, "px": 1
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
 * Perform the steps necessary for converting a type
 * to a result that can be returned from `type()`
 * https://www.w3.org/TR/css-typed-om-1/#dom-cssnumericvalue-type
 *
 * @param {CSSNumericType} type
 * return {CSSNumericType}
 */
export function rectifyType(type) {
  // 1. Let result be a new CSSNumericType.
  const result = {};

  // 2. For each baseType → power in the type of this,
  for (const baseType of baseTypes) {
    // 2. 1. If power is not 0, set result[baseType] to power.
    if (type[baseType]) {
      result[baseType] = type[baseType];
    }
  }

  // 3. If the percent hint of this is not null,
  if (type.percentHint) {
    // 3. 1. Set percentHint to the percent hint of this.
    result.percentHint = type.percentHint;
  }

  // 4. Return result.
  return result;
}

/**
 * Implementation of `create a type` from css-typed-om-1:
 * https://www.w3.org/TR/css-typed-om-1/#create-a-type
 *
 * @param {string} unit
 * @return {CSSNumericType|Failure}
 */
export function createAType(unit) {
  const unitLowerCase = unit.toLowerCase();
  // Number and percent unit is specced to be lower case.
  // https://drafts.css-houdini.org/css-typed-om-1/#cssnumericvalue-create-a-type
  if (unit === "number") {
    return {};
  } else if (unit === "percent") {
    return {"percent": 1};
  } else if (unitGroups.absoluteLengths.units.has(unitLowerCase) ||
    unitGroups.fontRelativeLengths.units.has(unitLowerCase) ||
    unitGroups.viewportRelativeLengths.units.has(unitLowerCase)) {
    return {"length": 1};
  } else if (unitGroups.angle.units.has(unitLowerCase)) {
    return {"angle": 1};
  } else if (unitGroups.time.units.has(unitLowerCase)) {
    return {"time": 1};
  } else if (unitGroups.frequency.units.has(unitLowerCase)) {
    return {"frequency": 1};
  } else if (unitGroups.resolution.units.has(unitLowerCase)) {
    return {"resolution": 1};
  } else if (unitLowerCase === "fr") {
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
 * @param {CSSNumericType} type
 * @return {CSSNumericType}
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
 * Implementation of `apply the percent hint` from css-typed-om-1 Editor's Draft:
 * https://drafts.css-houdini.org/css-typed-om/#apply-the-percent-hint
 * @param {CSSNumericType} type
 * @param {string} hint
 */
function applyPercentHint(type, hint) {
  // 1. If type doesn’t contain hint, set type[hint] to 0.
  type[hint] ??= 0;

  // 2. If type contains "percent", add type["percent"] to type[hint], then set type["percent"] to 0.
  if (type.percent) {
    type[hint] += type.percent;
    type.percent = 0;
  }

  // 3. Set type’s percent hint to hint.
  type.percentHint = hint;
}

/**
 * Implementation of `add two types` from css-typed-om-1 Editor's Draft:
 * https://drafts.css-houdini.org/css-typed-om/#cssnumericvalue-add-two-types
 *
 * @param {CSSNumericType} input1
 * @param {CSSNumericType} input2
 * @return {CSSNumericType|Failure}
 */
export function addTypes(input1, input2) {
  // 1  Replace type1 with a fresh copy of type1, and type2 with a fresh copy of type2. Let finalType be a new
  //    type with an initially empty ordered map and an initially null percent hint.
  const type1 = {...input1};
  const type2 = {...input2};

  // 2a If both type1 and type2 have non-null percent hints with different values
  //    The types can’t be added. Return failure.
  if (type1.percentHint && type2.percentHint && type1.percentHint !== type2.percentHint) {
    return failure;
  }

  // 2b If type1 has a non-null percent hint hint and type2 doesn’t
  //      Apply the percent hint hint to type2.
  //
  //      Vice versa if type2 has a non-null percent hint and type1 doesn’t.
  if (type1.percentHint && !type2.percentHint) {
    applyPercentHint(type2, type1.percentHint);
  }
  if (type2.percentHint && !type1.percentHint) {
    applyPercentHint(type1, type2.percentHint);
  }

  // 2c Otherwise
  //      Continue to the next step.

  // 3a If all the entries of type1 with non-zero values are contained in type2 with the same value, and vice-versa
  //      Copy all of type1’s entries to finalType, and then copy all of type2’s entries to finalType that
  //      finalType doesn’t already contain. Set finalType’s percent hint to type1’s percent hint. Return finalType.
  if (baseTypes
    .filter(baseType=> type1[baseType] || type2[baseType])
    .every(baseType => type1[baseType] === type2[baseType])) {
    return {
      ...type2,
      ...type1,
      percentHint: type1.percentHint
    };
  }

  // 3b If type1 and/or type2 contain "percent" with a non-zero value, and type1 and/or type2 contain a key
  //    other than "percent" with a non-zero value
  const hasNonPercentValue = baseTypes
    .filter(baseType => baseType !== 'percent')
    .some(baseType => type1[baseType] || type2[baseType]);

  if ((type1.percent || type2.percent) && hasNonPercentValue) {
    // For each base type other than "percent" hint:
    for (const hint of baseTypes.filter(baseType => baseType !== 'percent')) {
      const tempType1 = {...type1};
      const tempType2 = {...type2};

      // Provisionally apply the percent hint hint to both type1 and type2.
      applyPercentHint(tempType1, hint);
      applyPercentHint(tempType2, hint);

      // If, afterwards, all the entries of type1 with non-zero values are contained in type2 with the same value,
      // and vice versa, then copy all of type1’s entries to finalType, and then copy all of type2’s entries to
      // finalType that finalType doesn’t already contain. Set finalType’s percent hint to hint. Return finalType.
      if (baseTypes
        .filter(baseType => tempType1[baseType] || tempType2[baseType])
        .every(baseType => tempType1[baseType] === tempType2[baseType])) {
        return {
          ...tempType2,
          ...tempType1,
          percentHint: hint
        };
      }
      // Otherwise, revert type1 and type2 to their state at the start of this loop.
    }
  }
  // 3c Otherwise
  //      The types can’t be added. Return failure.
  return failure;
}

/**
 * Implementation of `multiply two types` from css-typed-om-1 Editor's Draft:
 * https://drafts.css-houdini.org/css-typed-om/#cssnumericvalue-multiply-two-types
 *
 * @param {CSSNumericType} type1 a map of base types to integers and an associated percent hint
 * @param {CSSNumericType} type2 a map of base types to integers and an associated percent hint
 * @return {CSSNumericType|Failure}
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

class CSSFunction {
  name;
  values;
  constructor(name, values) {
    this.name = name;
    this.values = values;
  }
}

class CSSSimpleBlock {
  value;
  associatedToken;
  constructor(value, associatedToken) {
    this.value = value;
    this.associatedToken = associatedToken;
  }
}

/**
 * Normalize into a token stream
 * https://www.w3.org/TR/css-syntax-3/#normalize-into-a-token-stream
 */
function normalizeIntoTokenStream(input) {
  // If input is a list of CSS tokens, return input.
  // If input is a list of CSS component values, return input.
  if (Array.isArray(input)) {
    return input;
  }
  // If input is a string, then filter code points from input, tokenize the result, and return the final result.
  if (typeof input === 'string') {
    return tokenizeString(input);
  }
  // Assert: Only the preceding types should be passed as input.
  throw new TypeError(`Invalid input type ${typeof input}`)
}

/**
 * Consume a function
 * https://www.w3.org/TR/css-syntax-3/#consume-a-function
 * @param {FunctionToken} token
 * @param {Token[]} tokens
 */
function consumeFunction(token, tokens) {
  // Create a function with its name equal to the value of the current input token and with its value initially set to an empty list.
  const func = new CSSFunction(token.value, []);

  // Repeatedly consume the next input token and process it as follows:
  while(true) {
    const nextToken = tokens.shift();
    if (nextToken instanceof RightParenthesisToken) {
      // <)-token>
      // Return the function.
      return func;
    } else if (typeof nextToken === 'undefined') {
      // <EOF-token>
      // This is a parse error. Return the function.
      return func;
    } else {
      // anything else
      // Reconsume the current input token. Consume a component value and append the returned value to the function’s value.
      tokens.unshift(nextToken);
      func.values.push(consumeComponentValue(tokens));
    }
  }
}

/**
 * Consume a simple block
 * https://www.w3.org/TR/css-syntax-3/#consume-simple-block
 * @param {Token[]} tokens
 * @param {LeftCurlyBracketToken | LeftParenthesisToken | LeftSquareBracketToken} currentInputToken
 */
function consumeSimpleBlock(tokens, currentInputToken) {
  // The ending token is the mirror variant of the current input token. (E.g. if it was called with <[-token>, the ending token is <]-token>.)
  let endingTokenConstructor ;
  if (currentInputToken instanceof LeftCurlyBracketToken) {
    endingTokenConstructor = RightCurlyBracketToken;
  } else if (currentInputToken instanceof LeftParenthesisToken) {
    endingTokenConstructor = RightParenthesisToken;
  } else if (currentInputToken instanceof LeftSquareBracketToken) {
    endingTokenConstructor = RightSquareBracketToken;
  } else {
    return undefined;
  }


  // Create a simple block with its associated token set to the current input token and with its value initially set to an empty list.
  const simpleBlock = new CSSSimpleBlock([], currentInputToken);

  // Repeatedly consume the next input token and process it as follows:
  while (true) {
    const token = tokens.shift();
    if (token instanceof endingTokenConstructor) {
      // ending token
      // Return the block.
      return simpleBlock;
    } else if (typeof token === 'undefined') {
      // <EOF-token>
      // This is a parse error. Return the block.
      return simpleBlock;
    } else {
      // anything else
      // Reconsume the current input token. Consume a component value and append it to the value of the block.
      tokens.unshift(token);
      simpleBlock.value.push(consumeComponentValue(tokens));
    }
  }
}

/**
 * Consume a component value
 * https://www.w3.org/TR/css-syntax-3/#consume-a-component-value
 * @param {Token[]} tokens
 */
function consumeComponentValue(tokens) {
  const syntaxError = null;
  // Consume the next input token.
  const token = tokens.shift();

  if (token instanceof LeftCurlyBracketToken || token instanceof LeftSquareBracketToken || token instanceof LeftParenthesisToken) {
    // If the current input token is a <{-token>, <[-token>, or <(-token>, consume a simple block and return it.
    return consumeSimpleBlock(tokens, token);
  } else if (token instanceof FunctionToken) {
    // Otherwise, if the current input token is a <function-token>, consume a function and return it.
    return consumeFunction(token, tokens);
  } else {
    // Otherwise, return the current input token.
    return token;
  }
}

/**
 * Parse a component value
 * https://www.w3.org/TR/css-syntax-3/#parse-component-value
 * @param {string} input
 */
function parseComponentValue(input) {
  const syntaxError = null;
  // To parse a component value from input:
  // 1. Normalize input, and set input to the result.
  const tokens = normalizeIntoTokenStream(input);

  // 2. While the next input token from input is a <whitespace-token>, consume the next input token from input.
  while (tokens[0] instanceof WhitespaceToken) {
    tokens.shift();
  }
  // 3. If the next input token from input is an <EOF-token>, return a syntax error.
  if (typeof tokens[0] === 'undefined') {
    return syntaxError;
  }
  // 4. Consume a component value from input and let value be the return value.
  const returnValue = consumeComponentValue(tokens);
  // 5. While the next input token from input is a <whitespace-token>, consume the next input token.
  while (tokens[0] instanceof WhitespaceToken) {
    tokens.shift();
  }
  // 6. If the next input token from input is an <EOF-token>, return value. Otherwise, return a syntax error.
  if (typeof tokens[0] === 'undefined') {
    return returnValue;
  } else {
    return syntaxError;
  }
}

function precedence(token) {
  if (token instanceof LeftParenthesisToken || token instanceof RightParenthesisToken) {
    return 6;
  } else if (token instanceof DelimToken) {
    const value = token.value;
    switch (value) {
      case '*':
        return 4;
      case '/':
        return 4;
      case '+':
        return 2;
      case '-':
        return 2;
    }
  }
}


function last(items) {
  return items[items.length - 1];
}

function toNAryAstNode(operatorToken, first, second) {
  // Treat subtraction as instead being addition, with the RHS argument instead wrapped in a special "negate" node.
  // Treat division as instead being multiplication, with the RHS argument instead wrapped in a special "invert" node.

  const type = ['+','-'].includes(operatorToken.value) ? 'ADDITION' : 'MULTIPLICATION';
  const firstValues = first.type === type ? first.values : [first];
  const secondValues = second.type === type ? second.values : [second];

  if (operatorToken.value === '-') {
    secondValues[0] = {type: 'NEGATE', value: secondValues[0]};
  } else if (operatorToken.value   === '/') {
    secondValues[0] = {type: 'INVERT', value: secondValues[0]};
  }
  return {type, values: [...firstValues, ...secondValues]};
}

/**
 * Convert expression to AST using the Shunting Yard Algorithm
 * https://en.wikipedia.org/wiki/Shunting_yard_algorithm
 * @param {(Token | CSSFunction)[]} tokens
 * @return {null}
 */
function convertTokensToAST(tokens) {
  const operatorStack = [];
  const tree = [];
  while (tokens.length) {
    const token = tokens.shift();
    if (token instanceof NumberToken || token instanceof DimensionToken || token instanceof PercentageToken ||
      token instanceof CSSFunction || token instanceof CSSSimpleBlock || token instanceof IdentToken) {
      tree.push(token);
    } else if (token instanceof DelimToken && ['*', '/', '+', '-'].includes(token.value)) {
      while (operatorStack.length &&
      !(last(operatorStack) instanceof LeftParenthesisToken) &&
      precedence(last(operatorStack)) > precedence(token)) {
        const o2 = operatorStack.pop();
        const second = tree.pop();
        const first = tree.pop();
        tree.push(toNAryAstNode(o2, first, second));
      }
      operatorStack.push(token);
    } else if (token instanceof LeftParenthesisToken) {
      operatorStack.push(token);
    } else if (token instanceof RightParenthesisToken) {
      if (!operatorStack.length) {
        return null;
      }
      while (!(last(operatorStack) instanceof LeftParenthesisToken) ) {
        const o2 = operatorStack.pop();
        const second = tree.pop();
        const first = tree.pop();
        tree.push(toNAryAstNode(o2, first, second));
      }
      if (!(last(operatorStack) instanceof LeftParenthesisToken)) {
        return null;
      }
      operatorStack.pop();
    } else if (token instanceof WhitespaceToken) {
      // Consume token
    } else {
      return null;
    }
  }
  while(operatorStack.length) {
    if (last(operatorStack) instanceof LeftParenthesisToken) {
      return null;
    }
    const o2 = operatorStack.pop()
    const second = tree.pop();
    const first = tree.pop();
    tree.push(toNAryAstNode(o2, first, second));
  }
  return tree[0];
}

/**
 * Step 4 of `reify a math expression`
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-math-expression
 *
 * 4. Recursively transform the expression tree into objects, as follows:
 *
 * @param {ASTNode} node
 * @return {CSSMathNegate|CSSMathProduct|CSSMathMin|CSSMathMax|CSSMathSum|CSSNumericValue|CSSUnitValue|CSSMathInvert}
 */
function transformToCSSNumericValue(node) {
  if (node.type === 'ADDITION') {
    // addition node
    // becomes a new CSSMathSum object, with its values internal slot set to its list of arguments
    return new CSSMathSum(...node.values.map(value => transformToCSSNumericValue(value)));
  } else if (node.type === 'MULTIPLICATION') {
    // multiplication node
    // becomes a new CSSMathProduct object, with its values internal slot set to its list of arguments
    return new CSSMathProduct(...node.values.map(value => transformToCSSNumericValue(value)));
  } else  if (node.type === 'NEGATE') {
    // negate node
    // becomes a new CSSMathNegate object, with its value internal slot set to its argument
    return new CSSMathNegate(transformToCSSNumericValue(node.value));
  } else if (node.type === 'INVERT') {
    // invert node
    // becomes a new CSSMathInvert object, with its value internal slot set to its argument
    return new CSSMathInvert(transformToCSSNumericValue(node.value));
  } else {
    // leaf node
    // reified as appropriate
    if (node instanceof CSSSimpleBlock) {
      return reifyMathExpression(new CSSFunction('calc', node.value));
    } else if (node instanceof IdentToken) {
      if (node.value === 'e') {
        return new CSSUnitValue(Math.E, 'number');
      } else if (node.value === 'pi') {
        return new CSSUnitValue(Math.PI, 'number');
      } else {
        throw new SyntaxError('Invalid math expression')
      }
    } else {
      return reifyNumericValue(node);
    }
  }
}

/**
 * Reify a math expression
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-math-expression
 * @param {CSSFunction} num
 */
function reifyMathExpression(num) {
  // TODO: handle `clamp()` and possibly other math functions
  // 1. If num is a min() or max() expression:
  if (num.name === 'min' || num.name === 'max')
  {
    // Let values be the result of reifying the arguments to the expression, treating each argument as if it were the contents of a calc() expression.
    const values = num.values
      .filter(value => !(value instanceof WhitespaceToken || value instanceof CommaToken))
      // TODO: Update when we have clarification on where simplify a calculation should be run:
      // https://github.com/w3c/csswg-drafts/issues/9870
      .map(value => simplifyCalculation(reifyMathExpression(new CSSFunction('calc', value))));
    // Return a new CSSMathMin or CSSMathMax object, respectively, with its values internal slot set to values.
    return num.name === 'min' ? new CSSMathMin(...values) : new CSSMathMax(...values);
  }

  // 2. Assert: Otherwise, num is a calc().
  if (num.name !== 'calc') {
    return null;
  }

  // 3. Turn num’s argument into an expression tree using standard PEMDAS precedence rules, with the following exceptions/clarification:
  //
  // Treat subtraction as instead being addition, with the RHS argument instead wrapped in a special "negate" node.
  // Treat division as instead being multiplication, with the RHS argument instead wrapped in a special "invert" node.
  // Addition and multiplication are N-ary; each node can have any number of arguments.
  // If an expression has only a single value in it, and no operation, treat it as an addition node with the single argument.
  const root = convertTokensToAST([...num.values]);
  
  // 4. Recursively transform the expression tree into objects
  const numericValue = transformToCSSNumericValue(root);
  let simplifiedValue;
  try {
    // TODO: Update when we have clarification on where simplify a calculation should be run:
    // https://github.com/w3c/csswg-drafts/issues/9870
    simplifiedValue = simplifyCalculation(numericValue);
  } catch (e) {
    // Use insertRule to trigger native SyntaxError on TypeError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  if (simplifiedValue instanceof CSSUnitValue) {
    return new CSSMathSum(simplifiedValue);
  } else {
    return simplifiedValue;
  }
}

/**
 * Reify a numeric value
 * https://drafts.css-houdini.org/css-typed-om/#reify-a-numeric-value
 * @param num
 */
function reifyNumericValue(num) {
  // If an internal representation contains a var() reference, then it is reified by reifying a list of component values,
  // regardless of what property it is for.
  // TODO: handle `var()` function

  // If num is a math function, reify a math expression from num and return the result.
  if (num instanceof CSSFunction && ['calc', 'min', 'max', 'clamp'].includes(num.name)) {
    return reifyMathExpression(num);
  }
  // If num is the unitless value 0 and num is a <dimension>,
  // return a new CSSUnitValue with its value internal slot set to 0, and its unit internal slot set to "px".
  if (num instanceof NumberToken && num.value === 0 && !num.unit) {
    return new CSSUnitValue(0, 'px');
  }
  // Return a new CSSUnitValue with its value internal slot set to the numeric value of num, and its unit internal slot
  // set to "number" if num is a <number>, "percent" if num is a <percentage>, and num’s unit if num is a <dimension>.
  if (num instanceof NumberToken) {
    return new CSSUnitValue(num.value, 'number');
  } else if (num instanceof PercentageToken) {
    return new CSSUnitValue(num.value, 'percent');
  } else if (num instanceof DimensionToken) {
    return new CSSUnitValue(num.value, num.unit);
  }
}

/**
 * Implementation of the parse(cssText) method.
 * https://drafts.css-houdini.org/css-typed-om-1/#dom-cssnumericvalue-parse
 * @param {string} cssText
 * @return {CSSMathMin|CSSMathMax|CSSMathSum|CSSMathProduct|CSSMathNegate|CSSMathInvert|CSSUnitValue}
 */
export function parseCSSNumericValue(cssText) {
  // Parse a component value from cssText and let result be the result.
  // If result is a syntax error, throw a SyntaxError and abort this algorithm.
  const result = parseComponentValue(cssText);
  if (result === null) {
    // Use insertRule to trigger native SyntaxError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  // If result is not a <number-token>, <percentage-token>, <dimension-token>, or a math function, throw a SyntaxError and abort this algorithm.
  if (!(result instanceof NumberToken || result instanceof PercentageToken || result instanceof DimensionToken || result instanceof CSSFunction)) {
    // Use insertRule to trigger native SyntaxError
    (new CSSStyleSheet()).insertRule('error', 0);
  }
  // If result is a <dimension-token> and creating a type from result’s unit returns failure, throw a SyntaxError and abort this algorithm.
  if (result instanceof DimensionToken) {
    const type = createAType(result.unit);
    if (type === null) {
      // Use insertRule to trigger native SyntaxError
      (new CSSStyleSheet()).insertRule('error', 0);
    }
  }
  // Reify a numeric value result, and return the result.
  return reifyNumericValue(result);
}