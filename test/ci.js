const promise = require("selenium-webdriver");
let expect = require("chai").expect;
let webdriver = require("selenium-webdriver");

const { browsers, harnessTests } = require("./tests.config.json");

promise.USE_PROMISE_MANAGER = false;

let username = process.env.SAUCE_USERNAME,
  accessKey =
    process.env.SAUCE_ACCESS_KEY,
  /* Change the baseURL to your application URL */
  baseUrl = `https://wpt.live`,
  tags = ["scroll-animations", "polyfill", "scroll-timeline"],
  driver;

for (let i = 0; i < browsers.length; i++) {
  let { browserName, platformName, browserVersion } = browsers[i];
  describe("Harness Tests Chrome on Windows 10", function () {
    this.timeout(40000);
    const res = {};
    beforeEach(async function () {
      driver = await new webdriver.Builder()
        .withCapabilities({
          browserName: browserName,
          platformName: platformName,
          browserVersion: browserVersion,
          "sauce:options": {
            username: username,
            accessKey: accessKey,
            build: `ScrollTime line testing on ${browserVersion} ${browserName} for ${platformName}`,
            name: "WPT Harness Tests",
            maxDuration: 3600,
            idleTimeout: 1000,
            tags: tags,
            'tunnelIdentifier': 'sc-wpt-tunnel'
          },
        })
        .usingServer("https://ondemand.saucelabs.com/wd/hub")
        .build();

      await driver.getSession().then(function (sessionid) {
        driver.sessionID = sessionid.id_;
      });
    });

    harnessTests.forEach((testPath) => {
      it("Testing: " + testPath, async function () {
        await driver.get(baseUrl + testPath);
        let resultsScriptElement = await driver.findElement(
          webdriver.By.id("__testharness__results__")
        );
        let resText = await resultsScriptElement.getAttribute("innerHTML");
        let res = JSON.parse(resText);
        res.tests.forEach(function (t) {
          expect(t.status, t.message).equal(0);
        });
      });
    });

    afterEach(async function () {
      await driver.executeScript("sauce:job-result=" + this.currentTest.state);
      await driver.quit();
    });
  });
}
