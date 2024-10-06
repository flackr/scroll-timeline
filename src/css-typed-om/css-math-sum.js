import {CSSMathValue} from './css-math-value';

export class CSSMathSum extends CSSMathValue {
  constructor(values) {
    super(arguments, 'sum', 'calc', ' + ');
  }
}