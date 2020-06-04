require('dotenv').config();
const expect = require("chai").expect;
const webdriver = require("selenium-webdriver");
const builder = require('./driver-builder');

let {harnessTests} = require("../tests.config.json");

// TODO: configure / accept as cli args
let baseUrl = `http://localhost:8081`;

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

async function main() {
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
    testResults.forEach((browserResults, browser) => {
        describe(`WPT Harness Tests + ScrollTimeline polyfill running on ${browser} browser`, function () {
            this.timeout(80000);
            Object(browserResults).forEach(suit => {
                describe(suit.test, () => {
                    suit.tests.forEach(t => {
                        it(t.name, () => {
                            expect(t.status, `${t.message}\n\n    ${t.stack}`).to.equal(0);
                        })
                    })
                })
            })
        });
    })
    run()
})