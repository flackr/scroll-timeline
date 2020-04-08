import {parseLength} from '../src/utils';

describe("parseLength util function", function () {
  test("should return an object of 2 properties {value, unit} for valid input", function () {
    let offset = '100px';
    let parsed = parseLength(offset)
    let expected = {
      value: '100',
      unit: 'px'
    };
    expect(parsed).toMatchObject(expected);
  });

  test("can understand px as valid unit", function () {
    let num = '100';
    let unit = 'px';
    let offset = num + unit;
    expect(parseLength(offset).value).toEqual(num);
    expect(parseLength(offset).unit).toEqual(unit);
  });

  test("can understand % as valid input", function () {
    let num = '99999';
    let unit = '%';
    let offset = num + unit;
    expect(parseLength(offset).value).toEqual(num);
    expect(parseLength(offset).unit).toEqual(unit);
  });

  test("should null for invalid input", function () {
    let num = '100';
    let unit = '&';
    let offset = num + unit;
    expect(parseLength(offset)).toEqual(null);
  });
});