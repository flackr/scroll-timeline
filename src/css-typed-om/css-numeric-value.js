import {parseCSSNumericValue} from './parse-numeric-value';

export class CSSNumericValue {
  static parse(value) {
    if (value instanceof CSSNumericValue)
      return value;

    return parseCSSNumericValue(value);
  }

  // TODO: Add other methods: add, sub, mul, div, …
  // Spec: https://drafts.css-houdini.org/css-typed-om/#numeric-value
}