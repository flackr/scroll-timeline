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
import {
  addTypes,
  createAType,
  invertType,
  multiplyTypes,
  parseCSSNumericValue,
  rectifyType,
  to,
  toSum
} from './numeric-values';
import {simplifyCalculation} from './simplify-calculation';
import './tokenizer'

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

  class CSSNumericValue {
    static parse(value) {
      if (value instanceof CSSNumericValue) return value;

      return simplifyCalculation(parseCSSNumericValue(value), {});
    }

    // TODO: Add other methods: add, sub, mul, div, …
    // Spec: https://drafts.css-houdini.org/css-typed-om/#numeric-value
  }

  class CSSMathValue extends CSSNumericValue {
    constructor(values, operator, opt_name, opt_delimiter) {
      super();
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

  const cssOMTypes = {
    'CSSNumericValue': CSSNumericValue,
    'CSSMathValue': CSSMathValue,
    'CSSUnitValue': class extends CSSNumericValue {
      constructor(value, unit) {
        super();
        const type = createAType(unit);
        if (type === null) {
          throw new TypeError('Type error');
        }
        privateDetails.set(this, {
          value: value,
          unit: unit.toLowerCase()
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

    'CSSMathSum': class extends CSSMathValue  {
      constructor(...values) {
        super(values, 'sum', 'calc', ' + ');
        const type = values.map(v => v.type()).reduce(addTypes);
        if (type === null) {
          throw new TypeError('Type error');
        }
      }

      type() {
        const values = privateDetails.get(this).values;
        // The type is the result of adding the types of each of the items in its values internal slot.
        const type = values.map(v => v.type()).reduce(addTypes);
        return rectifyType(type);
      }
    },

    'CSSMathProduct': class extends CSSMathValue  {
      constructor(...values) {
        super(values, 'product', 'calc', ' * ');
        const type = values.map(v => v.type()).reduce(multiplyTypes);
        if (type === null) {
          throw new TypeError('Type error');
        }
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

    'CSSMathNegate': class extends CSSMathValue {
      constructor(value) {
        super([value], 'negate', '-');
      }

      get value() {
        return  privateDetails.get(this).values[0];
      }

      type() {
        return this.value.type();
      }
    },

    'CSSMathInvert': class extends CSSMathValue {
      constructor(value) {
        super([1, value], 'invert', 'calc', ' / ');
      }

      get value() {
        return  privateDetails.get(this).values[1];
      }

      type() {
        const details = privateDetails.get(this)
        // The type of a CSSUnitValue is the result of creating a type from its unit internal slot.
        const type = invertType(details.values[1].type());
        return rectifyType(type)
      }
    },

    'CSSMathMax': class extends CSSMathValue {
      constructor(values) {
        super(values, 'max');
      }
    },

    'CSSMathMin': class extends CSSMathValue  {
      constructor(values) {
        super(values, 'min');
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

  for (let [type, value] of Object.entries(cssOMTypes)) {
    if (type in window)
      continue;
    if (!Reflect.defineProperty(window, type, { value }))
      throw Error(`Error installing CSSOM support for ${type}`);
  }
}
