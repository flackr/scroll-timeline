# Scroll-timeline Polyfill

A polyfill of ScrollTimeline and ViewTimeline as defined by the [spec](https://drafts.csswg.org/scroll-animations-1/).

View a [cool demo showing its usage](https://flackr.github.io/scroll-timeline/demo/parallax/)!

# News

Recent updates:
 * npm is now supported: use npm install scroll-timeline-polyfill
 * scroll-timeline-lite.js provides a lighter-weight version of the polyfill,
 supporting only the javascript portions of the API.  Use this if you want to 
 reduce overhead (bytes transmitted and runtime)

# Usage

To use this polyfill directly, simply import the module into your site's js, or
include it from your html. In either case you can use the lite version, 
`scroll-timeline-lite`, if you only need the javascript portion of the API 
(`ScrollTimeline` and/or `ViewTimeline` objects), or you can include the full version, `scroll-timeline`

Note that this example is using the lite version which only supports the javascript
porion of the API.  Then you can reference the API (using `ScrollTimeline` or
`ViewTimeline`).  

```js
import 'https://flackr.github.io/scroll-timeline/dist/scroll-timeline-lite.js';

document.getElementById('parallax').animate(
    { transform: ['translateY(0)', 'translateY(100px)']},
    { fill: 'both',
      timeline: new ScrollTimeline({
        source: document.documentElement,
      }),
      rangeStart: new CSSUnitValue(0, 'px'),
      rangeEnd: new CSSUnitValue(200, 'px'),
    });
```

The full polyfill adds support for CSS Animations that use a `view-timeline`
or `scroll-timeline` in CSS.

```html
<script src="https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js"></script>
```

```css
@keyframes parallax-effect {
  to { transform: translateY(100px) }
}
#parallax {
  animation: parallax-effect linear both;
  animation-timeline: scroll(block root);
  animation-range: 0px 200px;
}
```

Please ensure your CSS is hosted on the same domain as your website or included directly on the page within a \<style\> tag.

If you are loading stylesheets from other origins, the polyfill might not be able to fetch and apply them correctly, due to browser security restrictions.

See [issue #248](https://github.com/flackr/scroll-timeline/issues/248)

# npm usage

You can also include this package using npm:

```shell script
npm install scroll-timeline-polyfill
```

Then you can import directly into your javascript

```js
import 'scroll-timeline-polyfill/dist/scroll-timeline-lite.js';
```
OR
```js
import 'scroll-timeline-polyfill/dist/scroll-timeline.js';
```

OR include it in your html

```html
<script src="../../dist/scroll-timeline.js"></script>
```

# Use Cases

For more details on and use-cases of scroll-driven animations, please refer to [https://developer.chrome.com/articles/scroll-driven-animations/](https://developer.chrome.com/articles/scroll-driven-animations/) and [https://scroll-driven-animations.style/](https://scroll-driven-animations.style/)

# Contributing
 
### 1. Polyfill dev 

Running a dev environment

```shell script
npm i
npm run dev 
```

Then open the browser `http://localhost:3000`, choose one of the demos (test) to see how your changes. 

### 2. Configure & Run Tests

Test configurations are available in: `test/tests.config.json` that file includes:

1. polyfillFiles: an array of our JS shim / polyfill files, those will be injected in WPT tests files.
2. harnessTests: an array of WPT harness tests we want to test the polyfill against.
3. browsers.local: Browser our local selenium-webdriver will test against
4. browsers.sauce: Browser our local selenium-webdriver will test against in Saucelabs / CI environment.   

#### Run the tests locally

Simple test will serve the WPT tests folder and intercepts requests, if the request path matches a harness test we are interested in polyfilling, it will inject the polyfill.

*Required environment variables:*

```dotenv
WPT_DIR=test/wpt #defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
```

*Command*

```shell script
npm run test:simple
```

Go to `localhost:8081/scroll-animations/current-time-nan.html` as an example.

#### Run the tests via Web Driver

##### Local web driver

*Required environment variables:*

```dotenv
WPT_DIR=test/wpt #defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
LOCAL_BROWSER=chrome # choose one of 'chrome', 'edge', 'firefox', 'safari'
LOCAL_WEBDRIVER_BIN=? #/path/to/webdriver-binaries
```

*Command*

```shell script
npm run test:wpt
```

##### SauceLabs / CI

*Required environment variables:*

```dotenv
TEST_ENV=sauce
WPT_DIR=test/wpt #defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
SC_TUNNEL_ID=sc-wpt-tunnel # please specify 'sc-wpt-tunnel' as a SauceConnect Proxy Tunnel ID

SAUCE_NAME=<secret> # Your saucelabs account username
SAUCE_KEY=<secret> # Your API key
```

*Command*

```shell script
TEST_ENV=sauce npm run test:wpt
```
