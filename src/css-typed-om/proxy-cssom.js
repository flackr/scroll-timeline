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
import {CSSNumericValue} from './css-numeric-value'
import {CSSUnitValue} from './css-unit-value'
import {CSSMathValue} from './css-math-value'
import {CSSKeywordValue} from './css-keyword-value';
import {CSSMathSum} from './css-math-sum';
import {CSSMathProduct} from './css-math-product';
import {CSSMathNegate} from './css-math-negate';
import {CSSMathInvert} from './css-math-invert';
import {CSSMathMax} from './css-math-max';
import {CSSMathMin} from './css-math-min';

export function installCSSOM() {
  const cssOMTypes = {
    'CSSNumericValue': CSSNumericValue,
    'CSSMathValue': CSSMathValue,
    'CSSUnitValue': CSSUnitValue,
    'CSSKeywordValue': CSSKeywordValue,
    'CSSMathSum': CSSMathSum,
    'CSSMathProduct': CSSMathProduct,
    'CSSMathNegate': CSSMathNegate,
    'CSSMathInvert': CSSMathInvert,
    'CSSMathMax': CSSMathMax,
    'CSSMathMin': CSSMathMin  };

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

    Object.defineProperty(value, 'name', { value: type });
  }
}
