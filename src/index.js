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

import { initCSSPolyfill } from "./scroll-timeline-css"
import { initJSPolyfill } from "./scroll-timeline-js"

function initPolyfill() {
  const jsPolyfillLoaded = initJSPolyfill();
  const cssPolyfillLoaded = initCSSPolyfill();

  if (jsPolyfillLoaded || jsPolyfillLoaded) {
    console.log('ScrollTimeline Polyfill loaded');
  }

  if (cssPolyfillLoaded) {
    if ([...document.styleSheets].filter((s) => s.href !== null).length) {
      console.warn(
        'Non-Inline StyleSheets detected: ScrollTimeline polyfill currently only' +
          ' supports inline styles within style tags'
      );
    }
  }
}

initPolyfill();
