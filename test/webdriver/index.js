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

async function collectHarnessTestResults(driver) {
    let resultsScriptElement = await driver.findElement(
        webdriver.By.id("__testharness__results__")
    );
    let resText = await resultsScriptElement.getAttribute("innerHTML");
    return new Promise((resolve, reject) => {
        let res = {}
        try {
            res = JSON.parse(resText);
            resolve(res)
        } catch (e) {
            reject(e)
        }
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
            // TODO: (zouhir, easy) normalize testFile path so we don't have to keep doing str replcae
            // Why we doing str replace here? because:
            // testFile: test/wpt/scroll-timeline/....html
            // excludedTest: /scroll-timeline/....html
            // notice the test/wpt
            if (excludedTests.has(testFile.replace(ENV.WPT_DIR, ""))) {
                continue;
            }
            // TODO: (zouhir, easy) normalize testFile path so we don't have to keep doing str replcae
            // kinda-similarish to the note above
            await driver.get(testFile.replace(ENV.WPT_DIR, baseURL));
            let res = await collectHarnessTestResults(driver);
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

