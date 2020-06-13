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

#### 1. Create `.env` file for node environment variables

this file should be located at the root of this repo, and contain the following

1. WPT_DIR: the location we will be serving and running Web Platform Tests (WPT) from.
2. SAUCE_NAME: Your saucelabs user name, can be found in your user settings.
2. SAUCE_KEY: Your saucelabs access key, can be found in your user settings.
4. SC_TUNNEL_ID: Saucelabs' connect proxy tunnel id.

```dotenv
WPT_DIR=test/wpt
SAUCE_NAME=<YOUR-SAUCELABS-USERNAME>
SAUCE_KEY=<YOUR-SAUCELABS-ACCESS-KEY>
SC_TUNNEL_ID=sc-wpt-tunnel
```

#### 2. Simplest way to test WPT tests against the polyfill

You very likely don't need to run local Selenium-WebDriver tests or Saucelabs tests every time locally, to debug simply and quickly:

Run tests setup script:

```shell script
npm run test:setup
```

The script above will:

1. Clone WPT if it does not already exist.
2. Inject the polyfill script in WPT pages we want to test. 

after that, just use your favourite simple web server.

### Getting started
 
Running a dev environment

```shell script
npm i
npm run dev 
```

### Configure Tests

Test configurations are available in: `test/tests.config.json` that file includes:

1. polyfillFiles: an array of our JS shim / polyfill files, those will be injected in WPT tests files.
2. harnessTests: an array of WPT harness tests we want to test the polyfill against.
3. browsers.local: Browser our local selenium-webdriver will test against
4. browsers.sauce: Browser our local selenium-webdriver will test against in Saucelabs / CI environment.   