import {multiplyTypes, toSum} from './procedures';
import {CSSMathValue} from './css-math-value';

export class CSSMathProduct extends CSSMathValue  {
  constructor(values) {
    super(arguments, 'product', 'calc', ' * ');
  }

  toSum(...units) {
    return toSum(this, ...units)
  }

  type() {
    // The type is the result of multiplying the types of each of the items in its values internal slot.
    return this.values.map(v => v.type()).reduce(multiplyTypes)
  }
}