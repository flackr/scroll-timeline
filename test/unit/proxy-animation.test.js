/**
 * @vitest-environment jsdom
 */
import {describe, test, expect} from 'vitest';
import {parseAnimationRange} from '../../src/proxy-animation.js';
import {ANIMATION_RANGE_NAMES} from '../../src/scroll-timeline-base.js';

const lengthPercentages = [
  '10px',
  '50%',
  'calc(50% + 10px)',
]

const validRange = [
  // normal
  'normal',

  // <length-percentage>
  ...lengthPercentages,

  // <timeline-range-name> <length-percentage>?
  'entry',
  'exit',
  'cover',
  'contain',
  'entry-crossing',
  'exit-crossing',

  'entry 10%',
  'exit 10%',
  'cover 10%',
  'contain 10%',
  'entry-crossing 10%',
  'exit-crossing 10%',
]

// <'animation-range-start'> <'animation-range-end'>?
// <'animation-range-start'> = [ normal | <length-percentage> | <timeline-range-name> <length-percentage>? ]
const validAnimationRanges = [
  // animation-range-end omitted:
  ...validRange,
  ...validRange.flatMap(startRange => validRange.map(endRange => `${startRange} ${endRange}`))
]

const invalidRange = [
  '3s', 'black', 'not-a-valid-keyword'
]

function validCombination(endRange, extraRange) {
  return ANIMATION_RANGE_NAMES.includes(endRange) && lengthPercentages.includes(extraRange);
}

const invalidAnimationRanges = [...invalidRange,
  ...invalidRange.flatMap(startRange => validRange.map(endRange => `${startRange} ${endRange}`)),
  ...validRange.flatMap(startRange => invalidRange.map(endRange => `${startRange} ${endRange}`)),
  ...validRange.flatMap(startRange => validRange.flatMap(endRange => validRange
    .filter(extraRange => !validCombination(endRange, extraRange) && !validCombination(startRange, endRange))
    .map(extraRange => `${startRange} ${endRange} ${extraRange}`)))
];

describe('animation-range parsing', () => {

  describe('valid animation-range', () => {
    for (const value of validAnimationRanges) {
      test(`should parse '${value}'`, () => {
        parseAnimationRange(value);
      });
    }
  });

  describe('invalid animation-range', () => {
    for (const value of invalidAnimationRanges) {
      test(`should not parse '${value}'`, () => {
        const animationRange = parseAnimationRange(value);
        expect(animationRange.start).toBe('normal');
        expect(animationRange.end).toBe('normal');
      });
    }
  });


  describe('shorthand expansion', () => {
    // TODO: Update once animation-range ambiguity is resolved
    // https://github.com/w3c/csswg-drafts/issues/9264


    function range(rangeName, offset) {
      if (typeof offset === 'number') {
        return {rangeName, offset: CSS.percent(offset)};
      } else {
        return {rangeName, offset};
      }
    }

    const shorthandExpansions = [
      ['normal', 'normal', 'normal'],
      ['normal normal', 'normal', 'normal'],
      ['cover', range('cover', 0), range('cover', 100)],
      ['contain', range('contain', 0), range('contain', 100)],
      ['entry', range('entry', 0), range('entry', 100)],
      ['exit', range('exit', 0), range('exit', 100)],
      ['entry-crossing', range('entry-crossing', 0), range('entry-crossing', 100)],
      ['exit-crossing', range('exit-crossing', 0), range('exit-crossing', 100)],

      ['10%', range('none', 10), 'normal'],

      ['cover 10% cover 90%', range('cover', 10), range('cover', 90)],
      ['contain 10% contain 90%', range('contain', 10), range('contain', 90)],
      ['entry 10% entry 90%', range('entry', 10), range('entry', 90)],
      ['exit 10% exit 90%', range('exit', 10), range('exit', 90)],
      ['entry-crossing 10% entry-crossing 90%', range('entry-crossing', 10), range('entry-crossing', 90)],
      ['exit-crossing 10% exit-crossing 90%', range('exit-crossing', 10), range('exit-crossing', 90)],

      ['10% cover 90%', range('none', 10), range('cover', 90)],
      ['10% contain 90%', range('none', 10), range('contain', 90)],
      ['10% entry 90%', range('none', 10), range('entry', 90)],
      ['10% exit 90%', range('none', 10), range('exit', 90)],
      ['10% entry-crossing 90%', range('none', 10), range('entry-crossing', 90)],
      ['10% exit-crossing 90%', range('none', 10), range('exit-crossing', 90)],

      ['cover 0% 90%', range('cover', 10), range('none', 90)],
      ['contain 0% 90%', range('contain', 10), range('none', 90)],
      ['entry 0% 90%', range('entry', 10), range('none', 90)],
      ['exit 0% 90%', range('exit', 10), range('none', 90)],
      ['entry-crossing 0% 90%', range('entry-crossing', 10), range('none', 90)],
      ['exit-crossing 0% 90%', range('exit-crossing', 10), range('none', 90)],

      ['calc(5% + 5px) calc(95% + 5px)',
        range('none', new CSSMathSum(CSS.percent(5), CSS.px(5))),
        range('none', new CSSMathSum(CSS.percent(95), CSS.px(5)))],
      ['cover 0% calc(95% + 5px)',
        range('cover', 0),
        range('none', new CSSMathSum(CSS.percent(95), CSS.px(5)))],
      ['calc(5% + 5px) cover',
        range('none', new CSSMathSum(CSS.percent(5), CSS.px(5))),
        range('cover', 100)],

      // Ambiguous shorthands
      // TODO: Update once animation-range ambiguity is resolved
      // https://github.com/w3c/csswg-drafts/issues/9264
      ['cover 10%', range('cover', 10), range('cover', 100)],
      ['contain 10%', range('contain', 10), range('contain', 100)],
      ['entry 10%', range('entry', 10), range('entry', 100)],
      ['exit 10%', range('exit', 10), range('exit', 100)],
      ['entry-crossing 10%', range('entry-crossing', 10), range('entry-crossing', 100)],
      ['exit-crossing 10%', range('exit-crossing', 10), range('exit-crossing', 100)],
      ['cover calc(10% + 5px)', range('cover', new CSSMathSum(CSS.percent(10), CSS.px(5))), range('cover', 100)],
    ];

    for (const shorthandExpansion of shorthandExpansions) {
      const [shorthand, rangeStart, rangeEnd] = shorthandExpansion;
      test(`should expand shorthand '${shorthand}' to '${rangeStart?.toString()}' and '${rangeEnd?.toString()}'`,
        () => {
          const animationRange = parseAnimationRange(shorthand);
          expect(animationRange.start).toEqual(rangeStart);
          expect(animationRange.end).toEqual(rangeEnd);
        });
    }
  });
})