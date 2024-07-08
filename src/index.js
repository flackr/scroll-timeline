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
} from "./scroll-timeline-base";
import {
  animate,
  elementGetAnimations,
  documentGetAnimations,
  ProxyAnimation
} from "./proxy-animation.js";

import { initCSSPolyfill } from "./scroll-timeline-css"

import { initPolyfill } from "./init-polyfill.js"

function initPolyfillIncludingCSS() {
  // initCSSPolyfill returns true iff the host browser supports SDA
  if (initCSSPolyfill()) {
    console.debug("Polyfill skipped because browser supports Scroll Timeline.");
    return;
  }

  initPolyfill();
}

initPolyfillIncludingCSS();
