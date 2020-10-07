// vendor
require("dotenv").config();
const webdriver = require("selenium-webdriver");
const { createServer } = require("http");
const SauceLabs = require("saucelabs").default;

// ours
const driverCreator = require('./selenium-driver-creator');
const reporter = require("./reporter");
const wptServer = require("./wpt-server");
const TEST_CONFIGS = require("../tests.config.json");
const harnessTests = require("./harness-tests");
const { resolve } = require("path");

// Env configs
const ENV = {}
ENV.WPT_SERVER_PORT = process.env.WPT_SERVER_PORT;
ENV.ORIGIN = "localhost"
ENV.WPT_DIR = process.env.WPT_DIR || "test/wpt";
ENV.TEST_ENV = process.env.TEST_ENV && process.env.TEST_ENV.toLowerCase() === 'sauce' ? 'sauce' : 'local';

if (ENV.TEST_ENV === "sauce") {
    ENV.SAUCE_NAME = process.env.SAUCE_NAME;
    ENV.SAUCE_KEY = process.env.SAUCE_KEY;
    ENV.SC_TUNNEL_ID = process.env.SC_TUNNEL_ID;
}

if (ENV.TEST_ENV === "local") {
    ENV.LOCAL_BROWSER = process.env.LOCAL_BROWSER;
    ENV.LOCAL_WEBDRIVER_BIN = process.env.LOCAL_WEBDRIVER_BIN;
}

// ensure required config keys are all set in our configs object
Object.keys(ENV).forEach((k) => {
    if (typeof ENV[k] === 'undefined') {
        throw new Error(`Missing required configuration, please set ${k} as node environment variable \n`)
    }
})

// used to create new objects that look like WPt Harness tets results, useful when having to create clean error responses
function HarnessResult({ test, status, message, stack=null, tests=[] }) {
    return {
        test,
        status,
        message,
        stack,
        tests
    }
}

function waitForElement(driver, selector, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = (new Date()).getTime();
    let tryAgain = async function() {
      let maybeRetry = function(err) {
        let timeLeft = startTime + timeout - (new Date()).getTime();
        // Try again in 50ms.
        if (timeLeft > 0)
          setTimeout(tryAgain, Math.min(timeLeft, 50));
        else
          reject(err);
      }
      let result = await driver.findElement(selector).catch(maybeRetry);
      if (typeof result === "undefined")
        maybeRetry("TIMEOUT");
      else
        resolve(result);
    }
    tryAgain();
  });
}

const TEST_TIMEOUT = 5000;
async function collectHarnessTestResults(driver, file) {
    let resJson;
    let resultsScriptElement = await waitForElement(driver,
        webdriver.By.id("__testharness__results__"), TEST_TIMEOUT
    ).catch(err => {
        // maybe unable to locate the elememt, don't crash the entire thing
        console.log("error could not find __testharness__results__ in ", file, err)
        resJson = new HarnessResult({
            file,
            status: 1,
            message: "Could not find __testharness__results__"
        })
    });
    if (typeof resultsScriptElement !== "undefined") {
        let resText = await resultsScriptElement.getAttribute("innerHTML").catch(err => {
            console.log("error could not read #__testharness__results__ innerHTML", file)
            resJson = new HarnessResult({
                file,
                status: 1,
                message: "Could not read innerHTML"
            })
        });
        try {
            resJson = JSON.parse(resText);
        } catch (e) {
            console.log("error parsing harness test JSON for", url)
            resJson = new HarnessResult({
                file,
                status: 1,
                message: "Could not parse JSON"
            })
        }
    } else {
        resJson = new HarnessResult({
            file,
            status: 1,
            message: "Could not find #__testharness__results__ element"
        })
    }
    return new Promise((res) => {
        res(resJson)
    })
}

async function runWebDriverTests() {
    let server, driver;
    let drivers = new Map();
    let testResults = new Map();
    let { browsers } = TEST_CONFIGS;
    let testFiles = await harnessTests.retrieve(TEST_CONFIGS.harnessTests, ENV)
    let excludedTests = new Set(TEST_CONFIGS.excludeTests);

    const baseURL = `http://${ENV.ORIGIN}:${ENV.WPT_SERVER_PORT}`;

    if (ENV.TEST_ENV === 'local') {
        drivers.set(ENV.LOCAL_BROWSER, driverCreator.create(
            ENV.TEST_ENV,
            {
                browserName: ENV.LOCAL_BROWSER,
                webDriverBin: ENV.LOCAL_WEBDRIVER_BIN
            }
        ))
    } else {
        Object.keys(browsers.sauce).forEach(browser => {
            drivers.set(browser, driverCreator.create(
                ENV.TEST_ENV,
                browsers.sauce[browser],
                ENV
            ))
        })
    }

    server = await wptServer(testFiles, TEST_CONFIGS, ENV).catch(err => { throw err })

    for (const [browser, driverInstance] of drivers.entries()) {
        let currentBrowserResults = [];
        try {
            driver = await driverInstance.build();
        } catch (e) {
            console.error("Error creating driver...")
            throw new Error(e)
        }

        for (let testFile of testFiles) {
            // convert: test/wpt/scroll-timeline/....html
            // to: localhost:PORT/scroll-timeline/....html
            let url = testFile.replace(ENV.WPT_DIR, baseURL);
            let res;
            // TODO: (zouhir, easy) normalize testFile path so we don't have to keep doing str replcae
            // Why we doing str replace here? because:
            // testFile: test/wpt/scroll-timeline/....html
            // excludedTest: /scroll-timeline/....html
            // notice the test/wpt
            if (excludedTests.has(testFile.replace(ENV.WPT_DIR, ""))) {
                continue;
            }
            await driver.get(url).catch(e => {
                console.log(e)
                res = new HarnessResult({
                    test: url,
                    status: 1,
                    message: "Webdriver could not get that page"
                })
            })
            res = await collectHarnessTestResults(driver)
            currentBrowserResults.push(res)
        }
        // cleanup before going to next browser's driver
        await driver.quit();
        testResults.set(browser, currentBrowserResults)
    }
    return new Promise((resolve) => {
        server.close(() => {
            resolve(testResults);
        })
    })
}


(async () => {
    let sc, sauceAccount, results;
    console.log(ENV.TEST_ENV)
    if (ENV.TEST_ENV === "sauce") {
        sauceAccount = new SauceLabs({ user: ENV.SAUCE_NAME, key: ENV.SAUCE_KEY });
        sc = await sauceAccount.startSauceConnect({
            tunnelIdentifier: ENV.SC_TUNNEL_ID
        })
    }
    results = await runWebDriverTests();
    const exitCode = await reporter(results)
    if (ENV.TEST_ENV === "sauce") {
        await sc.close();
    }
    process.exit(exitCode);
})()

