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
  const details = scrollTimelineOptions.get(timeline);
  const oldSource = details.source;
  const oldScrollListener = details.scrollListener;
  if (oldSource == source)
    return;

  if (oldSource && oldScrollListener) {
    scrollEventSource(oldSource).removeEventListener("scroll",
                                                     oldScrollListener);
  }
  scrollTimelineOptions.get(timeline).source = source;
  if (source) {
    const listener = () => {
      updateInternal(timeline);
    };
    scrollEventSource(source).addEventListener("scroll", listener);
    details.scrollListener = listener;
  }
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

      // View timeline
      subject: null,

      // Internal members
      animations: [],
      scrollListener: null
    });
    const source =
      options && options.source !== undefined ? options.source
                                              : document.scrollingElement;
    updateSource(this, source);
    this.orientation = (options && options.orientation) || "block";
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

  get duration() {
    return CSS.percent(100);
  }

  get phase() {
    // Per https://drafts.csswg.org/scroll-animations-1/#phase-algorithm
    // Step 1
    const unresolved = null;
    //   if source is null
    const container = this.source;
    if (!container) return "inactive";
    let scrollerStyle = getComputedStyle(container);

    //   if source does not currently have a CSS layout box
    if (scrollerStyle.display == "none")
      return "inactive";

    //   if source's layout box is not a scroll container"
    if (container != document.scrollingElement &&
        (scrollerStyle.overflow == 'visible' ||
         scrollerStyle.overflow == "clip")) {
        return "inactive";
    }

    return "active"
  }

  get currentTime() {
    const unresolved = null;
    const container = this.source;
    if (!container) return unresolved;
    if (this.phase == 'inactive')
      return unresolved;

    const orientation = this.orientation;
    const scrollPos = directionAwareScrollOffset(container, orientation);
    const maxScrollPos = calculateMaxScrollOffset(container, orientation);

    return maxScrollPos > 0 ? CSS.percent(100 * scrollPos / maxScrollPos)
                            : CSS.percent(100);
  }

  get __polyfill() {
    return true;
  }
}

function getScrollParent(node) {
  if (!node)
    return undefined;

  // TODO: This is not quite correct.  Need to walk containing block chain.
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

  // TODO: Revisit once the clamping issue is resolved.
  // see github.com/w3c/csswg-drafts/issues/7432.

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
