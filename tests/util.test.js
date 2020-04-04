import {parseLength} from '../src/utils';

describe("parseLength util function", function () {
  test("parseLength should return an array or=f length 3 for valid input", function () {
    let offset = '100px';
    expect(parseLength(offset).length).toEqual(3);
  });

  test("parseLength should return an array or=f length 3 for valid input", function () {
    let num = '100';
    let unit = 'px';
    let offset = num + unit;
    expect(parseLength(offset)[1]).toEqual(num);
    expect(parseLength(offset)[2]).toEqual(unit);
  });

  test("parseLength should return an array or=f length 3 for valid input", function () {
    let num = '99999';
    let unit = '%';
    let offset = num + unit;
    expect(parseLength(offset)[1]).toEqual(num);
    expect(parseLength(offset)[2]).toEqual(unit);
  });

  test("parseLength should return null for invalid input", function () {
    let num = '100';
    let unit = '&';
    let offset = num + unit;
    expect(parseLength(offset)).toEqual(null);
  });
})