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
  ViewTimeline,
  installScrollOffsetExtension
} from "./scroll-timeline-base";
import {
  animate,
  ProxyAnimation
} from "./proxy-animation.js";

import { calculateOffset, parseOffset } from "./intersection-based-offset";
import { initCSSPolyfill } from "./scroll-timeline-css"

installScrollOffsetExtension(parseOffset, calculateOffset);
initCSSPolyfill();

if (
  !Reflect.defineProperty(window, "ScrollTimeline", { value: ScrollTimeline })
) {
  throw Error(
    "Error installing ScrollTimeline polyfill: could not attach ScrollTimeline to window"
  );
}
if (
  !Reflect.defineProperty(window, "ViewTimeline", { value: ViewTimeline })
) {
  throw Error(
    "Error installing ViewTimeline polyfill: could not attach ViewTimeline to window"
  );
}

if (!Reflect.defineProperty(Element.prototype, "animate", { value: animate })) {
  throw Error(
    "Error installing ScrollTimeline polyfill: could not attach WAAPI's animate to DOM Element"
  );
}
if (!Reflect.defineProperty(window, "Animation", {value: ProxyAnimation})) {
  throw Error("Error installing Animation constructor.");
}
