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

let IntersectionOptions = new WeakMap();

// Margin is stored as a 4 element array [top, right, bottom, left] but can be
// specified using anywhere from 1 - 4 elements. This map defines how to convert
// various length inputs to their components.
const TOP = 0;
const RIGHT = 1;
const BOTTOM = 2;
const LEFT = 3;
const MARGIN_MAP = [
  // 1 length maps to all positions.
  [[TOP, RIGHT, BOTTOM, LEFT]],
  // 2 lengths maps to vertical and horizontal margins.
  [
    [TOP, BOTTOM],
    [RIGHT, LEFT],
  ],
  // 3 lengths maps to top, horizontal, bottom margins.
  [[TOP], [RIGHT, LEFT], [BOTTOM]],
  // 4 lengths maps to each component.
  [[TOP], [RIGHT], [BOTTOM], [LEFT]],
];

class IntersectionBasedOffset {
  constructor(value) {
    IntersectionOptions.set(this, {
      target: null,
      edge: "start",
      threshold: 0,
      rootMargin: [
        [0, "px"],
        [0, "px"],
        [0, "px"],
        [0, "px"],
      ],
    });
    this.target = value.target;
    this.edge = value.edge || "start";
    this.threshold = value.threshold || 0;
    this.rootMargin = value.rootMargin || "0px 0px 0px 0px";
    this.clamp = value.clamp || false;
  }

  set target(element) {
    if (!(element instanceof Element)) {
      IntersectionOptions.get(this).target = null;
      throw Error("Intersection target must be an element.");
    }
    IntersectionOptions.get(this).target = element;
  }

  get target() {
    return IntersectionOptions.get(this).target;
  }

  set edge(value) {
    if (["start", "end"].indexOf(value) == -1) return;
    IntersectionOptions.get(this).edge = value;
  }

  get edge() {
    return IntersectionOptions.get(this).edge;
  }

  set threshold(value) {
    let threshold = parseFloat(value);
    // Throw a TypeError for a parse error.
    if (threshold != threshold)
      throw TypeError("Invalid threshold.");
    // TODO(https://crbug.com/1136516): This should throw a RangeError
    // consistent with the intersection observer spec but the current
    // test expectations are looking for a TypeError.
    if (threshold < 0 || threshold > 1)
      throw TypeError("threshold must be in the range [0, 1]");
    IntersectionOptions.get(this).threshold = threshold;
  }

  get threshold() {
    return IntersectionOptions.get(this).threshold;
  }

  set rootMargin(value) {
    let margins = value.split(/ +/);
    if (margins.length < 1 || margins.length > 4)
      throw TypeError(
        "rootMargin must contain between 1 and 4 length components"
      );
    let parsedMargins = [[], [], [], []];
    for (let i = 0; i < margins.length; i++) {
      let parsedValue = parseLength(margins[i], true);
      if (!parsedValue) throw TypeError("Unrecognized rootMargin length");
      let positions = MARGIN_MAP[margins.length - 1][i];
      for (let j = 0; j < positions.length; j++) {
        parsedMargins[positions[j]] = [
          parseFloat(parsedValue.value),
          parsedValue.unit,
        ];
      }
    }
    IntersectionOptions.get(this).rootMargin = parsedMargins;
  }

  get rootMargin() {
    // TODO: Simplify to the shortest matching specification for the given margins.
    return IntersectionOptions.get(this)
      .rootMargin.map((margin) => {
        return margin.join("");
      })
      .join(" ");
  }

  set clamp(value) {
    // This is just for testing alternative proposals - not intended to be part
    // of the specification.
    IntersectionOptions.get(this).clamp = !!value;
  }
}

export function parseOffset(value) {
  if (value.target) return new IntersectionBasedOffset(value);
}

function resolveLength(length, containerSize) {
  if (length[1] == "percent") return (length[0] * containerSize) / 100;
  // Assumption is only px or % will be passed in.
  // TODO: Support other length types (e.g. em, vh, etc).
  return length[0];
}

export function calculateOffset(source, orientation, offset, startOrEnd) {
  // TODO: Support other writing directions.
  if (orientation == "block") orientation = "vertical";
  else if (orientation == "inline") orientation = "horizontal";
  let originalViewport =
    source == document.scrollingElement
      ? {
          left: 0,
          right: source.clientWidth,
          top: 0,
          bottom: source.clientHeight,
          width: source.clientWidth,
          height: source.clientHeight,
        }
      : source.getBoundingClientRect();

  // Resolve margins and offset viewport.
  let parsedMargins = IntersectionOptions.get(offset).rootMargin;
  let computedMargins = [];
  for (let i = 0; i < 4; i++) {
    computedMargins.push(
      resolveLength(
        parsedMargins[i],
        i % 2 == 0 ? originalViewport.height : originalViewport.width
      )
    );
  }
  let viewport = {
    left: originalViewport.left - computedMargins[LEFT],
    right: originalViewport.right + computedMargins[RIGHT],
    width:
      originalViewport.right -
      originalViewport.left +
      computedMargins[LEFT] +
      computedMargins[RIGHT],
    top: originalViewport.top - computedMargins[TOP],
    bottom: originalViewport.bottom + computedMargins[BOTTOM],
    height:
      originalViewport.bottom -
      originalViewport.top +
      computedMargins[TOP] +
      computedMargins[BOTTOM],
  };

  let clamped = IntersectionOptions.get(offset).clamp;
  let target = offset.target.getBoundingClientRect();
  let threshold = offset.threshold;
  // Invert threshold for start position.
  if (offset.edge == "start") threshold = 1 - threshold;
  // Projected point into the scroller scroll range.
  if (orientation == "vertical") {
    let point =
      target.top +
      target.height * threshold -
      viewport.top +
      source.scrollTop;
    if (clamped) {
      if (offset.edge == "end") return Math.max(0, point - viewport.height);
      return Math.min(point, source.scrollHeight - viewport.height);
    } else {
      if (offset.edge == "end") return point - viewport.height;
      return point;
    }
  } else {
    // orientation == 'horizontal'
    let point =
      target.left +
      target.width * threshold -
      viewport.left +
      source.scrollLeft;
    if (clamped) {
      if (offset.edge == "end") return Math.max(0, point - viewport.width);
      return Math.min(point, source.scrollWidth - viewport.width);
    } else {
      if (offset.edge == "end") return point - viewport.width;
      return point;
    }
  }
}
