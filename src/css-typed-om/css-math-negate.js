import {CSSMathValue} from './css-math-value';

export class CSSMathNegate extends CSSMathValue {
  constructor(values) {
    super([arguments[0]], 'negate', '-');
  }

  get value() {
    return this.values[0];
  }

  type() {
    return this.value.type();
  }
}