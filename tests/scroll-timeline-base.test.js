import { calculateTargetEffectEnd, calculateMaxScrollOffset } from "../src/scroll-timeline-base";

describe("calculateTargetEffectEnd", function () {
  test("returns Infinity when iterationCount is Infinity", function () {
    let opts = {
      iterationCount: Infinity
    };
    expect(calculateTargetEffectEnd(opts)).toBe(Infinity)
  });

  test("returns 0 for empty options object (all default values)", function () {
    let opts = {};
    expect(calculateTargetEffectEnd(opts)).toBe(0)
  });

  test("returned value equals the effect duration when we have: 1 iteration and 0 startDelay, and endDelay", function () {
    let opts = {
      iterationCount: 1,
      duration: 200
    };
    expect(calculateTargetEffectEnd(opts)).toBe(200);
  });

  test("should respect startDelay if it was > 0", function () {
    let duration = 200;
    let startDelay = 50;
    let opts = {
      iterationCount: 1,
      duration,
      startDelay
    };
    expect(calculateTargetEffectEnd(opts)).toBe(duration + startDelay);
  });

  test("should respect startDelay if it was > 0", function () {
    let duration = 200;
    let startDelay = 50;
    let endDelay = 50;
    let opts = {
      iterationCount: 1,
      duration,
      startDelay,
      endDelay
    };
    expect(calculateTargetEffectEnd(opts)).toBe(duration + startDelay + endDelay);
  });

  test("should never return negative value", function () {
    let duration = -200;
    let startDelay = 50;
    let endDelay = 50;
    let opts = {
      iterationCount: 1,
      duration,
      startDelay,
      endDelay
    };
    expect(calculateTargetEffectEnd(opts)).toBe(0);
  });
});

describe("calculateMaxScrollOffset", function () {
  test("vertical orientation should be based on scrollHeight and clientHeight", function() {
    let orientation = 'vertical';
    let clientHeight = 1000;
    let scrollHeight = 1000;

    let scrollSource = {
      clientHeight,
      scrollHeight
    };

    expect(calculateMaxScrollOffset( scrollSource, orientation )).toBe(0);

  });

  test("block orientation should be based on scrollHeight and clientHeight", function() {
    let orientation = 'block';
    let clientHeight = 1000;
    let scrollHeight = 1000;

    let scrollSource = {
      clientHeight,
      scrollHeight
    };

    expect(calculateMaxScrollOffset( scrollSource, orientation )).toBe(0);

  });

  test("inline orientation should be based on scrollWidth and clientWidth", function() {
    let orientation = 'inline';
    let clientWidth = 1000;
    let scrollWidth = 1000;

    let scrollSource = {
      clientWidth,
      scrollWidth
    };

    expect(calculateMaxScrollOffset( scrollSource, orientation )).toBe(0);

  });

  test("horizontal orientation should be based on scrollWidth and clientWidth", function() {
    let orientation = 'horizontal';
    let clientWidth = 1000;
    let scrollWidth = 1000;

    let scrollSource = {
      clientWidth,
      scrollWidth
    };

    expect(calculateMaxScrollOffset( scrollSource, orientation )).toBe(0);

  });

});

describe("calculateScrollOffset", function () {
  it("", function () {

  });
});