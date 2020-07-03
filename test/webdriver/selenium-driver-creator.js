const promise = require("selenium-webdriver");
const webdriver = require("selenium-webdriver");

// copied and pasted from node.js selenium wrebdriver Saucelabs Wiki
// https://wiki.saucelabs.com/display/DOCS/Node.js+Test+Setup+Example
promise.USE_PROMISE_MANAGER = false;

/**
 * Configures and creates a Selenium Webdirver instance to launch a local browser
 * @param browser
 *      browser.browserName: String, lowerCase browser name supported by: *      https://www.npmjs.com/package/selenium-webdriver#using-the-builder-api
 *      browser.webDriverBin: String, path to the webdriver binaries
 * @returns {!Builder}
 */
function createLocalWebdriver(browser) {
    let { browserName, webDriverBin } = browser
    let browserConfig = require("selenium-webdriver/" + browserName);
    browserConfig.setDefaultService(new browserConfig.ServiceBuilder(webDriverBin).build());
    return new webdriver.Builder().forBrowser(browserName).withCapabilities(webdriver.Capabilities[browserName]())
}

/**
 * Configures and creates a Selenium webdriver instacne that works with our Saucelabs subscription
 * https://wiki.saucelabs.com/display/DOCS/Node.js+Test+Setup+Example
 * @param browser: Object contains browser and platform options
 * @param options: Object contains Saucelabs secret and Sauce-connect tunnel info.
 * @returns {!Builder}
 */
function createSauceLabsWebDriver(browser, options) {
    let { browserName, platformName, browserVersion } = browser
    let { SAUCE_NAME, SAUCE_KEY, SC_TUNNEL_ID } = options
    return new webdriver.Builder()
        .withCapabilities({
            browserName: browserName,
            platformName: platformName,
            browserVersion: browserVersion,
            "sauce:options": {
                username: SAUCE_NAME,
                accessKey: SAUCE_KEY,
                build: `WPT Harness Tests for ScrollTimeline ${browserName} : ${browserVersion} for ${platformName}`,
                name: "WPT Harness Tests for ScrollTimeline",
                maxDuration: 3600,
                idleTimeout: 1000,
                tags: ["scroll-animations", "polyfill", "scroll-timeline", "wpt-harness-tests", "mocha"],
                'tunnelIdentifier': SC_TUNNEL_ID
            },
        })
        .usingServer("https://ondemand.saucelabs.com/wd/hub")
}

function create (env, browser, options) {
    if( env === 'local' ) {
        return createLocalWebdriver(browser)
    }
    return createSauceLabsWebDriver(browser, options)
}

module.exports = { create }