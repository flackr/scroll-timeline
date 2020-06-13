// vendor
require("dotenv").config();
const webdriver = require("selenium-webdriver");
const sirv = require("sirv");
const { createServer } = require("http");
const SauceLabs = require("saucelabs").default;

// ours
const createSeleniumDrivers = require('./driver-creator');
const reporter = require("./reporter");
const { harnessTests } = require("../tests.config.json");

// Env configs
//
// TODO: configure / accept as cli args
const port = 8081;
const origin = "localhost"
const baseUrl = `http://${origin}:${port}`; // firefox requires a protocol even for localhost origins
const WPT_DIR = process.env.WPT_DIR || ".";
const sauceName = process.env.SAUCE_NAME || "";
const sauceKey = process.env.SAUCE_KEY || "";
const tunnelId = process.env.SC_TUNNEL_ID || "";
const testEnv = process.env.TEST_ENV && process.env.TEST_ENV.toLowerCase() === 'sauce' ? 'sauce' : 'local' ;

const drivers = createSeleniumDrivers({sauceName, sauceKey, tunnelId, testEnv});

async function collectHarnessTestResults(driver, testPath) {
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

async function serveWPT() {
    let server = createServer(sirv(WPT_DIR, {quite: true}));
    return new Promise((resolve, reject) => {
        server.listen(port, origin, err => {
            if (err) {
                return reject(err)
            }
            resolve(server)
        })
    })
}

async function runWebDriverTests() {
    let server;
    let driver;
    let testResults = new Map();
    //TODO: convert JavaScript's rejection handling from try{}catch{} to:
    // let [resolved, rejected] = await fn()
    try {
        server = await serveWPT()
    } catch (e) {
        console.error("Could not start local dev server..")
        throw new Error(e)
    }
    for (const [browser, driverInstance] of drivers.entries()) {
        let currentBrowserResults = [];
        try {
            driver = await driverInstance.build();
        } catch (e) {
            console.error("Error creating driver...")
            console.error(e);
        }
        for (let i=0; i < harnessTests.length; i++) {
            let testPath = harnessTests[i];
            await driver.get(baseUrl + testPath);
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
    let sc, sauceAccount;

    if( testEnv === "sauce") {
        sauceAccount = new SauceLabs({ user: sauceName, key: sauceKey });
        sc = await sauceAccount.startSauceConnect({
            tunnelIdentifier: tunnelId
        })
    }

    const results = await runWebDriverTests();
    const exitCode = await reporter(results)
    if( testEnv === "sauce" ) {
        await sc.close();
    }
    process.exit(exitCode);
})()

