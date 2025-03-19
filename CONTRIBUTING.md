# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to [Google Open Source CLA](https://cla.developers.google.com/)
to see your current agreements on file or to sign a new one.

You generally only need to submit a CLA once. So if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community Guidelines

This project follows [Google's Open Source Community
Guidelines](https://opensource.google.com/conduct/).

## Developing & testing your changes

### 1. Polyfill development environment

Run a development environment:

```shell script
npm i
npm run dev
```

Then open `http://localhost:3000` and choose one of the demos (test) to see how your changes apply.

### 2. Configuring & running tests

Test configurations are available in `test/tests.config.json` which include:

- `polyfillFiles`: an array of our JS shim / polyfill files, those will be injected in WPT tests files.
- `harnessTests`: an array of WPT harness tests we want to test the polyfill against.
- `browsers.local`: Browser our local selenium-webdriver will test against locally.
- `browsers.sauce`: Browser our local selenium-webdriver will test against in Saucelabs / CI environment.

#### Run the tests locally

Simple test will serve the WPT tests folder and intercepts requests. If the request path matches a harness test we are interested in polyfilling, it will inject the polyfill.

_Required environment variables:_

```dotenv
WPT_DIR=test/wpt #defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
```

_Command_

```shell script
npm run test:simple
```

Go to `localhost:8081/scroll-animations/current-time-nan.html` as an example.

#### Run the tests via Web Driver

##### Local web driver

_Required environment variables:_

```dotenv
WPT_DIR=test/wpt # defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
LOCAL_BROWSER=chrome # choose one of 'chrome', 'edge', 'firefox', 'safari'
LOCAL_WEBDRIVER_BIN=? #/path/to/webdriver-binaries
```

_Command_

```shell script
npm run test:wpt
```

##### SauceLabs / CI

_Required environment variables:_

```dotenv
TEST_ENV=sauce
WPT_DIR=test/wpt # defaults to test/wpt
WPT_SERVER_PORT=8081 # choose any port available on your machine
SC_TUNNEL_ID=sc-wpt-tunnel # please specify 'sc-wpt-tunnel' as a SauceConnect Proxy Tunnel ID

SAUCE_NAME=<secret> # Your saucelabs account username
SAUCE_KEY=<secret> # Your API key
```

_Command_

```shell script
TEST_ENV=sauce npm run test:wpt
```
