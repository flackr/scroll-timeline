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

import * as scrolltimeline from './scroll-timeline-base.js';

let IntersectionOptions = new WeakMap();

class IntersectionBasedOffset {
  constructor(value) {
    IntersectionOptions.set(this, {});
    this.target = value.target;
    this.edge = value.edge || 'start';
    this.threshold = value.threshold || 0;
    this.rootMargin = value.rootMargin || 'auto';
  }

  set target(element) {
    if (!(element instanceof Element)) {
      IntersectionOptions.get(this).target = null;
      throw Error('Intersection target must be an element.');
    }
    IntersectionOptions.get(this).target = element;
  }
  get target() {
    return IntersectionOptions.get(this).target;
  }

  set edge(value) {
    if (['start', 'end'].indexOf(value) == -1)
      return;
    IntersectionOptions.get(this).edge = value;
  }
  get edge() {
    return IntersectionOptions.get(this).edge;
  }

  set threshold(value) {
    IntersectionOptions.get(this).threshold = parseFloat(value);
  }
  get threshold() {
    return IntersectionOptions.get(this).threshold;
  }

  set rootMargin(value) {
    // TODO: Restrict to supported value.
    IntersectionOptions.get(this).rootMargin = value;
  }
  get rootMargin() {
    return IntersectionOptions.get(this).rootMargin;
  }
};

function parseOffset(value) {
  if (value.target)
    return new IntersectionBasedOffset(value);
}

function calculateOffset(scrollSource, orientation, offset, startOrEnd) {
  // TODO: Support other writing directions.
  if (orientation == 'block')
    orientation = 'vertical';
  else if (orientation == 'inline')
    orientation = 'horizontal';
  let viewport = scrollSource == document.scrollingElement ?
      { left: 0,
        right: scrollSource.clientWidth,
        top: 0,
        bottom: scrollSource.clientHeight,
        width: scrollSource.clientWidth,
        height: scrollSource.clientHeight } :
      scrollSource.getBoundingClientRect();
  let target = offset.target.getBoundingClientRect();
  let threshold = offset.threshold;
  // Invert threshold for start position.
  if (offset.edge == 'start')
    threshold = 100 - threshold;
  // Projected point into the scroller scroll range.
  if (orientation == 'vertical') {
    let point = target.top + target.height * threshold / 100 - viewport.top + scrollSource.scrollTop;
    if (offset.edge == 'end')
      return Math.max(0, point - viewport.height);
    return Math.min(point, scrollSource.scrollHeight - viewport.height);
  } else { // orientation == 'horizontal'
    let point = target.left + target.width * threshold / 100 - viewport.left + scrollSource.scrollLeft;
    if (offset.edge == 'end')
      return Math.max(0, point - viewport.width);
    return Math.min(point, scrollSource.scrollWidth - viewport.width);
  }
}

scrolltimeline.installScrollOffsetExtension(parseOffset, calculateOffset);
