import {CSSNumericValue} from './css-numeric-value';
import {createAType, to, toSum} from './procedures';

function displayUnit(unit) {
  switch (unit) {
    case 'percent':
      return '%';
    case 'number':
      return '';
    default:
      return unit.toLowerCase();
  }
}

export class CSSUnitValue extends CSSNumericValue {
  #value;
  #unit;

  constructor(value, unit) {
    super();
    this.#value = value;
    this.#unit = unit;
  }

  get value() {
    return this.#value;
  }

  set value(value) {
    this.#value = value;
  }

  get unit() {
    return this.#unit;
  }

  to(unit) {
    return to(this, unit);
  }

  toSum(...units) {
    return toSum(this, ...units);
  }

  type() {
    // The type of a CSSUnitValue is the result of creating a type from its unit internal slot.
    return createAType(this.#unit);
  }

  toString() {
    return `${this.#value}${displayUnit(this.#unit)}`;
  }
}