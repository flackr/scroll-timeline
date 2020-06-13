require("dotenv").config();
const webdriver = require("selenium-webdriver");
const builder = require('./driver-builder');

const sirv = require("sirv");

const {createServer} = require("http");

const {harnessTests} = require("../tests.config.json");

const {magenta, cyan, red, green, black} = require("kleur");

const  SauceLabs = require('saucelabs').default;


// TODO: configure / accept as cli args
const port = 8081;
const origin = "localhost"

// firefox requires a protocol even for localhost origins
const baseUrl = `http://${origin}:${port}`;
const WPT_DIR = process.env.WPT_DIR || ".";

async function testPage(driver, testPath) {
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

async function startLocalServer() {
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

// async function stopLocalServer(instance) {
//     return new Promise((resolve, reject) => {
//         instance.close(err => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve(true)
//         })
//     })
// }

async function runWebDriverTests() {
    let server;
    //TODO: convert JavaScript's rejection handling from try{}catch{} to:
    // let [resolved, rejected] = await fn()
    try {
        server = await startLocalServer()
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
        server.close(() => {
            resolve(testResults);
        })
    })
}

async function reporter(results) {
    let passes = 0;
    let failures = 0;
    let suitesOK = 0;
    let suitesErr = 0;
    results.forEach((browserResults, browser) => {
        Object(browserResults).forEach(suite => {
            console.log(`${magenta().bold([browser.toUpperCase()])} ${cyan().bold("testing: " + suite.test)}`)
            if (suite.status === 0) {
                console.log(green().bold("Harness Test: OK"))
                suitesOK++
            } else {
                console.log(red().bold("Harness Test: Error"))
                console.log(red(suite.message))
                suitesErr++
            }
            console.log("Details:")
            suite.tests.forEach(t => {
                if (t.status === 0) {
                    passes++;
                    console.log(`\t${green().bold("PASS")} ${green(t.name)} `)
                } else {
                    failures++;
                    console.log(`\t${red().bold("FAIL")} ${red(t.name)} `)
                    console.log(`\t     ${ red("Details: ") + t.message }`)
                }
            })
        })
    })

    console.log(black().bgWhite(` SUMMARY `))
    console.log(`Harness Tests Successfuly Completed: ${suitesOK}/${suitesOK + suitesErr}`);
    console.log(`Tests failed: ${failures}`);
    console.log(`Tests passed: ${passes}\n\n\n`);

    return new Promise((resolve) => {
        if( failures > 0 ) {
            resolve(1)
        } else {
            resolve(0)
        }
    })
}

(async () => {
    const sauceAccount = new SauceLabs({ user: process.env.SAUCE_NAME, key: process.env.SAUCE_KEY });
    const sc = await sauceAccount.startSauceConnect({
        tunnelIdentifier: process.env.SC_TUNNEL_ID
    })
    const results = await runWebDriverTests();
    const exitCode = await reporter(results)
    await sc.close();
    process.exit(exitCode);
})()
