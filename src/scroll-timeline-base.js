// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { parseLength } from "./utils";

const AUTO = new CSSKeywordValue("auto");

let scrollTimelineOptions = new WeakMap();
let extensionScrollOffsetFunctions = [];

function scrollEventSource(scrollSource) {
  if (scrollSource === document.scrollingElement) return document;
  return scrollSource;
}

/**
 * Updates the currentTime for all Web Animation instanced attached to a ScrollTimeline instance
 * @param scrollTimelineInstance {ScrollTimeline}
 */
function updateInternal(scrollTimelineInstance) {
  let animations = scrollTimelineOptions.get(scrollTimelineInstance).animations;
  if (animations.length === 0) return;
  let currentTime = scrollTimelineInstance.currentTime;
  for (let i = 0; i < animations.length; i++) {
    // The web-animations spec says to throw a TypeError if you try to seek to
    // an unresolved time value from a resolved time value, so to polyfill the
    // expected behavior we cancel the underlying animation.
    if (currentTime == null) {
      if (animations[i].playState === "paused") animations[i].cancel();
    } else {
      animations[i].currentTime = currentTime;
    }
  }
}

/**
 * Calculates the number of milliseconds mapped to the scroll range in case of AUTO
 *  in case developer provided timeRange, we use that directly.
 * @param scrollTimeline {ScrollTimeline}
 * @returns {Number}
 */
function calculateTimeRange(scrollTimeline) {
  let timeRange = scrollTimeline.timeRange;
  if (timeRange == AUTO) {
    timeRange = 0;
    let animations = scrollTimelineOptions.get(scrollTimeline).animations;
    for (let i = 0; i < animations.length; i++) {
      timeRange = Math.max(timeRange, calculateTargetEffectEnd(animations[i]));
    }
    if (timeRange === Infinity) timeRange = 0;
  }
  return timeRange;
}

/**
 * Determines target effect end based on animation duration, iterations count and start and end delays
 *  returned value should always be positive
 * @param options {Animation} animation
 * @returns {number}
 */
export function calculateTargetEffectEnd(animation) {
  return animation.effect.getComputedTiming().activeDuration;
}

/**
 * Enables the usage of custom parser and evaluator function, utilized by intersection based offset.
 * @param parseFunction {Function}
 * @param evaluateFunction {Function}
 * @returns {Array} all currently installed parsers
 */
export function installScrollOffsetExtension(parseFunction, evaluateFunction) {
  extensionScrollOffsetFunctions.push({
    parse: parseFunction,
    evaluate: evaluateFunction,
  });
  return extensionScrollOffsetFunctions;
}

/**
 * Calculates scroll offset based on orientation and scrollSource geometry
 * @param scrollSource {DOMElement}
 * @param orientation {String}
 * @returns {number}
 */
export function calculateMaxScrollOffset(scrollSource, orientation) {
  // TODO: Support other writing directions.
  if (orientation === "block") orientation = "vertical";
  else if (orientation === "inline") orientation = "horizontal";
  if (orientation === "vertical")
    return scrollSource.scrollHeight - scrollSource.clientHeight;
  else if (orientation === "horizontal")
    return scrollSource.scrollWidth - scrollSource.clientWidth;
}

function resolvePx(cssValue, resolvedLength) {
  if (cssValue instanceof CSSUnitValue) {
    if (cssValue.unit == "percent")
      return cssValue.value * resolvedLength / 100;
    else if (cssValue.unit == "px")
      return cssValue.value;
    else
      throw TypeError("Unhandled unit type " + cssValue.unit);
  } else if (cssValue instanceof CSSMathSum) {
    let total = 0;
    for (let value of cssValue.values) {
      total += resolvePx(value, resolvedLength);
    }
    return total;
  }
  throw TypeError("Unsupported value type: " + typeof(cssValue));
}

export function calculateScrollOffset(
  autoValue,
  scrollSource,
  orientation,
  offset,
  fn
) {
  if (fn)
    return fn(
      scrollSource,
      orientation,
      offset,
      autoValue.value == 0 ? "start" : "end"
    );
  // TODO: Support other writing directions.
  if (orientation === "block") orientation = "vertical";
  else if (orientation === "inline") orientation = "horizontal";

  let maxValue =
    orientation === "vertical"
      ? scrollSource.scrollHeight - scrollSource.clientHeight
      : scrollSource.scrollWidth - scrollSource.clientWidth;
  let parsed = parseLength(offset === AUTO ? autoValue : offset);
  return resolvePx(parsed, maxValue);
}

/**
 * Removes a Web Animation instance from ScrollTimeline
 * @param scrollTimeline {ScrollTimeline}
 * @param animation {Animation}
 * @param options {Object}
 */
export function removeAnimation(scrollTimeline, animation) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  let index = animations.indexOf(animation);
  if (index === -1) return;
  animations.splice(index, 1);
}

/**
 * Attaches a Web Animation instance to ScrollTimeline
 * @param scrollTimeline {ScrollTimeline}
 * @param animation {Animation}
 * @param options {Object}
 */
export function addAnimation(scrollTimeline, animation, options) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  animations.push(animation);
  updateInternal(scrollTimeline);
}

// TODO: this is a private function used for unit testing add function
export function _getStlOptions(scrollTimeline) {
  return scrollTimelineOptions.get(scrollTimeline);
}

export class ScrollTimeline {
  constructor(options) {
    scrollTimelineOptions.set(this, {
      scrollSource: null,
      orientation: "block",
      startScrollOffset: AUTO,
      endScrollOffset: AUTO,
      timeRange: AUTO,

      // Internal members
      animations: [],
    });
    this.scrollSource =
      options && options.scrollSource !== undefined ? options.scrollSource : document.scrollingElement;
    this.orientation = (options && options.orientation) || "block";
    this.startScrollOffset = (options && options.startScrollOffset) || AUTO;
    this.endScrollOffset = (options && options.endScrollOffset) || AUTO;
    this.timeRange = options && options.timeRange !== undefined ? options.timeRange : "auto";
  }

  set scrollSource(element) {
    if (this.scrollSource)
      scrollEventSource(this.scrollSource).removeEventListener("scroll", () =>
        updateInternal(this)
      );
    scrollTimelineOptions.get(this).scrollSource = element;
    if (element) {
      scrollEventSource(element).addEventListener("scroll", () =>
        updateInternal(this)
      );
    }
    updateInternal(this);
  }

  get scrollSource() {
    return scrollTimelineOptions.get(this).scrollSource;
  }

  set orientation(orientation) {
    if (
      ["block", "inline", "horizontal", "vertical"].indexOf(orientation) === -1
    ) {
      throw TypeError("Invalid orientation");
    }
    scrollTimelineOptions.get(this).orientation = orientation;
    updateInternal(this);
  }

  get orientation() {
    return scrollTimelineOptions.get(this).orientation;
  }

  set startScrollOffset(offset) {
    if (offset == "auto")
      offset = AUTO;
    let currentStlOptions = scrollTimelineOptions.get(this);
    // Allow extensions to override scroll offset calculation.
    currentStlOptions.startScrollOffsetFunction = null;
    for (let i = 0; i < extensionScrollOffsetFunctions.length; i++) {
      let result = extensionScrollOffsetFunctions[i].parse(offset);
      if (result !== undefined) {
        offset = result;
        currentStlOptions.startScrollOffsetFunction =
          extensionScrollOffsetFunctions[i].evaluate;
        break;
      }
    }
    if (offset != AUTO && !scrollTimelineOptions.get(this).startScrollOffsetFunction) {
      let parsed = parseLength(offset);
      // TODO: This should check CSSMathSum values as well.
      if (!parsed || (parsed instanceof CSSUnitValue && parsed.unit == "number"))
        throw TypeError("Invalid start offset.");
    }
    currentStlOptions.startScrollOffset = offset;
    updateInternal(this);
  }

  get startScrollOffset() {
    return scrollTimelineOptions.get(this).startScrollOffset;
  }

  set endScrollOffset(offset) {
    if (offset == "auto")
      offset = AUTO;
    // Allow extensions to override scroll offset calculation.
    scrollTimelineOptions.get(this).endScrollOffsetFunction = null;
    for (let i = 0; i < extensionScrollOffsetFunctions.length; i++) {
      let result = extensionScrollOffsetFunctions[i].parse(offset);
      if (result !== undefined) {
        offset = result;
        scrollTimelineOptions.get(this).endScrollOffsetFunction =
          extensionScrollOffsetFunctions[i].evaluate;
        break;
      }
    }
    if (offset != AUTO && !scrollTimelineOptions.get(this).startScrollOffsetFunction) {
      let parsed = parseLength(offset);
      // TODO: This should check CSSMathSum values as well.
      if (!parsed || (parsed instanceof CSSUnitValue && parsed.unit == "number"))
        throw TypeError("Invalid end offset.");
    }
    scrollTimelineOptions.get(this).endScrollOffset = offset;
    updateInternal(this);
  }

  get endScrollOffset() {
    return scrollTimelineOptions.get(this).endScrollOffset;
  }

  set timeRange(range) {
    if (range != "auto") {
      // Check for a valid number, which if finite and not NaN.
      if (typeof(range) != "number" || !Number.isFinite(range) || range != range)
        throw TypeError("Invalid timeRange value");
    }
    scrollTimelineOptions.get(this).timeRange = range;
    updateInternal(this);
  }

  get timeRange() {
    return scrollTimelineOptions.get(this).timeRange;
  }

  get phase() {
    // Per https://drafts.csswg.org/scroll-animations-1/#phase-algorithm
    // Step 1
    let unresolved = null;
    if (!this.scrollSource) return "inactive";
    let startOffset = calculateScrollOffset(
      new CSSUnitValue(0, 'percent'),
      this.scrollSource,
      this.orientation,
      this.startScrollOffset,
      scrollTimelineOptions.get(this).startScrollOffsetFunction
    );
    let endOffset = calculateScrollOffset(
      new CSSUnitValue(100, 'percent'),
      this.scrollSource,
      this.orientation,
      this.endScrollOffset,
      scrollTimelineOptions.get(this).endScrollOffsetFunction
    );
    let effectiveScrollRange = endOffset - startOffset;
    if (effectiveScrollRange <= 0)
      return "inactive";

    // Step 2
    // TODO: Support other writing directions.
    let currentScrollOffset = this.scrollSource.scrollTop
    if (this.orientation === 'inline' || this.orientation === 'horizontal') {
      currentScrollOffset = this.scrollSource.scrollLeft
    }

    // Step 3
    if (currentScrollOffset < startOffset)
      return "before";
    if (currentScrollOffset >= endOffset)
      return "after";
    return "active"
  }

  get currentTime() {
    // Per https://wicg.github.io/scroll-animations/#current-time-algorithm
    // Step 1
    let unresolved = null;
    if (!this.scrollSource) return unresolved;
    let startOffset = calculateScrollOffset(
      new CSSUnitValue(0, 'percent'),
      this.scrollSource,
      this.orientation,
      this.startScrollOffset,
      scrollTimelineOptions.get(this).startScrollOffsetFunction
    );
    let endOffset = calculateScrollOffset(
      new CSSUnitValue(100, 'percent'),
      this.scrollSource,
      this.orientation,
      this.endScrollOffset,
      scrollTimelineOptions.get(this).endScrollOffsetFunction
    );
    let timeRange = calculateTimeRange(this);

    // Step 2
    // TODO: Support other writing directions.
    let currentScrollOffset = this.scrollSource.scrollTop
    if (this.orientation === 'inline' || this.orientation === 'horizontal') {
      currentScrollOffset = this.scrollSource.scrollLeft
    }

    // Step 3
    if (currentScrollOffset < startOffset)
      return 0;

    // Step 4
    if (currentScrollOffset >= endOffset)
      return timeRange;

    // Step 5
    return (
      ((currentScrollOffset - startOffset) / (endOffset - startOffset)) *
      timeRange
    );
  }

  get __polyfill() {
    return true;
  }
}
