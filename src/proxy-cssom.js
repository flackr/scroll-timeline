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

export function installCSSOM() {
<<<<<<< HEAD
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

  const cssOMTypes = {
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

      toString() {
        const details = privateDetails.get(this);
        return `${details.value}${displayUnit(details.unit)}`;
      }
    },

    'CSSKeywordValue': class {
      constructor(value) {
        this.value = value;
=======
  if (!window.CSSUnitValue) {
    class CSSUnitValue {
      constructor(value, unit) {
        this.value_ = value;
        this.unit_ = unit;
      }

      get value() {
        return this.value_;
      }

      get unit() {
        return this.unit_;
      }

      displayUnit() {
        switch(this.unit_) {
          case 'percent':
            return '%';
          case 'number':
            return '';
          default:
            return this.unit_.toLowerCase();
        }
      }

      toString() {
        return `${this.value}${this.displayUnit()}`;
      }
    }
    window.CSSUnitValue = CSSUnitValue;
  }

  if (!window.CSSKeywordValue) {
    class CSSKeywordValue {
      constructor(value) {
        this.value_ = value;
      }

      get value() {
        return this.value_;
>>>>>>> c4ecd0b (Add polyfill for CSSOM.)
      }

      toString() {
        return this.value.toString();
      }
<<<<<<< HEAD
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
    },

    'CSSMathNegate': class extends MathOperation {
      constructor(values) {
        super([arguments[0]], 'negate', '-');
      }
    },

    'CSSMathNegate': class extends MathOperation {
      constructor(values) {
        super([1, arguments[0]], 'invert', 'calc', ' / ');
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
=======
    }
    window.CSSKeywordValue = CSSKeywordValue;
  }

  if (!window.CSSNumericArray) {
    class CSSNumericArray {
      constructor() {
        this.values = arguments.map(v => new CSSUnitValue(v, 'number'));
      }
      toArray() {
        return this.values.map(v => v.value);
      }
    }
    window.CSSNumericArray = CSSNumericArray;
  }

  if (!window.CSSMathSum) {
    class CSSMathSum {
      constructor() {
        this.values = new CSSNumericArray(arguments);
      }

      toString() {
        return this.values.toArray().join(' + ');
      }
    }
    window.CSSMathSum = CSSMathSum;
  }

  if (!window.CSSMathMax) {
    class CSSMathMax {
      constructor() {
        this.values = new CSSNumericArray(arguments);
      }

      toString() {
        return 'max(' + this.values.toArray().join(', ') + ')';
      }
    }
    window.CSSMathMax = CSSMathMax;
  }

  if (!window.CSSMathMin) {
    class CSSMathMin {
      constructor() {
        this.values = new CSSNumericArray(arguments);
      }

      toString() {
        return 'min(' + this.values.toArray().join(', ') + ')';
      }
    }
    window.CSSMathMin = CSSMathMin;
  }

  if (!window.CSS)
    window.CSS = {};

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
    if (!CSS[name]) {
      CSS[name] = (value) => {
        return new CSSUnitValue(value, name);
      }
    }
  });

>>>>>>> c4ecd0b (Add polyfill for CSSOM.)
}
