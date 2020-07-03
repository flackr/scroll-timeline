# scroll-timeline polyfill.

[![Sauce Test Status](https://app.saucelabs.com/buildstatus/zochahou)](https://app.saucelabs.com/u/zochahou)

A polyfill of ScrollTimeline as defined by the [spec](https://wicg.github.io/scroll-animations/).

View a [cool demo showing its usage](https://flackr.github.io/scroll-timeline/demo/parallax/)!

# Usage

To play with ScrollTimeline, simply import the module into your site and you can start creating animations.

```js
import 'https://flackr.github.io/scroll-timeline/scroll-timeline.js';

document.getElementById('parallax').animate(
    { transform: ['translateY(0)', 'translateY(100px)']},
    { duration: 10000, // Totally arbitrary!
      fill: 'both',
      timeline: new ScrollTimeline({
          endScrollOffset: '200px'})
    });
```

# Contributing

### Before you start

You can simply copy `.env-no-secret` and rename it as `.env` and add your Saucelab secrets. This file should contain the following

1. WPT_DIR: the location we will be serving and running Web Platform Tests (WPT) from.
2. WPT_SERVER_PORT: what port should we use to serve the WPTs with polyfill.
3. SAUCE_NAME: Your Saucelabs user name, can be found in your user settings.
4. SAUCE_KEY: Your Saucelabs access key, can be found in your user settings.
5. SC_TUNNEL_ID: Saucelabs' connect proxy tunnel id.

```dotenv
WPT_DIR=test/wpt
WPT_SERVER_PORT=8081
SC_TUNNEL_ID=sc-wpt-tunnel
SAUCE_NAME=
SAUCE_KEY=
```

### Getting started
 
#### 1. Polyfill dev 

Running a dev environment

```shell script
npm i
npm run dev 
```

Then open the browser `http://localhost:5000`, choose one of the demos (test) to see how your changes. 

#### 2. Configure & Run Tests

Test configurations are available in: `test/tests.config.json` that file includes:

1. polyfillFiles: an array of our JS shim / polyfill files, those will be injected in WPT tests files.
2. harnessTests: an array of WPT harness tests we want to test the polyfill against.
3. browsers.local: Browser our local selenium-webdriver will test against
4. browsers.sauce: Browser our local selenium-webdriver will test against in Saucelabs / CI environment.   

##### Run the tests locally

Simple test will serve the WPT tests folder and intercepts requests, if the request path matches a harness test we are interested in polyfilling, it will inject the polyfill.

```shell script
npm run test:simple
```
Go to `localhost:8081/scroll-animations/current-time-nan.html` as an example.

##### Run the tests via Web Driver

Local web driver

```shell script
LOCAL_BROWSER=chrome LOCAL_WEBDRIVER_BIN=/path/to/webdriver/binary npm run test:webdriver
```

SauceLabs / CI

```shell script
TEST_ENV=sauce npm run test:webdriver
```