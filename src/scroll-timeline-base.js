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

import {installCSSOM} from "./proxy-cssom.js";
import {simplifyCalculation} from "./simplify-calculation";
import {normalizeAxis, splitIntoComponentValues} from './utils.js';

installCSSOM();

const DEFAULT_TIMELINE_AXIS = 'block';

let scrollTimelineOptions = new WeakMap();
let sourceDetails = new WeakMap();

export const ANIMATION_RANGE_NAMES = ['entry', 'exit', 'cover', 'contain', 'entry-crossing', 'exit-crossing'];

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
  const sourceMeasurements = sourceDetails.get(source).sourceMeasurements;
  const style = getComputedStyle(source);
  // All writing modes are vertical except for horizontal-tb.
  // TODO: sideways-lr should flow bottom to top, but is currently unsupported
  // in Chrome.
  // http://drafts.csswg.org/css-writing-modes-4/#block-flow
  let currentScrollOffset = sourceMeasurements.scrollTop;
  if (normalizeAxis(axis, style) === 'x') {
    // Negative values are reported for scrollLeft when the inline text
    // direction is right to left or for vertical text with a right to left
    // block flow. This is a consequence of shifting the scroll origin due to
    // changes in the overflow direction.
    // http://drafts.csswg.org/cssom-view/#overflow-directions.
    currentScrollOffset = Math.abs(sourceMeasurements.scrollLeft);
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
  const sourceMeasurements = sourceDetails.get(source).sourceMeasurements;
  // Only one horizontal writing mode: horizontal-tb.  All other writing modes
  // flow vertically.
  const horizontalWritingMode =
    getComputedStyle(source).writingMode == 'horizontal-tb';
  if (axis === "block")
    axis = horizontalWritingMode ? "y" : "x";
  else if (axis === "inline")
    axis = horizontalWritingMode ? "x" : "y";
  if (axis === "y")
    return sourceMeasurements.scrollHeight - sourceMeasurements.clientHeight;
  else if (axis === "x")
    return sourceMeasurements.scrollWidth - sourceMeasurements.clientWidth;
}

function resolvePx(cssValue, info) {
  const cssNumericValue = simplifyCalculation(cssValue, info);
  if (cssNumericValue instanceof CSSUnitValue) {
    if (cssNumericValue.unit === 'px') {
      return cssNumericValue.value;
    } else {
      throw TypeError("Unhandled unit type " + cssNumericValue.unit);
    }
  } else {
    throw TypeError('Unsupported value type: ' + typeof (cssValue));
  }
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

function isValidAxis(axis) {
  return ["block", "inline", "x", "y"].includes(axis);
}

/**
 * Read measurements of source element
 * @param {HTMLElement} source
 * @return {{clientWidth: *, scrollHeight: *, scrollLeft, clientHeight: *, scrollTop, scrollWidth: *}}
 */
export function measureSource (source) {
  const style = getComputedStyle(source);
  return {
    scrollLeft: source.scrollLeft,
    scrollTop: source.scrollTop,
    scrollWidth: source.scrollWidth,
    scrollHeight: source.scrollHeight,
    clientWidth: source.clientWidth,
    clientHeight: source.clientHeight,
    writingMode: style.writingMode,
    direction: style.direction,
    scrollPaddingTop: style.scrollPaddingTop,
    scrollPaddingBottom: style.scrollPaddingBottom,
    scrollPaddingLeft: style.scrollPaddingLeft,
    scrollPaddingRight: style.scrollPaddingRight
  };
}

/**
 * Measure subject element relative to source
 * @param {HTMLElement} source
 * @param {HTMLElement|undefined} subject
 * @param subject
 */
export function measureSubject(source, subject) {
  if (!source || !subject) {
    return
  }
  let top = 0;
  let left = 0;
  let node = subject;
  const ancestor = source.offsetParent;
  while (node && node != ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  left -= source.offsetLeft + source.clientLeft;
  top -= source.offsetTop + source.clientTop;
  const style = getComputedStyle(subject);
  return {
    top,
    left,
    offsetWidth: subject.offsetWidth,
    offsetHeight: subject.offsetHeight,
    fontSize: style.fontSize,
  };
}

/**
 * Update measurements of source, and update timelines
 * @param {HTMLElement} source
 */
function updateMeasurements(source) {
  let details = sourceDetails.get(source);
  details.sourceMeasurements = measureSource(source);

  // Update measurements of the subject of connected view timelines
  for (const ref of details.timelineRefs) {
    const timeline = ref.deref();
    if ((timeline instanceof ViewTimeline)) {
      const timelineDetails = scrollTimelineOptions.get(timeline)
      timelineDetails.subjectMeasurements = measureSubject(source, timeline.subject)
    }
  }

  if (details.updateScheduled)
    return;

  setTimeout(() => {
    // Schedule a task to update timelines after all measurements are completed
    for (const ref of details.timelineRefs) {
      const timeline = ref.deref();
      if (timeline) {
        updateInternal(timeline);
      }
    }

    details.updateScheduled = false;
  });
  details.updateScheduled = true;
}

function updateSource(timeline, source) {
  const timelineDetails = scrollTimelineOptions.get(timeline);
  const oldSource = timelineDetails.source;
  if (oldSource == source)
    return;

  if (oldSource) {
    const details = sourceDetails.get(oldSource);
    if (details) {
      // Remove timeline reference from old source
      details.timelineRefs.delete(timeline);

      // Clean up timeline refs that have been garbage-collected
      const undefinedRefs = Array.from(details.timelineRefs).filter(ref => typeof ref.deref() === 'undefined');
      for (const ref of undefinedRefs) {
        details.timelineRefs.delete(ref);
      }

      if (details.timelineRefs.size === 0) {
        // All timelines have been disconnected from the source
        // Clean up
        details.disconnect();
        sourceDetails.delete(oldSource);
      }
    }
  }
  timelineDetails.source = source;
  if (source) {
    let details = sourceDetails.get(source);
    if (!details) {
      // This is the first timeline for this source
      // Store a set of weak refs to connected timelines and current measurements
      details = {
        timelineRefs: new Set(),
        sourceMeasurements: measureSource(source)
      };
      sourceDetails.set(source, details);

      // Use resize observer to detect changes to source size
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateMeasurements(timelineDetails.source)
        }
      });
      resizeObserver.observe(source);
      for (const child of source.children) {
        resizeObserver.observe(child)
      }

      // Use mutation observer to detect updated style attributes on source element
      const mutationObserver = new MutationObserver((records) => {
        for (const record of records) {
          updateMeasurements(record.target);
        }
      });
      mutationObserver.observe(source, {attributes: true, attributeFilter: ['style', 'class']});

      const scrollListener = () => {
        // Sample and store scroll pos
        details.sourceMeasurements.scrollLeft = source.scrollLeft;
        details.sourceMeasurements.scrollTop = source.scrollTop;

        for (const ref of details.timelineRefs) {
          const timeline = ref.deref();
          if (timeline) {
            updateInternal(timeline);
          }
        }
      };
      scrollEventSource(source).addEventListener("scroll", scrollListener);
      details.disconnect = () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        scrollEventSource(source).removeEventListener("scroll", scrollListener);
      };
    }

    // Add a weak ref to the timeline so that we can update it when the source changes
    details.timelineRefs.add(new WeakRef(timeline));
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
  queueMicrotask(() => {
    updateInternal(scrollTimeline);
  });
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
      inset: null,

      // Internal members
      animations: [],
      subjectMeasurements: null
    });
    const source =
      options && options.source !== undefined ? options.source
                                              : document.scrollingElement;
    updateSource(this, source);

    if ((options && options.axis !== undefined) &&
        (options.axis != DEFAULT_TIMELINE_AXIS)) {
      if (!isValidAxis(options.axis)) {
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
    if (!isValidAxis(axis)) {
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
    if (!container || !container.isConnected) return unresolved;
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
  switch (sourceType) {
    case 'root':
      return document.scrollingElement;
    case 'nearest':
      return getScrollParent(node);
    case 'self':
      return node;
    default:
      throw new TypeError('Invalid ScrollTimeline Source Type.');
  }
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
  if (!node || !node.isConnected)
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
export function range(timeline, phase) {
  const details = scrollTimelineOptions.get(timeline);
  const subjectMeasurements = details.subjectMeasurements
  const sourceMeasurements = sourceDetails.get(details.source).sourceMeasurements

  const unresolved = null;
  if (timeline.phase === 'inactive')
    return unresolved;

  if (!(timeline instanceof ViewTimeline))
    return unresolved;

  return calculateRange(phase, sourceMeasurements, subjectMeasurements, details.axis, details.inset);
}

export function calculateRange(phase, sourceMeasurements, subjectMeasurements, axis, optionsInset) {
  // TODO: handle position sticky

  // Determine the view and container size based on the scroll direction.
  // The view position is the scroll position of the logical starting edge
  // of the view.
  const rtl = sourceMeasurements.direction == 'rtl' || sourceMeasurements.writingMode == 'vertical-rl';
  let viewSize = undefined;
  let viewPos = undefined;
  let sizes = {
    fontSize: subjectMeasurements.fontSize
  };
  if (normalizeAxis(axis, sourceMeasurements) === 'x') {
    viewSize = subjectMeasurements.offsetWidth;
    viewPos = subjectMeasurements.left;
    sizes.scrollPadding = [sourceMeasurements.scrollPaddingLeft, sourceMeasurements.scrollPaddingRight];
    if (rtl) {
      viewPos += sourceMeasurements.scrollWidth - sourceMeasurements.clientWidth;
      sizes.scrollPadding = [sourceMeasurements.scrollPaddingRight, sourceMeasurements.scrollPaddingLeft];
    }
    sizes.containerSize = sourceMeasurements.clientWidth;
  } else {
    // TODO: support sideways-lr
    viewSize = subjectMeasurements.offsetHeight;
    viewPos = subjectMeasurements.top;
    sizes.scrollPadding = [sourceMeasurements.scrollPaddingTop, sourceMeasurements.scrollPaddingBottom];
    sizes.containerSize = sourceMeasurements.clientHeight;
  }

  const inset = calculateInset(optionsInset, sizes);

  // Cover:
  // 0% progress represents the position at which the start border edge of the
  // element’s principal box coincides with the end edge of its view progress
  // visibility range.
  // 100% progress represents the position at which the end border edge of the
  // element’s principal box coincides with the start edge of its view progress
  // visibility range.
  const coverStartOffset = viewPos - sizes.containerSize + inset.end;
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
  // Take inset into account when determining the scrollport size
  const adjustedScrollportSize = sizes.containerSize - inset.start - inset.end;
  const subjectIsLargerThanScrollport = viewSize > adjustedScrollportSize;

  const resolvedPhase = ANIMATION_RANGE_NAMES.includes(phase) ? phase : 'cover'
  switch(resolvedPhase) {
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
      endOffset = subjectIsLargerThanScrollport ? containEndOffset : containStartOffset;
      break;

    case 'exit-crossing':
      startOffset = subjectIsLargerThanScrollport ? containStartOffset : containEndOffset;
      endOffset = coverEndOffset;
      break;
  }
  return { start: startOffset, end: endOffset };
}

function parseInset(value) {
  const inset = { start: 0, end: 0 };

  if (!value) return inset;

  let parts;
  // Parse string parts to
  if (typeof value === 'string') {
    parts = splitIntoComponentValues(value).map(str => {
      if (str === 'auto') {
        return 'auto';
      }
      try {
        return CSSNumericValue.parse(str);
      } catch (e) {
        throw TypeError(`Could not parse inset "${value}"`);
      }
    });
  } else if (Array.isArray(value)) {
    parts = value;
  } else {
    parts = [value];
  }
  if (parts.length === 0 || parts.length > 2) {
    throw TypeError('Invalid inset');
  }

  // Validate that the parts are 'auto' or <length-percentage>
  for (const part of parts) {
    if (part === 'auto') {
      continue;
    }
    const type = part.type();
    if (!(type.length === 1 || type.percent === 1)) {
      throw TypeError('Invalid inset');
    }
  }

  return {
    start: parts[0],
    end: parts[1] ?? parts[0]
  };
}

function calculateInset(value, sizes) {
  const inset = { start: 0, end: 0 };

  if (!value) return inset;

  const [start, end] = [value.start, value.end].map((part, i) => {
    if (part === 'auto') {
      return sizes.scrollPadding[i] === 'auto' ? 0 : parseFloat(sizes.scrollPadding[i]);
    }

    return resolvePx(part, {
      percentageReference: CSS.px(sizes.containerSize),
      fontSize: CSS.px(parseFloat(sizes.fontSize))
    })
  });

  return { start, end };
}

// Calculate the fractional offset of a range value relative to the normal range.
export function fractionalOffset(timeline, value) {
  if (timeline instanceof ViewTimeline) {
    const { rangeName, offset } = value;

    const phaseRange = range(timeline, rangeName);
    const coverRange = range(timeline, 'cover');

    return calculateRelativePosition(phaseRange, offset, coverRange, timeline.subject);
  }

  if (timeline instanceof ScrollTimeline) {
    const { axis, source } = timeline;
    const { sourceMeasurements } = sourceDetails.get(source);

    let sourceScrollDistance = undefined;
    if (normalizeAxis(axis, sourceMeasurements) === 'x') {
      sourceScrollDistance = sourceMeasurements.scrollWidth - sourceMeasurements.clientWidth;
    } else {
      sourceScrollDistance = sourceMeasurements.scrollHeight - sourceMeasurements.clientHeight;
    }

    // TODO: pass relative measurements (viewport, font-size, root font-size, etc. ) to resolvePx() to resolve relative units
    const position = resolvePx(value.offset, {percentageReference: CSS.px(sourceScrollDistance)});
    const fractionalOffset = position / sourceScrollDistance;

    return fractionalOffset;
  }

  unsupportedTimeline(timeline);
}

export function calculateRelativePosition(phaseRange, offset, coverRange, subject) {
  if (!phaseRange || !coverRange)
    return 0;

  let style = getComputedStyle(subject)
  const info = {
    percentageReference: CSS.px(phaseRange.end - phaseRange.start),
    fontSize: CSS.px(parseFloat(style.fontSize))
  };

  const offsetPX = resolvePx(offset, info) + phaseRange.start;
  return (offsetPX - coverRange.start) / (coverRange.end - coverRange.start);
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
    if (options && options.inset) {
      details.inset = parseInset(options.inset);
    }
    if (details.subject) {
      const resizeObserver = new ResizeObserver(() => {
        updateMeasurements(details.source)
      })
      resizeObserver.observe(details.subject)

      const mutationObserver = new MutationObserver(() => {
        updateMeasurements(details.source);
      });
      mutationObserver.observe(details.subject, {attributes: true, attributeFilter: ['class', 'style']});
    }
    validateSource(this);
    details.subjectMeasurements = measureSubject(details.source, details.subject);
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

  get startOffset() {
    return CSS.px(range(this,'cover').start);
  }

  get endOffset() {
    return CSS.px(range(this,'cover').end);
  }

}
