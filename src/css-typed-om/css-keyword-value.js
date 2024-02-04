export class CSSKeywordValue {
  #value;

  constructor(value) {
    this.#value = value;
  }

  toString() {
    return this.#value.toString();
  }
}