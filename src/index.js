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

import {
  ScrollTimeline,
  installScrollOffsetExtension,
  addAnimation,
} from "./scroll-timeline-base";
import { calculateOffset, parseOffset } from "./intersection-based-offset";

const nativeElementAnimate = window.Element.prototype.animate;

/**
 * Decides whether to use native Element.prototype.animate function in regular fashion or pass it to our polyfill
 *  so its current time is driven by scroll event
 * @param keyframes {Object} array of keyframe objects
 * @param options {Object} WAAPI options object
 * @returns {Function}
 */

const animate = function (keyframes, options) {
  let timeline = options.timeline;
  if (!timeline || !(timeline instanceof ScrollTimeline)) {
    return nativeElementAnimate.apply(this, [keyframes, options]);
  }
  delete options.timeline;
  let animation = nativeElementAnimate.apply(this, [keyframes, options]);
  // TODO: Create a proxy for the animation to control and fake the animation
  // play state.
  animation.pause();
  addAnimation(timeline, animation, options);
  return animation;
};

installScrollOffsetExtension(parseOffset, calculateOffset);
if (
  !Reflect.defineProperty(window, "ScrollTimeline", { value: ScrollTimeline })
) {
  throw Error(
    "Error installing ScrollTimeline polyfill: could not attach ScrollTimeline to window"
  );
}

if (!Reflect.defineProperty(Element.prototype, "animate", { value: animate })) {
  throw Error(
    "Error installing ScrollTimeline polyfill: could not attach WAAPI's animate to DOM Element"
  );
}
