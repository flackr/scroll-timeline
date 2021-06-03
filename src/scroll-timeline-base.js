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

import { installCSSOM } from "./proxy-cssom.js";
installCSSOM();

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
  let timelineTime = scrollTimelineInstance.currentTime;

  for (let i = 0; i < animations.length; i++) {
    animations[i].tickAnimation(timelineTime);
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
      timeRange = Math.max(timeRange,
                           calculateTargetEffectEnd(animations[i].animation));
    }
    if (timeRange === Infinity) timeRange = 0;
  }
  return timeRange;
}

/**
 * Calculates a scroll offset that corrects for writing modes, text direction
 * and a logical orientation.
 * @param scrollTimeline {ScrollTimeline}
 * @param orientation {String}
 * @returns {Number}
 */
function directionAwareScrollOffset(scrollSource, orientation) {
  const style = getComputedStyle(scrollSource);
  // All writing modes are vertical except for horizontal-tb.
  // TODO: sideways-lr should flow bottom to top, but is currently unsupported
  // in Chrome.
  // http://drafts.csswg.org/css-writing-modes-4/#block-flow
  const horizontalWritingMode = style.writingMode == 'horizontal-tb';
  let currentScrollOffset  = scrollSource.scrollTop;
  if (orientation == 'horizontal' ||
     (orientation == 'inline' && horizontalWritingMode) ||
     (orientation == 'block' && !horizontalWritingMode)) {
    // Negative values are reported for scrollLeft when the inline text
    // direction is right to left or for vertical text with a right to left
    // block flow. This is a consequence of shifting the scroll origin due to
    // changes in the overflow direction.
    // http://drafts.csswg.org/cssom-view/#overflow-directions.
    currentScrollOffset = Math.abs(scrollSource.scrollLeft);
  }
  return currentScrollOffset;
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
  // Only one horizontal writing mode: horizontal-tb.  All other writing modes
  // flow vertically.
  const horizontalWritingMode =
    getComputedStyle(this.scrollSource).writingMode == 'horizontal-tb';
  if (orientation === "block")
    orientation = horizontalWritingMode ? "vertical" : "horizontal";
  else if (orientation === "inline")
    orientation = horizontalWritingMode ? "horizontal" : "vertical";
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
 * Resolve scroll offsets per
 * https://drafts.csswg.org/scroll-animations-1/#effective-scroll-offsets-algorithm
 * @param scrollSource {DOMElement}
 * @param orientation {String}
 * @param scrollOffsets {Array}
 * @param fns {Array}
 * @returns {Array}
 */
export function resolveScrollOffsets(
  scrollSource,
  orientation,
  scrollOffsets,
  fns
) {
  // 1. Let effective scroll offsets be an empty list of effective scroll
  // offsets.
  let effectiveScrollOffsets = [];
  // 2. Let first offset be true.
  let firstOffset = true;

  // 3. If scrollOffsets is empty
  if(scrollOffsets.length == 0) {
    // 3.1 Run the procedure to resolve a scroll timeline offset for auto with
    // the is first flag set to first offset and add the resulted value into
    // effective scroll offsets.
    effectiveScrollOffsets.push(
      calculateScrollOffset(
        new CSSUnitValue(0, 'percent'),
        scrollSource,
        orientation,
        AUTO
    ));
    // 3.2 Set first offset to false.
    firstOffset = false;
    // 3.3 Run the procedure to resolve a scroll timeline offset for auto with
    // the is first flag set to first offset and add the resulted value into
    // effective scroll offsets.
    effectiveScrollOffsets.push(
      calculateScrollOffset(
        new CSSUnitValue(100, 'percent'),
        scrollSource,
        orientation,
        AUTO
    ));
  }
  // 4. If scrollOffsets has exactly one element
  else if(scrollOffsets.length == 1) {
    // 4.1 Run the procedure to resolve a scroll timeline offset for auto with
    // the is first flag set to first offset and add the resulted value into
    // effective scroll offsets.
    effectiveScrollOffsets.push(
      calculateScrollOffset(
        new CSSUnitValue(0, 'percent'),
        scrollSource,
        orientation,
        AUTO
    ));
    // 4.2 Set first offset to false.
    firstOffset = false;
  }
  // 5. For each scroll offset in the list of scrollOffsets, perform the
  // following steps:
  for (let i = 0; i < scrollOffsets.length; i++) {
    // 5.1 Let effective offset be the result of applying the procedure
    // to resolve a scroll timeline offset for scroll offset with the is
    // first flag set to first offset.
    let effectiveOffset = calculateScrollOffset(
      firstOffset ? new CSSUnitValue(0, 'percent') : new CSSUnitValue(100, 'percent'),
      scrollSource,
      orientation,
      scrollOffsets[i],
      fns[i]);
    //  5.2 If effective offset is null, the effective scroll offsets is empty and abort the remaining steps.
    if(effectiveOffset === null)
      return [];
    // 5.3 Add effective offset into effective scroll offsets.
    effectiveScrollOffsets.push(effectiveOffset);
    // 5.4 Set first offset to false.
    firstOffset = false;
  }
  // 6. Return effective scroll offsets.
  return effectiveScrollOffsets;
}

/**
 * Compute scroll timeline progress per
 * https://drafts.csswg.org/scroll-animations-1/#progress-calculation-algorithm
 * @param offset {number}
 * @param scrollOffsets {Array}
 * @returns {number}
 */
export function ComputeProgress(
  offset,
  scrollOffsets
) {
  // 1. Let scroll offsets be the result of applying the procedure to resolve
  // scroll timeline offsets for scrollOffsets.
  // 2. Let offset index correspond to the position of the last offset in
  // scroll offsets whose value is less than or equal to offset and the value
  // at the following position greater than offset.
  let offsetIndex;
  for (offsetIndex = scrollOffsets.length - 2;
       offsetIndex >= 0 && 
         !(scrollOffsets[offsetIndex] <= offset && offset < scrollOffsets[offsetIndex + 1]);
       offsetIndex--) {
  }
  // 3. Let start offset be the offset value at position offset index in
  // scroll offsets.
  let startOffset = scrollOffsets[offsetIndex];
  // 4. Let end offset be the value of next offset in scroll offsets after
  // start offset.
  let endOffset = scrollOffsets[offsetIndex + 1];
  // 5. Let size be the number of offsets in scroll offsets.
  let size = scrollOffsets.length;
  // 6. Let offset weight be the result of evaluating 1 / (size - 1).
  let offsetWeight = 1 / (size - 1);
  // 7. Let interval progress be the result of evaluating
  // (offset - start offset) / (end offset - start offset).
  let intervalProgress =  (offset - startOffset) / (endOffset - startOffset);
  // 8. Return the result of evaluating
  // (offset index + interval progress) × offset weight.
  return (offsetIndex + intervalProgress) * offsetWeight;
}

/**
 * Removes a Web Animation instance from ScrollTimeline
 * @param scrollTimeline {ScrollTimeline}
 * @param animation {Animation}
 * @param options {Object}
 */
export function removeAnimation(scrollTimeline, animation) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  for (let i = 0; i < animations.length; i++) {
    if (animations[i].animation == animation) {
      animations.splice(i, 1);
    }
  }
}

/**
 * Attaches a Web Animation instance to ScrollTimeline.
 * @param scrollTimeline {ScrollTimeline}
 * @param animation {Animation}
 * @param tickAnimation {function(number)}
 */
export function addAnimation(scrollTimeline, animation, tickAnimation) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  for (let i = 0; i < animations.length; i++) {
    if (animations[i].animation == animation)
      return;
  }

  animations.push({
    animation: animation,
    tickAnimation: tickAnimation
  });
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
      scrollOffsets: [],
      timeRange: AUTO,

      // Internal members
      animations: [],
      scrollOffsetFns: [],
    });
    this.scrollSource =
      options && options.scrollSource !== undefined ? options.scrollSource : document.scrollingElement;
    this.orientation = (options && options.orientation) || "block";
    this.scrollOffsets = options && options.scrollOffsets !== undefined ? options.scrollOffsets : [];
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

  set scrollOffsets(value) {
    let offsets = [];
    let fns = [];
    for (let input of value) {
      let fn = null;
      let offset = undefined;
      if (input == "auto")
        input = AUTO;
      for (let i = 0; i < extensionScrollOffsetFunctions.length; i++) {
        let result = extensionScrollOffsetFunctions[i].parse(input);
        if (result !== undefined) {
          offset = result;
          fn = extensionScrollOffsetFunctions[i].evaluate;
          break;
        }
      }
      if (!fn) {
        if (input != AUTO) {
          let parsed = parseLength(input);
          // TODO: This should check CSSMathSum values as well.
          if (!parsed || (parsed instanceof CSSUnitValue && parsed.unit == "number"))
            throw TypeError("Invalid scrollOffsets entry.");
        }
        offset = input;
      }
      offsets.push(offset);
      fns.push(fn);
    }
    if (offsets.length == 1 && offsets[0] == AUTO)
      throw TypeError("Invalid scrollOffsets value.");
    let data = scrollTimelineOptions.get(this);
    data.scrollOffsets = offsets;
    data.scrollOffsetFns = fns;
    updateInternal(this);
  }

  get scrollOffsets() {
    let data = scrollTimelineOptions.get(this);
    return data.scrollOffsets;
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
    //   if source is null
    if (!this.scrollSource) return "inactive";
    let scrollerStyle = getComputedStyle(this.scrollSource);

    //   if source does not currently have a CSS layout box
    if (scrollerStyle.display == "none")
      return "inactive";

    //   if source's layout box is not a scroll container"
    if (this.scrollSource != document.scrollingElement &&
        (scrollerStyle.overflow == 'visible' ||
         scrollerStyle.overflow == "clip")) {
        return "inactive";
    }

    let effectiveScrollOffsets = resolveScrollOffsets(
      this.scrollSource,
      this.orientation,
      this.scrollOffsets,
      scrollTimelineOptions.get(this).scrollOffsetFns
    );

    //   if source's effective scroll range is null
    if (effectiveScrollOffsets.length == 0)
      return "inactive";

    let maxOffset = calculateScrollOffset(
      new CSSUnitValue(100, 'percent'),
      this.scrollSource,
      this.orientation,
      new CSSUnitValue(100, 'percent'),
      null
    );
    let startOffset = effectiveScrollOffsets[0];
    let endOffset = effectiveScrollOffsets[effectiveScrollOffsets.length - 1];

    // Step 2
    const currentScrollOffset =
        directionAwareScrollOffset(this.scrollSource, this.orientation);

    // Step 3
    if (currentScrollOffset < startOffset)
      return "before";
    if (currentScrollOffset >= endOffset && endOffset < maxOffset)
      return "after";
    return "active"
  }

  get currentTime() {
    // Per https://wicg.github.io/scroll-animations/#current-time-algorithm
    // Step 1
    let unresolved = null;
    if (!this.scrollSource) return unresolved;
    if (this.phase == 'inactive')
      return unresolved;

    let effectiveScrollOffsets = resolveScrollOffsets(
      this.scrollSource,
      this.orientation,
      this.scrollOffsets,
      scrollTimelineOptions.get(this).scrollOffsetFns
    );
    let startOffset = effectiveScrollOffsets[0];
    let endOffset = effectiveScrollOffsets[effectiveScrollOffsets.length - 1];
    let timeRange = calculateTimeRange(this);

    // Step 2
    const currentScrollOffset =
        directionAwareScrollOffset(this.scrollSource, this.orientation);

    // Step 3
    if (currentScrollOffset < startOffset)
      return 0;

    // Step 4
    if (currentScrollOffset >= endOffset)
      return timeRange;

    // Step 5
    let progress = ComputeProgress(
      currentScrollOffset,
      effectiveScrollOffsets
    );
    return progress * timeRange;
  }

  get __polyfill() {
    return true;
  }
}
