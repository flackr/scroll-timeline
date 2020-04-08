import { calculateTargetEffectEnd, calculateMaxScrollOffset, calculateScrollOffset, installScrollOffsetExtension, ScrollTimeline, _getStlOptions, addAnimation } from "../src/scroll-timeline-base";

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
  function scrollOffsetFunction (scrollSource, orientation, offset, autoValue) {
    return true;
  }
  it("should call and return the scrollOffsetFunction if it was passed as an argument", function () {
    expect( calculateScrollOffset(true, true, true, true, scrollOffsetFunction) ).toBe(true);
  });

  it("should utilise orientation information correctly and use scrollHeight / clientHeight for vertical and block orientations ", function () {
    let orientationV = 'vertical';
    let orientationH = 'horizontal';
    let clientHeight = 1000;
    let scrollHeight = 1000;

    let clientWidth = 1000;
    let scrollWidth = 1000;

    let offset = '100px';

    let scrollSourceV = {
      clientHeight,
      scrollHeight
    };

    let scrollSourceH = {
      clientWidth,
      scrollWidth
    };

    expect(calculateScrollOffset('0%', scrollSourceV, orientationV, offset, null)).toBe(100);
    expect(calculateScrollOffset('0%', scrollSourceH, orientationH, offset, null)).toBe(100);
  });

  it("percentage values must be converted based on scrollSource deltas", function () {
    let orientationV = 'block';
    let orientationH = 'inline';
    let clientHeight = 900;
    let scrollHeight = 1000;

    let clientWidth = 1000;
    let scrollWidth = 1000;

    let offset = '90%';

    let scrollSourceV = {
      clientHeight,
      scrollHeight
    };

    let scrollSourceH = {
      clientWidth,
      scrollWidth
    };

    expect(calculateScrollOffset('0%', scrollSourceV, orientationV, offset, null)).toBe(90);
  });

});


describe('installScrollOffsetExtension', function () {

  let parse = function () {
    return "parse";
  };
  let evaluate = function () {
    return "evaluate";
  };

  let installedExtensions = installScrollOffsetExtension(parse, evaluate);

  let currentFns = installedExtensions[installedExtensions.length - 1];

  it("should push extensions and return the array of installed extensions", function () {
    expect(installedExtensions.length).toBeGreaterThan(0);
  });

  it("successfuly maps the parse and evaluate function", function () {
    expect(currentFns.parse()).toBe("parse");
    expect(currentFns.evaluate()).toBe("evaluate");
  });
});

describe("ScrollTimeline", function () {
  it("Should have readonly __polyfill flag to differentiate it from native implementation if existed and make testing & debugging easier", function () {
    let stl = new ScrollTimeline();
    expect(typeof stl.__polyfill).toBeDefined();
  });
});

describe("addAnimation", function () {
  it("should be able to retreive animations and animationOptions attached to a scroll timeline", function () {
    let stl = new ScrollTimeline();

    let animation1 = { test: 1 }
    let animation2 = { test: 1 }
    let opts1 = { test: 1 }
    let opts2 = { test: 2 }
    addAnimation(stl, animation1, opts1);
    addAnimation(stl, animation2, opts2);

    let stlOptions = _getStlOptions(stl)
    expect( stlOptions.animations.length ).toBe(2)

    expect( stlOptions.animations[0].test ).toBe(1)
    expect( stlOptions.animationOptions[1].test ).toBe(2)

  });
});