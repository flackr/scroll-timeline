import {parseLength} from '../src/utils';

describe("parseLength util function", function () {
  test("should return an array of length 3 for valid input", function () {
    let offset = '100px';
    expect(parseLength(offset).length).toEqual(3);
  });

  test("can understand px as valid unit", function () {
    let num = '100';
    let unit = 'px';
    let offset = num + unit;
    expect(parseLength(offset)[1]).toEqual(num);
    expect(parseLength(offset)[2]).toEqual(unit);
  });

  test("can understand % as valid input", function () {
    let num = '99999';
    let unit = '%';
    let offset = num + unit;
    expect(parseLength(offset)[1]).toEqual(num);
    expect(parseLength(offset)[2]).toEqual(unit);
  });

  test("should null for invalid input", function () {
    let num = '100';
    let unit = '&';
    let offset = num + unit;
    expect(parseLength(offset)).toEqual(null);
  });
})