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

import { installCSSOM } from "./proxy-cssom.js";
installCSSOM();

const DEFAULT_TIMELINE_AXIS = 'block';

let scrollTimelineOptions = new WeakMap();

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
 * and a logical axis.
 * @param scrollTimeline {ScrollTimeline}
 * @param axis {String}
 * @returns {Number}
 */
function directionAwareScrollOffset(source, axis) {
  if (!source)
    return null;

  const style = getComputedStyle(source);
  // All writing modes are vertical except for horizontal-tb.
  // TODO: sideways-lr should flow bottom to top, but is currently unsupported
  // in Chrome.
  // http://drafts.csswg.org/css-writing-modes-4/#block-flow
  const horizontalWritingMode = style.writingMode == 'horizontal-tb';
  let currentScrollOffset  = source.scrollTop;
  if (axis == 'x' ||
     (axis == 'inline' && horizontalWritingMode) ||
     (axis == 'block' && !horizontalWritingMode)) {
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
 * Calculates scroll offset based on axis and source geometry
 * @param source {DOMElement}
 * @param axis {String}
 * @returns {number}
 */
export function calculateMaxScrollOffset(source, axis) {
  // Only one horizontal writing mode: horizontal-tb.  All other writing modes
  // flow vertically.
  const horizontalWritingMode =
    getComputedStyle(source).writingMode == 'horizontal-tb';
  if (axis === "block")
    axis = horizontalWritingMode ? "y" : "x";
  else if (axis === "inline")
    axis = horizontalWritingMode ? "x" : "y";
  if (axis === "y")
    return source.scrollHeight - source.clientHeight;
  else if (axis === "x")
    return source.scrollWidth - source.clientWidth;
}

function resolvePx(cssValue, resolvedLength) {
  if (cssValue instanceof CSSUnitValue) {
    // TODO: Add support for em, vh
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
  } else if (cssValue instanceof CSSMathNegate) {
    return -resolvePx(cssValue.value, resolvedLength);
  } 
  throw TypeError("Unsupported value type: " + typeof(cssValue));
}

// Detects if the cached source is obsolete, and updates if required
// to ensure the new source has a scroll listener.
function validateSource(timeline) {
  if (!(timeline instanceof ViewTimeline)) {
    validateAnonymousSource(timeline);
    return;
  }

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

  const source = getScrollParent(node);
  updateSource(timeline, source);
}

function validateAnonymousSource(timeline) {
  const details = scrollTimelineOptions.get(timeline);
  if(!details.anonymousSource)
    return;

  const source = getAnonymousSourceElement(details.anonymousSource, details.anonymousTarget);
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
    // @TODO: This early return causes issues when a page with the polyfill
    // is loaded from the BFCache. Ideally, this code gets fixed instead of
    // the workaround which clears the proxyAnimations cache on pagehide.
    // See https://github.com/flackr/scroll-timeline/issues/146#issuecomment-1698159183
    // for details.
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
      axis: DEFAULT_TIMELINE_AXIS,
      anonymousSource: (options ? options.anonymousSource : null),
      anonymousTarget: (options ? options.anonymousTarget : null),

      // View timeline
      subject: null,
      inset: (options ? options.inset : null),

      // Internal members
      animations: [],
      scrollListener: null
    });
    const source =
      options && options.source !== undefined ? options.source
                                              : document.scrollingElement;
    updateSource(this, source);

    if ((options && options.axis !== undefined) && 
        (options.axis != DEFAULT_TIMELINE_AXIS)) {
      if (!ScrollTimeline.isValidAxis(options.axis)) {
        throw TypeError("Invalid axis");
      }

      scrollTimelineOptions.get(this).axis = options.axis;
    }

    updateInternal(this);
  }

  set source(element) {
    updateSource(this, element);
    updateInternal(this);
  }

  get source() {
    return scrollTimelineOptions.get(this).source;
  }

  set axis(axis) {
    if (!ScrollTimeline.isValidAxis(axis)) {
      throw TypeError("Invalid axis");
    }

    scrollTimelineOptions.get(this).axis = axis;
    updateInternal(this);
  }

  get axis() {
    return scrollTimelineOptions.get(this).axis;
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
    const scrollerStyle = getComputedStyle(container);
    if (
      scrollerStyle.display === "inline" ||
      scrollerStyle.display === "none"
    ) {
      return unresolved;
    }

    const axis = this.axis;
    const scrollPos = directionAwareScrollOffset(container, axis);
    const maxScrollPos = calculateMaxScrollOffset(container, axis);

    return maxScrollPos > 0 ? CSS.percent(100 * scrollPos / maxScrollPos)
                            : CSS.percent(100);
  }

  get __polyfill() {
    return true;
  }

  static isValidAxis(axis) {
    return ["block", "inline", "x", "y"].includes(axis);
  }
}

// Methods for calculation of the containing block.
// See https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block.

function findClosestAncestor(element, matcher) {
  let candidate = element.parentElement;
  while(candidate != null) {
    if (matcher(candidate))
      return candidate;
    candidate = candidate.parentElement;
  }
}

export function getAnonymousSourceElement(sourceType, node) {
  return sourceType == 'root' ? document.scrollingElement : getScrollParent(node);
}

function isBlockContainer(element) {
  const style = getComputedStyle(element);
  switch (style.display) {
    case 'block':
    case 'inline-block':
    case 'list-item':
    case 'table':
    case 'table-caption':
    case 'flow-root':
    case 'flex':
    case 'grid':
      return true;
  }

  return false;
}

function isFixedElementContainer(element) {
  const style = getComputedStyle(element);
  if (style.transform != 'none' || style.perspective != 'none')
    return true;

  if (style.willChange == 'transform' || style.willChange == 'perspective')
    return true;

  if (style.filter != 'none' || style.willChange == 'filter')
    return true;

  if (style.backdropFilter != 'none')
    return true;

  return false;
}

function isAbsoluteElementContainer(element) {
  const style = getComputedStyle(element);
  if (style.position != 'static')
    return true;

  return isFixedElementContainer(element);
}

function getContainingBlock(element) {
  switch (getComputedStyle(element).position) {
    case 'static':
    case 'relative':
    case 'sticky':
      return findClosestAncestor(element, isBlockContainer);

    case 'absolute':
      return findClosestAncestor(element, isAbsoluteElementContainer);

    case 'fixed':
      return findClosestAncestor(element, isFixedElementContainer);
  }
}

export function getScrollParent(node) {
  if (!node)
    return undefined;

  while (node = getContainingBlock(node)) {
    const style = getComputedStyle(node);
    switch(style['overflow-x']) {
      case 'auto':
      case 'scroll':
      case 'hidden':
        // https://drafts.csswg.org/css-overflow-3/#overflow-propagation
        // The UA must apply the overflow from the root element to the viewport;
        // however, if the overflow is visible in both axis, then the overflow
        // of the first visible child body is applied instead.
        if (node == document.body &&
            getComputedStyle(document.scrollingElement).overflow == "visible")
          return  document.scrollingElement;

        return node;
    }
  }
  return document.scrollingElement;
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

  return calculateRange(phase, container, target, details.axis, details.inset);
}

export function calculateRange(phase, container, target, axis, optionsInset) {
  // TODO: handle position sticky
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
  if (axis == 'x' ||
      (axis == 'inline' && horizontalWritingMode) ||
      (axis == 'block' && !horizontalWritingMode)) {
    viewSize = target.offsetWidth;
    viewPos = left;
    if (rtl)
      viewPos += container.scrollWidth - container.clientWidth;
    containerSize = container.clientWidth;
  } else {
    // TODO: support sideways-lr
    viewSize = target.offsetHeight;
    viewPos = top;
    containerSize = container.clientHeight;
  }

  const inset = parseInset(optionsInset, containerSize);

  // Cover:
  // 0% progress represents the position at which the start border edge of the
  // element’s principal box coincides with the end edge of its view progress
  // visibility range.
  // 100% progress represents the position at which the end border edge of the
  // element’s principal box coincides with the start edge of its view progress
  // visibility range.
  const coverStartOffset = viewPos - containerSize + inset.end;
  const coverEndOffset = viewPos + viewSize - inset.start;

  // Contain:
  // The 0% progress represents the earlier of the following positions:
  // 1. The start border edge of the element’s principal box coincides with
  //    the start edge of its view progress visibility range.
  // 2. The end border edge of the element’s principal box coincides with
  //    the end edge of its view progress visibility range.
  // The 100% progress represents the greater of the following positions:
  // 1. The start border edge of the element’s principal box coincides with
  //  the start edge of its view progress visibility range.
  // 2. The end border edge of the element’s principal box coincides with
  //    the end edge of its view progress visibility range.
  const alignStartOffset = coverStartOffset + viewSize;
  const alignEndOffset = coverEndOffset - viewSize;
  const containStartOffset = Math.min(alignStartOffset, alignEndOffset);
  const containEndOffset = Math.max(alignStartOffset, alignEndOffset);

  // Entry and Exit bounds align with cover and contains bounds.

  let startOffset = undefined;
  let endOffset = undefined;
  const targetIsTallerThanContainer = viewSize > containerSize ? true : false;

  switch(phase) {
    case 'cover':
      startOffset = coverStartOffset;
      endOffset = coverEndOffset;
      break;

    case 'contain':
      startOffset = containStartOffset;
      endOffset = containEndOffset;
      break;

    case 'entry':
      startOffset = coverStartOffset;
      endOffset = containStartOffset;
      break;

    case 'exit':
      startOffset = containEndOffset;
      endOffset = coverEndOffset;
      break;

    case 'entry-crossing':
      startOffset = coverStartOffset;
      endOffset = targetIsTallerThanContainer ? containEndOffset : containStartOffset;
      break;

    case 'exit-crossing':
      startOffset = targetIsTallerThanContainer ? containStartOffset : containEndOffset;
      endOffset = coverEndOffset;
      break;
  }

  return { start: startOffset, end: endOffset };
}

function parseInset(value, containerSize) {
  const inset = { start: 0, end: 0 };

  if(!value)
    return inset;

  const parts = value.split(' ');
  const insetParts = [];
  parts.forEach(part => {
    // TODO: Add support for relative lengths (e.g. em)
    if(part.endsWith("%"))
      insetParts.push(containerSize / 100 * parseFloat(part));
    else if(part.endsWith("px"))
      insetParts.push(parseFloat(part));
    else if(part === "auto")
      insetParts.push(0);
    else
      throw TypeError("Unsupported inset. Only % and px values are supported (for now).");
  });

  if (insetParts.length > 2) {
    throw TypeError("Invalid inset");
  }

  if(insetParts.length == 1) {
    inset.start = insetParts[0];
    inset.end = insetParts[0];
  } else if(insetParts.length == 2) {
    inset.start = insetParts[0];
    inset.end = insetParts[1];
  }

  return inset;
}

// Calculate the fractional offset of a (phase, percent) pair relative to the
// full cover range.
export function relativePosition(timeline, phase, percent) {
  const phaseRange = range(timeline, phase);
  const coverRange = range(timeline, 'cover');
  return calculateRelativePosition(phaseRange, percent, coverRange);
}

export function calculateRelativePosition(phaseRange, percent, coverRange) {
  if (!phaseRange || !coverRange)
    return 0;

  const fraction = percent.value / 100;
  const offset =
      (phaseRange.end - phaseRange.start) * fraction + phaseRange.start;
  return (offset - coverRange.start) / (coverRange.end - coverRange.start);
}

// https://drafts.csswg.org/scroll-animations-1/#view-progress-timelines
export class ViewTimeline extends ScrollTimeline {
  // As specced, ViewTimeline has a subject and a source, but
  // ViewTimelineOptions only has source. Furthermore, there is a strict
  // relationship between subject and source (source is nearest scrollable
  // ancestor of subject).

  // Proceeding under the assumption that subject will be added to
  // ViewTimelineOptions. Inferring the source from the subject if not
  // explicitly set.
  constructor(options) {
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

  // The axis is called "axis" for a view timeline.
  // Internally we still call it axis.
  get axis() {
    return scrollTimelineOptions.get(this).axis;
  }

  get currentTime() {
    const unresolved = null;
    const scrollPos = directionAwareScrollOffset(this.source, this.axis);
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
