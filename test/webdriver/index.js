require("dotenv").config();
const expect = require("chai").expect;
const webdriver = require("selenium-webdriver");
const builder = require('./driver-builder');
const sirv = require("sirv");
const {createServer} = require("http");

const {harnessTests} = require("../tests.config.json");

// TODO: configure / accept as cli args
const port = 8081;
const origin = "localhost"
// firefox requires a protocol even for localhost origins
const baseUrl = `http://${origin}:${port}`;
const WPT_DIR = process.env.WPT_DIR || ".";

async function testPage(driver, testPath) {
    await driver.getSession().then(function (sessionid) {
        driver.sessionID = sessionid.id_;
    });
    await driver.get(baseUrl + testPath);
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

async function startServer() {

    let server = createServer(sirv(WPT_DIR, {quite: true}));

    return new Promise((resolve, reject) => {
        server.listen(port, origin, err => {
            if (err) {
                reject(e)
            }
            console.log("local server started")
            resolve(true)
        })
    })
}

async function main() {
    //TODO: convert JavaScript's rejection handling from try{}catch{} to:
    // let [resolved, rejected] = await fn()
    try {
        await startServer()
    } catch (e) {
        throw new Error(e)
    }
    let testResults = new Map();
    for (const [browser, driverBuilder] of builder.drivers.entries()) {
        let currentBrowserResults = []
        let driver = await driverBuilder.build()
        for (let i = 0; i < harnessTests.length; i++) {
            let testPath = harnessTests[i];
            try {
                let thisRes = await testPage(driver, harnessTests[i]);
                currentBrowserResults.push(thisRes)
            } catch (e) {
                console.warn('Error happened when testing ' + testPath)
            }
        }
        // cleanup before going to next browser's driver
        await driver.quit();
        testResults.set(browser, currentBrowserResults)
    }
    return new Promise((resolve) => {
        resolve(testResults)
    })
}

main().then(testResults => {
    describe("WPT Harness Tests + ScrollTimeline polyfill", function () {
        this.timeout(80000);
        testResults.forEach((browserResults, browser) => {
            describe(`Running on ${browser} browser`, () => {
                Object(browserResults).forEach(suit => {
                    describe(suit.test, () => {
                        suit.tests.forEach(t => {
                            it(t.name, () => {
                                expect(t.status, `${t.message}`).to.equal(0);
                            })
                        })
                    })
                })
            });
        })
    })
    run()
})