import {CSSNumericValue} from './css-numeric-value'
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

export class CSSMathValue extends CSSNumericValue {
  #values;
  #operator;
  #name;
  #delimiter;

  constructor(values, operator, opt_name, opt_delimiter) {
    super();
    this.#values = toCssNumericArray(values);
    this.#operator = operator;
    this.#name = opt_name || operator;
    this.#delimiter = opt_delimiter || ', ';
  }

  get operator() {
    return this.#operator;
  }

  get values() {
    return this.#values;
  }

  toString() {
    return `${this.#name}(${this.#values.join(this.#delimiter)})`;
  }
}
