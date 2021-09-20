# Scroll-timeline Polyfill

Automated tests in CI provided by  [<img width="120px" src="https://saucelabs.com/images/logo-saucelabs.png">](https://saucelabs.com/)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/zochahou.svg)](https://saucelabs.com/u/zochahou)

A polyfill of ScrollTimeline as defined by the [spec](https://wicg.github.io/scroll-animations/).

View a [cool demo showing its usage](https://flackr.github.io/scroll-timeline/demo/parallax/)!

# Usage

To play with ScrollTimeline, simply import the module into your site and you can start creating animations.

```js
import 'https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js';

document.getElementById('parallax').animate(
    { transform: ['translateY(0)', 'translateY(100px)']},
    { duration: 10000, // Totally arbitrary!
      fill: 'both',
      timeline: new ScrollTimeline({
          scrollOffsets: [
              new CSSUnitValue(0, 'px'),
              new CSSUnitValue(200, 'px')
          ]
      })
    });
```

# Contributing
 
### 1. Polyfill dev 

Running a dev environment

```shell script
npm i
npm run dev 
```

Then open the browser `http://localhost:5000`, choose one of the demos (test) to see how your changes. 

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
npm run test:webdriver
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
TEST_ENV=sauce npm run test:webdriver
```
