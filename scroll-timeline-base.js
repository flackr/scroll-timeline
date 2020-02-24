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

let scrollTimelineOptions = new WeakMap();

function scrollEventSource(scrollSource) {
  if (scrollSource === document.scrollingElement)
    return document;
  return scrollSource;
}

export function parseLength(str) {
  return str.trim().match(/^(-?[0-9]*\.?[0-9]*)(px|%)$/);
}

function calculateTargetEffectEnd(options) {
  if (options.iterationCount == Infinity)
    return Infinity;
  return Math.max((options.startDelay || 0) + (options.duration || 0) * (options.iterationCount || 1) + (options.endDelay || 0), 0);
}

let extensionScrollOffsetFunctions = [];
export function installScrollOffsetExtension(parseFunction, evaluateFunction) {
  extensionScrollOffsetFunctions.push([parseFunction, evaluateFunction]);
}

function calculateMaxScrollOffset(scrollSource, orientation) {
  // TODO: Support other writing directions.
  if (orientation == 'block')
    orientation = 'vertical';
  else if (orientation == 'inline')
    orientation = 'horizontal';
  if (orientation == 'vertical')
    return scrollSource.scrollHeight - scrollSource.clientHeight;
  else if (orientation == 'horizontal')
    return scrollSource.scrollWidth - scrollSource.clientWidth;

}

function calculateScrollOffset(autoValue, scrollSource, orientation, offset, fn) {
  if (fn)
    return fn(scrollSource, orientation, offset, autoValue == '0%' ? 'start' : 'end');
  // TODO: Support other writing directions.
  if (orientation == 'block')
    orientation = 'vertical';
  else if (orientation == 'inline')
    orientation = 'horizontal';

  let maxValue = orientation == 'vertical' ?
      scrollSource.scrollHeight - scrollSource.clientHeight :
      scrollSource.scrollWidth - scrollSource.clientWidth;
  let parsed = parseLength(offset == 'auto' ? autoValue : offset);
  if (parsed[2] == '%')
    return parseFloat(parsed[1]) * maxValue / 100;
  return parseFloat(parsed[1]);
}

function calculateTimeRange(scrollTimeline) {
  let timeRange = scrollTimeline.timeRange;
  if (timeRange == 'auto') {
    timeRange = 0;
    let options = scrollTimelineOptions.get(scrollTimeline).animationOptions;
    for (let i = 0; i < options.length; i++) {
      timeRange = Math.max(timeRange, calculateTargetEffectEnd(options[i]));
    }
    if (timeRange == Infinity)
      timeRange = 0;
  }
  return timeRange;
}

function updateInternal() {
  let animations = scrollTimelineOptions.get(this).animations;
  if (animations.length == 0)
    return;
  let currentTime = this.currentTime;
  for (let i = 0; i < animations.length; i++) {
    // The web-animations spec says to throw a TypeError if you try to seek to
    // an unresolved time value from a resolved time value, so to polyfill the
    // expected behavior we cancel the underlying animation.
    if (currentTime == null) {
      if (animations[i].playState == 'paused')
        animations[i].cancel();
    } else {
      animations[i].currentTime = currentTime;
    }
  }
}

function addAnimation(scrollTimeline, animation, options) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  let animationOptions = scrollTimelineOptions.get(scrollTimeline).animationOptions;
  animations.push(animation);
  animationOptions.push(options);
  updateInternal.apply(scrollTimeline);
}

function removeAnimation(scrollTimeline, animation) {
  let animations = scrollTimelineOptions.get(scrollTimeline).animations;
  let index = animations.indexOf(animation);
  if (index == -1)
    return;
  animations.splice(index, 1);
  scrollTimelineOptions.get(scrollTimeline).animationOptions.splice(index, 1);
}

export class ScrollTimeline {
  constructor(options) {
    scrollTimelineOptions.set(this, {
      scrollSource: null,
      orientation: 'block',
      startScrollOffset: 'auto',
      endScrollOffset: 'auto',
      timeRange: 'auto',

      // Internal members
      animations: [],
      animationOptions: [],
      updateFunction: updateInternal.bind(this),
    });
    this.scrollSource = options && options.scrollSource || document.scrollingElement;
    this.orientation = options && options.orientation || 'block';
    this.startScrollOffset = options && options.startScrollOffset || 'auto';
    this.endScrollOffset = options && options.endScrollOffset || 'auto';
    this.timeRange = options && options.timeRange || 'auto';
  }

  set scrollSource(element) {
    let internal = scrollTimelineOptions.get(this);
    if (this.scrollSource)
      scrollEventSource(this.scrollSource).removeEventListener('scroll', internal.updateFunction);
    if (!(element instanceof Element))
      element = document.scrollingElement;
    scrollTimelineOptions.get(this).scrollSource = element;
    scrollEventSource(element).addEventListener('scroll', internal.updateFunction);
    updateInternal.apply(this);
  }

  get scrollSource() {
    return scrollTimelineOptions.get(this).scrollSource;
  }

  set orientation(orientation) {
    if (['block', 'inline', 'horizontal', 'vertical'].indexOf(orientation) == -1)
      orientation = 'block';
    scrollTimelineOptions.get(this).orientation = orientation;
    updateInternal.apply(this);
  }

  get orientation() {
    return scrollTimelineOptions.get(this).orientation;
  }

  set startScrollOffset(offset) {
    // Allow extensions to override scroll offset calculation.
    scrollTimelineOptions.get(this).startScrollOffsetFunction = null;
    for (let i = 0; i < extensionScrollOffsetFunctions.length; i++) {
      let result = extensionScrollOffsetFunctions[i][0](offset);
      if (result !== undefined) {
        offset = result;
        scrollTimelineOptions.get(this).startScrollOffsetFunction = extensionScrollOffsetFunctions[i][1];
        break;
      }
    }
    scrollTimelineOptions.get(this).startScrollOffset = offset;
    updateInternal.apply(this);
  }

  get startScrollOffset() {
    return scrollTimelineOptions.get(this).startScrollOffset;
  }

  set endScrollOffset(offset) {
    // Allow extensions to override scroll offset calculation.
    scrollTimelineOptions.get(this).endScrollOffsetFunction = null;
    for (let i = 0; i < extensionScrollOffsetFunctions.length; i++) {
      let result = extensionScrollOffsetFunctions[i][0](offset);
      if (result !== undefined) {
        offset = result;
        scrollTimelineOptions.get(this).endScrollOffsetFunction = extensionScrollOffsetFunctions[i][1];
        break;
      }
    }
    scrollTimelineOptions.get(this).endScrollOffset = offset;
    updateInternal.apply(this);
  }

  get endScrollOffset() {
    return scrollTimelineOptions.get(this).endScrollOffset;
  }

  set timeRange(offset) {
    scrollTimelineOptions.get(this).timeRange = offset;
    updateInternal.apply(this);
  }

  get timeRange() {
    return scrollTimelineOptions.get(this).timeRange;
  }

  get currentTime() {
    // Per https://wicg.github.io/scroll-animations/#current-time-algorithm
    // Step 1
    let unresolved = null;
    if (!this.scrollSource)
      return unresolved;
    let startOffset = calculateScrollOffset('0%', this.scrollSource, this.orientation, this.startScrollOffset, scrollTimelineOptions.get(this).startScrollOffsetFunction);
    let endOffset = calculateScrollOffset('100%', this.scrollSource, this.orientation, this.endScrollOffset, scrollTimelineOptions.get(this).endScrollOffsetFunction);
    let timeRange = calculateTimeRange(this);

    // Step 2
    let currentScrollOffset = this.scrollSource.scrollTop;

    // Step 3
    if (currentScrollOffset < startOffset) {
      return 0;
    }

    // Step 4
    if (currentScrollOffset >= endOffset) {
      return timeRange;
    }

    // Step 5
    return (currentScrollOffset - startOffset) / (endOffset - startOffset) * timeRange;
  }
};

export function installPolyfill(scope) {
  scope.ScrollTimeline = ScrollTimeline;
  let nativeAnimate = scope.Element.prototype.animate;
  scope.Element.prototype.animate = function(keyframes, options) {
    let timeline = options.timeline;
    if (!timeline || !(timeline instanceof ScrollTimeline)) {
      return nativeAnimate.apply(this, arguments);
    }
    delete options.timeline;
    let animation = nativeAnimate.apply(this, arguments);
    // TODO: Create a proxy for the animation to control and fake the animation
    // play state.
    animation.pause();
    addAnimation(timeline, animation, options);
    return animation;
  };
}
