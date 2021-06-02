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
      }

      toString() {
        return this.value.toString();
      }
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

}
