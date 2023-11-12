// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { createAType, invertType, multiplyTypes, to, toSum } from "./numeric-values";
import { simplifyCalculation } from "./simplify-calculation";

export function installCSSOM() {
  // Object for storing details associated with an object which are to be kept
  // private. This approach allows the constructed objects to more closely
  // resemble their native counterparts when inspected.
  let privateDetails = new WeakMap();

  function displayUnit(unit) {
    switch(unit) {
      case 'percent':
        return '%';
      case 'number':
        return '';
      default:
        return unit.toLowerCase();
    }
  }

  function toCssUnitValue(v) {
    if (typeof v === 'number')
      return new CSSUnitValue(v, 'number');
    return v;
  }

  function toCssNumericArray(values) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      result[i] = toCssUnitValue(values[i]);
    }
    return result;
  }

  class MathOperation {
    constructor(values, operator, opt_name, opt_delimiter) {
      privateDetails.set(this, {
        values: toCssNumericArray(values),
        operator: operator,
        name: opt_name || operator,
        delimiter: opt_delimiter || ', '
      });
    }

    get operator() {
      return privateDetails.get(this).operator;
    }

    get values() {
      return  privateDetails.get(this).values;
    }

    toString() {
      const details = privateDetails.get(this);
      return `${details.name}(${details.values.join(details.delimiter)})`;
    }
  }

  /**
   * Parse a CSSUnitValue from the passed string
   * @param {string} str
   * @return {CSSUnitValue}
   */
  function parseCSSUnitValue(str) {
    const UNIT_VALUE_REGEXP = /^(-?\d*[.]?\d+)(r?em|r?ex|r?cap|r?ch|r?ic|r?lh|[sld]?v(w|h|i|b|min|max)|cm|mm|Q|in|pt|pc|px|%)?$/;
    const match = str.match(UNIT_VALUE_REGEXP);
    if (match) {
      let [_, v, unit] = match;
      if (typeof unit === 'undefined') {
        unit = 'number';
      } else if (unit === '%') {
        unit = 'percent';
      }
      return new CSSUnitValue(parseFloat(v), unit);
    } else {
      throw new SyntaxError(`Unsupported syntax ${str}`);
    }
  }

  /**
   * Parse the string as a CSSMathProduct
   * @param {string} str
   * @return {CSSMathProduct}
   */
  function parseCSSMultiplication(str) {
    let values = [];
    const tokens = str.split(/(?<!\([^\)]*)([*])(?![^\(]*\))/);
    values.push(parseCSSDivision(tokens.shift()));
    while (tokens.length) {
      tokens.shift(); // Consume operator '*'
      values.push(parseCSSDivision(tokens.shift()));
    }
    return new CSSMathProduct(...values);
  }

  /**
   * Parse the string as a CSSMathProduct
   * @param {string} str
   * @return {CSSMathProduct}
   */
  function parseCSSDivision(str) {
    let values = [];
    const tokens = str.split(/(?<!\([^\)]*)([/])(?![^\(]*\))/);
    values.push(parseCSSNumericValue(tokens.shift()));
    while (tokens.length) {
      tokens.shift(); // Consume operator '/'
      values.push(new CSSMathInvert(parseCSSNumericValue(tokens.shift())));
    }
    return new CSSMathProduct(...values);
  }

  /**
   * Parse the string as a CSSMathSum
   * @param {string} str
   * @return {CSSMathSum}
   */
  function parseCSSMathSum(str) {
    let values = [];
    const tokens = str.split(/(?<!\([^\)]*)(\s[+-]\s)(?![^\(]*\))/);
    values.push(parseCSSMultiplication(tokens.shift()));
    while (tokens.length) {
      let op = tokens.shift();
      let val = tokens.shift();
      if (op.trim() === '+') {
        values.push(parseCSSMultiplication(val));
      } else if (op.trim() === '-') {
        values.push(new CSSMathNegate(parseCSSMultiplication(val)));
      }
    }
    return new CSSMathSum(...values);
  }

  /**
   * Parse math function form the passed string and return a matching CSSMathValue
   * @param {string} str
   * @return {CSSMathValue}
   */
  function parseMathFunction(str) {
    const MATH_VALUE_REGEXP = /^(calc|min|max)?\((.*)\)$/;
    const match = str.match(MATH_VALUE_REGEXP);
    if (match) {
      let [_, operation = 'parens', value] = match;
      switch (operation) {
        case 'calc':
        case 'parens':
          return parseCSSMathSum(value);
        case 'min':
          return new CSSMathMin(...value.split(',').map(parseCSSNumericValue));
        case 'max':
          return new CSSMathMax(...value.split(',').map(parseCSSNumericValue));
      }
    } else {
      throw new SyntaxError(`Unsupported syntax ${str}`);
    }
  }

  /**
   * A naive parsing function parsing the input string and returning a CSSNumericValue.
   * It supports simple expressions as 'calc(10em + 10px)'
   *
   * @param {string} value
   * @return {CSSNumericValue}
   */
  function parseCSSNumericValue(value) {
    value = value.trim();
    if (value.match(/^[a-z(]/i)) {
      return parseMathFunction(value);
    } else {
      return parseCSSUnitValue(value);
    }
  }

  const cssOMTypes = {
    'CSSNumericValue': class {
      static parse(value) {
        return simplifyCalculation(parseCSSNumericValue(value), {});
      }
    },
    'CSSUnitValue': class {
      constructor(value, unit) {
        privateDetails.set(this, {
          value: value,
          unit: unit
        });
      }

      get value() {
        return privateDetails.get(this).value;
      }

      set value(value) {
        privateDetails.get(this).value = value;
      }

      get unit() {
        return  privateDetails.get(this).unit;
      }

      to(unit) {
        return to(this, unit)
      }

      toSum(...units) {
        return toSum(this, ...units)
      }

      type() {
        const details = privateDetails.get(this)
        // The type of a CSSUnitValue is the result of creating a type from its unit internal slot.
        return createAType(details.unit)
      }

      toString() {
        const details = privateDetails.get(this);
        return `${details.value}${displayUnit(details.unit)}`;
      }
    },

    'CSSKeywordValue': class {
      constructor(value) {
        this.value = value;
      }

      toString() {
        return this.value.toString();
      }
    },

    'CSSMathSum': class extends MathOperation  {
      constructor(values) {
        super(arguments, 'sum', 'calc', ' + ');
      }
    },

    'CSSMathProduct': class extends MathOperation  {
      constructor(values) {
        super(arguments, 'product', 'calc', ' * ');
      }

      toSum(...units) {
        return toSum(this, ...units)
      }

      type() {
        const values = privateDetails.get(this).values;
        // The type is the result of multiplying the types of each of the items in its values internal slot.
        return values.map(v => v.type()).reduce(multiplyTypes)
      }
    },

    'CSSMathNegate': class extends MathOperation {
      constructor(values) {
        super([arguments[0]], 'negate', '-');
      }

      get value() {
        return  privateDetails.get(this).values[0];
      }
    },

    'CSSMathInvert': class extends MathOperation {
      constructor(values) {
        super([1, arguments[0]], 'invert', 'calc', ' / ');
      }

      get value() {
        return  privateDetails.get(this).values[1];
      }

      type() {
        const details = privateDetails.get(this)
        // The type of a CSSUnitValue is the result of creating a type from its unit internal slot.
        return invertType(details.values[1].type())
      }
    },

    'CSSMathMax': class extends MathOperation {
      constructor() {
        super(arguments, 'max');
      }
    },

    'CSSMathMin': class extends MathOperation  {
      constructor() {
        super(arguments, 'min');
      }
    }
  };

  if (!window.CSS) {
    if (!Reflect.defineProperty(window, 'CSS', { value: {} }))
      throw Error(`Error installing CSSOM support`);
  }

  if (!window.CSSUnitValue) {
    [
      'number',
      'percent',
      // Length units
      'em',
      'ex',
      'px',
      'cm',
      'mm',
      'in',
      'pt',
      'pc',  // Picas
      'Q',  // Quarter millimeter
      'vw',
      'vh',
      'vmin',
      'vmax',
      'rems',
      "ch",
      // Angle units
      'deg',
      'rad',
      'grad',
      'turn',
      // Time units
      'ms',
      's',
      'Hz',
      'kHz',
      // Resolution
      'dppx',
      'dpi',
      'dpcm',
      // Other units
      "fr"
    ].forEach((name) => {
      const fn = (value) => {
        return new CSSUnitValue(value, name);
      };
      if (!Reflect.defineProperty(CSS, name, { value: fn }))
        throw Error(`Error installing CSS.${name}`);
    });
  }

  for (let type in cssOMTypes) {
    if (type in window)
      continue;
    if (!Reflect.defineProperty(window, type, { value: cssOMTypes[type] }))
      throw Error(`Error installing CSSOM support for ${type}`);
  }
}
