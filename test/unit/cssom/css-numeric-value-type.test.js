/**
 * @vitest-environment jsdom
 */
import {describe, test, expect} from 'vitest';
import {installCSSOM} from '../../../src/proxy-cssom.js';

describe('CSSNumericValue.type()', () => {
  installCSSOM();


  describe('CSSUnitValue.type()', () => {
    function testUnitIsType(unit, type) {
      expect(new CSSUnitValue(10, unit).type()).toEqual(type);
      expect(new CSSUnitValue(10, unit.toUpperCase()).type()).toEqual(type);
    }

    const lengthUnits = ['em', 'rem', 'ex', 'rex', 'cap', 'rcap', 'ch', 'rch', 'ic', 'ric', 'lh', 'rlh', 'vw', 'lvw',
      'svw', 'dvw', 'vh', 'lvh', 'svh', 'dvh', 'vi', 'lvi', 'svi', 'dvi', 'vb', 'lvb', 'svb', 'dvb', 'vmin', 'lvmin',
      'svmin', 'dvmin', 'vmax', 'lvmax', 'svmax', 'dvmax', 'cm', 'mm', 'q', 'in', 'pt', 'pc', 'px'];

    for (const unit of lengthUnits) {
      test(`Type of '${unit}' is length`, () => {
        testUnitIsType(unit, {length: 1});
      });
    }

    const angleUnits = ['deg', 'grad', 'rad', 'turn'];
    for (const unit of angleUnits) {
      test(`Type of '${unit}' is angle`, () => {
        testUnitIsType(unit, {angle: 1});
      });
    }

    const timeUnits = ['s', 'ms'];
    for (const unit of timeUnits) {
      test(`Type of '${unit}' is time`, () => {
        testUnitIsType(unit, {time: 1});
      });
    }

    const frequencyUnits = ['hz', 'khz'];
    for (const unit of frequencyUnits) {
      test(`Type of '${unit}' is frequency`, () => {
        testUnitIsType(unit, {frequency: 1});
      });
    }

    const resolutionUnits = ['dpi', 'dpcm', 'dppx'];
    for (const unit of resolutionUnits) {
      test(`Type of '${unit}' is resolution`, () => {
        testUnitIsType(unit, {resolution: 1});
      });
    }

    test(`Type of 'fr' is flex`, () => {
      testUnitIsType('fr', {flex: 1});
    });

    test(`Type of 'percent' is percent`, () => {
      // Percent unit is specced to be lower case.
      // https://drafts.css-houdini.org/css-typed-om-1/#cssnumericvalue-create-a-type

      expect(new CSSUnitValue(10, 'percent').type()).toEqual({percent: 1});
      expect(() => new CSSUnitValue(10, 'PERCENT').type()).toThrowError(TypeError);
    });

    test(`Type of number is number`, () => {
      // Number unit is specced to be lower case.
      // https://drafts.css-houdini.org/css-typed-om-1/#cssnumericvalue-create-a-type

      expect(new CSSUnitValue(10, 'number').type()).toEqual({});
      expect(() => new CSSUnitValue(10, 'NUMBER').type()).toThrowError(TypeError);
    });
  });

  describe('CSSMathSum.type()', () => {
    const compatibleTuples = [//
      ['px', 'em', {length: 1}], //
      ['rad', 'deg', {angle: 1}], //
      ['s', 'ms', {time: 1}], //
      ['Hz', 'kHz', {frequency: 1}], //
      ['dpi', 'dppx', {resolution: 1}], //
      ['fr', 'fr', {flex: 1}], //
      ['percent', 'percent', {percent: 1}], //
      ['number', 'number', {}], //
    ];

    for (const [unitA, unitB, type] of compatibleTuples) {
      test(`Type of CSSMathSum of '${unitA}' and '${unitB}' is '${JSON.stringify(type)}'`, () => {
        expect(new CSSMathSum(new CSSUnitValue(10, unitA), new CSSUnitValue(10, unitB)).type()).toEqual(type);
      });
    }

    const percentHintTuples = [ //
      ['percent', 'px', {length: 1, percentHint: 'length'}], //
      ['percent', 'rad', {angle: 1, percentHint: 'angle'}], //
      ['percent', 's', {time: 1, percentHint: 'time'}], //
      ['percent', 'Hz', {frequency: 1, percentHint: 'frequency',}], //
      ['percent', 'dpi', {resolution: 1, percentHint: 'resolution'}], //
      ['percent', 'fr', {flex: 1, percentHint: 'flex'}], //
    ];
    for (const [unitA, unitB, type] of percentHintTuples) {
      test(`Type of CSSMathSum of '${unitA}' and '${unitB}' is '${JSON.stringify(type)}'`, () => {
        expect(new CSSMathSum(new CSSUnitValue(10, unitA), new CSSUnitValue(10, unitB)).type()).toEqual(type);
      });
    }

    const incompatibleTuples = [ //
      ['px', 'rad'], //
      ['rad', 's'], //
      ['s', 'Hz'], //
      ['Hz', 'dpi'], //
      ['dpi', 'fr'], //
      ['percent', 'number'], //
      ['number', 'px'], //
    ];
    for (const [unitA, unitB] of incompatibleTuples) {
      test(`Creating CSSMathSum of '${unitA}' and '${unitB}' throws TypeError`, () => {
        expect(() => new CSSMathSum(new CSSUnitValue(10, unitA), new CSSUnitValue(10, unitB)).type())
          .toThrow(TypeError);
      });
    }

    test('Creating CSSMathSum with values with different percent hints in their type throws TypeError', () => {
      const lengthHintValue = new CSSMathSum(CSS.px(1), CSS.percent(1));
      const angleHintValue = new CSSMathSum(CSS.deg(1), CSS.percent(1));
      expect(() => new CSSMathSum(lengthHintValue, angleHintValue)).toThrow(TypeError)
    });

    test('Type of CSSMathSum with values with same percent hints', () => {
      const lengthHintValue1 = new CSSMathSum(CSS.px(1), CSS.percent(1));
      const lengthHintValue2 = new CSSMathSum(CSS.em(1), CSS.percent(1));
      expect(new CSSMathSum(lengthHintValue1, lengthHintValue2).type()).toEqual({length: 1, percentHint: 'length'});
    });

    test('Type of CSSMathSum of percent value and value with percent hint', () => {
      const lengthHintValue = new CSSMathSum(CSS.px(1), CSS.percent(1));
      const percentValue = CSS.percent(1);
      expect(new CSSMathSum(lengthHintValue, percentValue).type()).toEqual({length: 1, percentHint: 'length'});
      expect(new CSSMathSum(percentValue, lengthHintValue).type()).toEqual({length: 1, percentHint: 'length'});
    });
  });

  describe('CSSMathProduct.type()', () => {
    const compatibleTuples = [//
      ['number', 'em', {length: 1}], //
      ['number', 'deg', {angle: 1}], //
      ['number', 'ms', {time: 1}], //
      ['number', 'kHz', {frequency: 1}], //
      ['number', 'dppx', {resolution: 1}], //
      ['number', 'fr', {flex: 1}], //
      ['number', 'percent', {percent: 1}], //

      ['px', 'em', {length: 2}], //
      ['rad', 'deg', {angle: 2}], //
      ['s', 'ms', {time: 2}], //
      ['Hz', 'kHz', {frequency: 2}], //
      ['dpi', 'dppx', {resolution: 2}], //
      ['fr', 'fr', {flex: 2}], //
      ['percent', 'percent', {percent: 2}], //
      ['number', 'number', {}], //
    ];

    for (const [unitA, unitB, type] of compatibleTuples) {
      test(`Type of CSSMathProduct of '${unitA}' and '${unitB}' is '${type}'`, () => {
        expect(new CSSMathProduct(new CSSUnitValue(10, unitA), new CSSUnitValue(10, unitB)).type()).toEqual(type);
      });
    }
  });

  describe('CSSMathNegate.type()', () => {
    const unitsAndTypes = [//
      ['em', {length: 1}], //
      ['deg', {angle: 1}], //
      ['ms', {time: 1}], //
      ['kHz', {frequency: 1}], //
      ['dppx', {resolution: 1}], //
      ['fr', {flex: 1}], //
      ['percent', {percent: 1}], //
    ];

    for (const [unit, type] of unitsAndTypes) {
      test(`Type of CSSMathNegate of '${unit}' is '${type}'`, () => {
        expect(new CSSMathNegate(new CSSUnitValue(10, unit)).type()).toEqual(type);
      });
    }
  });

  describe('CSSMathInvert.type()', () => {
    const unitsAndTypes = [//
      ['em', {length: -1}], //
      ['deg', {angle: -1}], //
      ['ms', {time: -1}], //
      ['kHz', {frequency: -1}], //
      ['dppx', {resolution: -1}], //
      ['fr', {flex: -1}], //
      ['percent', {percent: -1}], //
    ];

    for (const [unit, type] of unitsAndTypes) {
      test(`Type of CSSMathInvert of '${unit}' is '${type}'`, () => {
        expect(new CSSMathInvert(new CSSUnitValue(10, unit)).type()).toEqual(type);
      });
    }
  });
});