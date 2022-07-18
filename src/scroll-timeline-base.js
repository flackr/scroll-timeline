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

function scrollEventSource(source) {
  if (source === document.scrollingElement) return document;
  return source;
}

/**
 * Updates the currentTime for all Web Animation instanced attached to a ScrollTimeline instance
 * @param scrollTimelineInstance {ScrollTimeline}
 */
function updateInternal(scrollTimelineInstance) {
  validateSource(scrollTimelineInstance);
  const details = scrollTimelineOptions.get(scrollTimelineInstance);
  let animations = details.animations;
  if (animations.length === 0) return;
  let timelineTime = scrollTimelineInstance.currentTime;
  for (let i = 0; i < animations.length; i++) {
    animations[i].tickAnimation(timelineTime);
  }
}

/**
 * Calculates a scroll offset that corrects for writing modes, text direction
 * and a logical orientation.
 * @param scrollTimeline {ScrollTimeline}
 * @param orientation {String}
 * @returns {Number}
 */
function directionAwareScrollOffset(source, orientation) {
  if (!source)
    return null;

  const style = getComputedStyle(source);
  // All writing modes are vertical except for horizontal-tb.
  // TODO: sideways-lr should flow bottom to top, but is currently unsupported
  // in Chrome.
  // http://drafts.csswg.org/css-writing-modes-4/#block-flow
  const horizontalWritingMode = style.writingMode == 'horizontal-tb';
  let currentScrollOffset  = source.scrollTop;
  if (orientation == 'horizontal' ||
     (orientation == 'inline' && horizontalWritingMode) ||
     (orientation == 'block' && !horizontalWritingMode)) {
    // Negative values are reported for scrollLeft when the inline text
    // direction is right to left or for vertical text with a right to left
    // block flow. This is a consequence of shifting the scroll origin due to
    // changes in the overflow direction.
    // http://drafts.csswg.org/cssom-view/#overflow-directions.
    currentScrollOffset = Math.abs(source.scrollLeft);
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
 * Calculates scroll offset based on orientation and source geometry
 * @param source {DOMElement}
 * @param orientation {String}
 * @returns {number}
 */
export function calculateMaxScrollOffset(source, orientation) {
  // Only one horizontal writing mode: horizontal-tb.  All other writing modes
  // flow vertically.
  const horizontalWritingMode =
    getComputedStyle(source).writingMode == 'horizontal-tb';
  if (orientation === "block")
    orientation = horizontalWritingMode ? "vertical" : "horizontal";
  else if (orientation === "inline")
    orientation = horizontalWritingMode ? "horizontal" : "vertical";
  if (orientation === "vertical")
    return source.scrollHeight - source.clientHeight;
  else if (orientation === "horizontal")
    return source.scrollWidth - source.clientWidth;
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

// Detects if the cached source is obsolete, and updates if required
// to ensure the new source has a scroll listener.
function validateSource(timeline) {
  if (!(timeline instanceof ViewTimeline))
    return;

  const node = timeline.subject;
  if (!node) {
    updateSource(timeline, null);
    return;
  }

  const display  = getComputedStyle(node).display;
  if (display == 'none') {
    updateSource(timeline, null);
    return;
  }

  const source = getScrollParent(node.parentNode);
  updateSource(timeline, source);
}

function updateSource(timeline, source) {
  const oldSource = scrollTimelineOptions.get(timeline).source;
  if (oldSource == source)
    return;

  const listener = () => {
    updateInternal(timeline);
  };
  if (oldSource)
    scrollEventSource(oldSource).removeEventListener("scroll", listener);
  scrollTimelineOptions.get(timeline).source = source;
  if (source)
    scrollEventSource(source).addEventListener("scroll", listener);
}

export function calculateScrollOffset(
  autoValue,
  source,
  orientation,
  offset,
  fn
) {
  if (fn)
    return fn(
      source,
      orientation,
      offset,
      autoValue.value == 0 ? "start" : "end"
    );
  // TODO: Support other writing directions.
  if (orientation === "block") orientation = "vertical";
  else if (orientation === "inline") orientation = "horizontal";

  let maxValue =
    orientation === "vertical"
      ? source.scrollHeight - source.clientHeight
      : source.scrollWidth - source.clientWidth;
  let parsed = parseLength(offset === AUTO ? autoValue : offset);
  return resolvePx(parsed, maxValue);
}

/**
 * Resolve scroll offsets per
 * https://drafts.csswg.org/scroll-animations-1/#effective-scroll-offsets-algorithm
 * @param source {DOMElement}
 * @param orientation {String}
 * @param scrollOffsets {Array}
 * @param fns {Array}
 * @returns {Array}
 */
export function resolveScrollOffsets(
  source,
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
        source,
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
        source,
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
        source,
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
      source,
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
      source: null,
      orientation: "block",
      scrollOffsets: [],

      // View timeline
      subject: null,

      // Internal members
      animations: [],
      scrollOffsetFns: []
    });
    const source =
      options && options.source !== undefined ? options.source
                                              : document.scrollingElement;
    updateSource(this, source);
    this.orientation = (options && options.orientation) || "block";
    this.scrollOffsets = options && options.scrollOffsets !== undefined ? options.scrollOffsets : [];
    updateInternal(this);
  }

  set source(element) {
    updateSource(this, element);
    updateInternal(this);
  }

  get source() {
    return scrollTimelineOptions.get(this).source;
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

  get duration() {
    return CSS.percent(100);
  }

  get phase() {
    // Per https://drafts.csswg.org/scroll-animations-1/#phase-algorithm
    // Step 1
    let unresolved = null;
    //   if source is null
    if (!this.source) return "inactive";
    let scrollerStyle = getComputedStyle(this.source);

    //   if source does not currently have a CSS layout box
    if (scrollerStyle.display == "none")
      return "inactive";

    //   if source's layout box is not a scroll container"
    if (this.source != document.scrollingElement &&
        (scrollerStyle.overflow == 'visible' ||
         scrollerStyle.overflow == "clip")) {
        return "inactive";
    }

    let effectiveScrollOffsets = resolveScrollOffsets(
      this.source,
      this.orientation,
      this.scrollOffsets,
      scrollTimelineOptions.get(this).scrollOffsetFns
    );

    //   if source's effective scroll range is null
    if (effectiveScrollOffsets.length == 0)
      return "inactive";

    let maxOffset = calculateScrollOffset(
      new CSSUnitValue(100, 'percent'),
      this.source,
      this.orientation,
      new CSSUnitValue(100, 'percent'),
      null
    );
    let startOffset = effectiveScrollOffsets[0];
    let endOffset = effectiveScrollOffsets[effectiveScrollOffsets.length - 1];

    // Step 2
    const currentScrollOffset =
        directionAwareScrollOffset(this.source, this.orientation);

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
    if (!this.source) return unresolved;
    if (this.phase == 'inactive')
      return unresolved;

    let effectiveScrollOffsets = resolveScrollOffsets(
      this.source,
      this.orientation,
      this.scrollOffsets,
      scrollTimelineOptions.get(this).scrollOffsetFns
    );
    let startOffset = effectiveScrollOffsets[0];
    let endOffset = effectiveScrollOffsets[effectiveScrollOffsets.length - 1];

    // Step 2
    const currentScrollOffset =
        directionAwareScrollOffset(this.source, this.orientation);

    // Step 3
    if (currentScrollOffset < startOffset)
      return CSS.percent(0);

    // Step 4
    if (currentScrollOffset >= endOffset)
      return CSS.percent(100);

    // Step 5
    let progress = ComputeProgress(
      currentScrollOffset,
      effectiveScrollOffsets
    );
    return CSS.percent(100 * progress);
  }

  get __polyfill() {
    return true;
  }
}

function getScrollParent(node) {
  if (!node)
    return undefined;

  if (!(node instanceof HTMLElement)) {
     return node.parentNode ? getScrollParent(node.parentNode)
                            : document.scrollingElement;
  }

  const style = getComputedStyle(node);
  switch(style['overflow-x']) {
    case 'auto':
    case 'scroll':
    case 'hidden':
      return node;

    default:
      return getScrollParent(node.parentNode);
  }
}

// ---- View timelines -----

// Computes the scroll offsets corresponding to the [0, 100]% range for a
// specific phase on a view timeline.
// TODO: Track changes to determine when associated animations require their
// timing to be renormalized.
function range(timeline, phase) {
  const details = scrollTimelineOptions.get(timeline);

  const unresolved = null;
  if (timeline.phase === 'inactive')
    return unresolved;

  if (!(timeline instanceof ViewTimeline))
    return unresolved;

  // Compute the offset of the top-left corner of subject relative to
  // top-left corner of the container.
  const container = timeline.source;
  const target = timeline.subject;

  let top = 0;
  let left = 0;
  let node = target;
  const ancestor = container.offsetParent;
  while (node && node != ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  left -= container.offsetLeft + container.clientLeft;
  top -= container.offsetTop + container.clientTop;

  // Determine the view and container size based on the scroll direction.
  // The view position is the scroll position of the logical starting edge
  // of the view.
  const style = getComputedStyle(container);
  const horizontalWritingMode = style.writingMode == 'horizontal-tb';
  const rtl = style.direction == 'rtl' || style.writingMode == 'vertical-rl';
  let viewSize = undefined;
  let viewPos = undefined;
  let containerSize = undefined;
  const orientation = details.orientation;
  if (orientation == 'horizontal' ||
      (orientation == 'inline' && horizontalWritingMode) ||
      (orientation == 'block' && !horizontalWritingMode)) {
    viewSize = target.clientWidth;
    viewPos = left;
    if (rtl)
      viewPos += container.scrollWidth - container.clientWidth;
    containerSize = container.clientWidth;
  } else {
    // TODO: support sideways-lr
    viewSize = target.clientHeight;
    viewPos = top;
    containerSize = container.clientHeight;
  }

  const scrollPos = directionAwareScrollOffset(container, orientation);
  let startOffset = undefined;
  let endOffset = undefined;

  switch(phase) {
    case 'cover':
      // Range of scroll offsets where the subject element intersects the
      // source's viewport.
      startOffset = viewPos - containerSize;
      endOffset = viewPos + viewSize;
      break;

    case 'contain':
      // Range of scroll offsets where the subject element is fully inside of
      // the container's viewport. If the subject's bounds exceed the size
      // of the viewport in the scroll direction then the scroll range is
      // empty.
      startOffset = viewPos + viewSize - containerSize;
      endOffset = viewPos;
      break;

    case 'enter':
      // Range of scroll offsets where the subject element overlaps the
      // logical-start edge of the viewport.
      startOffset = viewPos - containerSize;
      endOffset = viewPos + viewSize - containerSize;
      break;

    case 'exit':
      // Range of scroll offsets where the subject element overlaps the
      // logical-end edge of the viewport.
      startOffset = viewPos;
      endOffset = viewPos + viewSize;
      break;
  }

  // TODO: Clamping of offsets is not specced. Update once ratified.
  const maxOffset = calculateMaxScrollOffset(container, orientation);
  startOffset = Math.max(0, startOffset);
  endOffset = Math.min(maxOffset, endOffset);

  return { start: startOffset, end: endOffset };
}

// Calculate the fractional offset of a (phase, percent) pair relative to the
// full cover range.
export function relativePosition(timeline, phase, percent) {
  const phaseRange = range(timeline, phase);
  const coverRange = range(timeline, 'cover');
  if (!phaseRange || !coverRange)
    return 0;

  const fraction = percent.value / 100;
  const offset =
      (phaseRange.end - phaseRange.start) * fraction + phaseRange.start;
  return (offset - coverRange.start) / (coverRange.end - coverRange.start);
}

// https://drafts.csswg.org/scroll-animations-1/rewrite#view-progress-timelines
export class ViewTimeline extends ScrollTimeline {
  // As specced, ViewTimeline has a subject and a source, but
  // ViewTimelineOptions only has source. Furthermore, there is a strict
  // relationship between subject and source (source is nearest scrollable
  // ancestor of subject).

  // Proceeding under the assumption that subject will be added to
  // ViewTimelineOptions. Inferring the source from the subject if not
  // explicitly set.
  constructor(options) {
    if (options.axis) {
      // Orientation called axis for a view timeline. Internally we can still
      // call this orientation, since the internal naming is not exposed.
      options.orientation = options.axis;
    }
    super(options);
    const details = scrollTimelineOptions.get(this);
    details.subject = options && options.subject ? options.subject : undefined;
    // TODO: Handle insets.

    validateSource(this);
    updateInternal(this);
  }

  get source() {
    validateSource(this);
    return scrollTimelineOptions.get(this).source;
  }

  set source(source) {
    throw new Error("Cannot set the source of a view timeline");
  }

  get subject() {
    return scrollTimelineOptions.get(this).subject;
  }

  // The orientation is called "axis" for a view timeline.
  // Internally we still call it orientation.
  get axis() {
    return scrollTimelineOptions.get(this).orientation;
  }

  get phase() {
    if (!this.subject)
      return "inactive";

    const container = this.source;
    if (!container)
      return "inactive";

    let scrollerStyle = getComputedStyle(container);

    if (scrollerStyle.display == "none")
      return "inactive";

    if (container != document.scrollingElement &&
        (scrollerStyle.overflow == 'visible' ||
         scrollerStyle.overflow == "clip")) {
        return "inactive";
    }

    return "active";
  }

  get currentTime() {
    const unresolved = null;
    const scrollPos = directionAwareScrollOffset(this.source, this.orientation);
    if (scrollPos == unresolved)
      return unresolved;

    const offsets = range(this, 'cover');
    if (!offsets)
      return unresolved;
    const progress =
        (scrollPos - offsets.start) / (offsets.end - offsets.start);

    return CSS.percent(100 * progress);
  }

}
