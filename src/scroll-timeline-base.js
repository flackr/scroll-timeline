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
 * Calculates the number of milliseconds mapped to the scroll range in case of "auto"
 *  in case developer provided timeRange, we use that directly.
 * @param scrollTimeline {ScrollTimeline}
 * @returns {Number}
 */
function calculateTimeRange(scrollTimeline) {
  let timeRange = scrollTimeline.timeRange;
  if (timeRange === "auto") {
    timeRange = 0;
    let options = scrollTimelineOptions.get(scrollTimeline).animationOptions;
    for (let i = 0; i < options.length; i++) {
      timeRange = Math.max(timeRange, calculateTargetEffectEnd(options[i]));
    }
    if (timeRange === Infinity) timeRange = 0;
  }
  return timeRange;
}

// TODO: commented as it's currently not being utilized
// function removeAnimation(scrollTimeline, animation) {
//   let animations = scrollTimelineOptions.get(scrollTimeline).animations;
//   let index = animations.indexOf(animation);
//   if (index === -1) return;
//   animations.splice(index, 1);
//   scrollTimelineOptions.get(scrollTimeline).animationOptions.splice(index, 1);
// }

/**
 * Determines target effect end based on animation duration, iterations count and start and end delays
 *  returned value should always be positive
 * @param options {Object} ScrollTimeline options
 * @returns {number}
 */
export function calculateTargetEffectEnd(options) {
  if (options.iterationCount === Infinity) return Infinity;
  return Math.max(
    (options.startDelay || 0) +
      (options.duration || 0) * (options.iterationCount || 1) +
      (options.endDelay || 0),
    0
  );
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
      autoValue === "0%" ? "start" : "end"
    );
  // TODO: Support other writing directions.
  if (orientation === "block") orientation = "vertical";
  else if (orientation === "inline") orientation = "horizontal";

  let maxValue =
    orientation === "vertical"
      ? scrollSource.scrollHeight - scrollSource.clientHeight
      : scrollSource.scrollWidth - scrollSource.clientWidth;
  let parsed = parseLength(offset === "auto" ? autoValue : offset);
  if (parsed.unit === "%") return (parseFloat(parsed.value) * maxValue) / 100;
  return parseFloat(parsed.value);
}

/**
 * Attaches a Web Animation instance to ScrollTimeline
 * @param scrollTimeline {ScrollTimeline}
 * @param animation {Animation}
 * @param options {Object}
 */
export function addAnimation(scrollTimeline, animation, options) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  let animationOptions = scrollTimelineOptions.get(scrollTimeline)
    .animationOptions;
  animations.push(animation);
  animationOptions.push(options);
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
      startScrollOffset: "auto",
      endScrollOffset: "auto",
      timeRange: "auto",
      fill: "none",

      // Internal members
      animations: [],
      animationOptions: [],
    });
    this.scrollSource =
      (options && options.scrollSource) || document.scrollingElement;
    this.orientation = (options && options.orientation) || "block";
    this.startScrollOffset = (options && options.startScrollOffset) || "auto";
    this.endScrollOffset = (options && options.endScrollOffset) || "auto";
    this.timeRange = (options && options.timeRange) || "auto";
    this.fill = (options && options.fill) || "none";
  }

  set scrollSource(element) {
    if (this.scrollSource)
      scrollEventSource(this.scrollSource).removeEventListener("scroll", () =>
        updateInternal(this)
      );
    if (!(element instanceof Element)) element = document.scrollingElement;
    scrollTimelineOptions.get(this).scrollSource = element;
    scrollEventSource(element).addEventListener("scroll", () =>
      updateInternal(this)
    );
    updateInternal(this);
  }

  get scrollSource() {
    return scrollTimelineOptions.get(this).scrollSource;
  }

  set orientation(orientation) {
    if (
      ["block", "inline", "horizontal", "vertical"].indexOf(orientation) === -1
    )
      orientation = "block";
    scrollTimelineOptions.get(this).orientation = orientation;
    updateInternal(this);
  }

  get orientation() {
    return scrollTimelineOptions.get(this).orientation;
  }

  set startScrollOffset(offset) {
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
    currentStlOptions.startScrollOffset = offset;
    updateInternal(this);
  }

  get startScrollOffset() {
    return scrollTimelineOptions.get(this).startScrollOffset;
  }

  set endScrollOffset(offset) {
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
    scrollTimelineOptions.get(this).endScrollOffset = offset;
    updateInternal(this);
  }

  get endScrollOffset() {
    return scrollTimelineOptions.get(this).endScrollOffset;
  }

  set timeRange(offset) {
    scrollTimelineOptions.get(this).timeRange = offset;
    updateInternal(this);
  }

  get timeRange() {
    return scrollTimelineOptions.get(this).timeRange;
  }

  get currentTime() {
    // Per https://wicg.github.io/scroll-animations/#current-time-algorithm
    // Step 1
    let unresolved = null;
    if (!this.scrollSource) return unresolved;
    let startOffset = calculateScrollOffset(
      "0%",
      this.scrollSource,
      this.orientation,
      this.startScrollOffset,
      scrollTimelineOptions.get(this).startScrollOffsetFunction
    );
    let endOffset = calculateScrollOffset(
      "100%",
      this.scrollSource,
      this.orientation,
      this.endScrollOffset,
      scrollTimelineOptions.get(this).endScrollOffsetFunction
    );
    let timeRange = calculateTimeRange(this);

    // Step 2
    let currentScrollOffset = this.orientation === 'block'
      ? this.scrollSource.scrollTop
      : this.scrollSource.scrollLeft

    // Step 3
    if (currentScrollOffset < startOffset) {
      if (this.fill === "none" || this.fill === "forwards") return unresolved;
      return 0;
    }

    // Step 4
    if (currentScrollOffset >= endOffset) {
      if (
        endOffset <
          calculateMaxScrollOffset(this.scrollSource, this.orientation) &&
        (this.fill === "none" || this.fill === "backwards")
      ) {
        return unresolved;
      }
      return timeRange;
    }

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
