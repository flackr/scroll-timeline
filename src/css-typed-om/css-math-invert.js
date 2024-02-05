import {invertType} from './procedures';
import {CSSMathValue} from './css-math-value';

export class CSSMathInvert extends CSSMathValue {
  constructor(values) {
    super([1, arguments[0]], 'invert', 'calc', ' / ');
  }

  get value() {
    return  this.values[1];
  }

  type() {
    // The type of a CSSUnitValue is the result of creating a type from its unit internal slot.
    return invertType(this.values[1].type())
  }
}