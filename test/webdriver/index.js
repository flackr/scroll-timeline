require("dotenv").config();
const webdriver = require("selenium-webdriver");
const builder = require('./driver-builder');
const sirv = require("sirv");
const {createServer} = require("http");

const {harnessTests} = require("../tests.config.json");

const {exec} = require("child_process");

const t = require('tap')

let server;

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

    server = createServer(sirv(WPT_DIR, {quite: true}));

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

async function runWebDriverTests() {
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
        // await driver.quit();
        testResults.set(browser, currentBrowserResults)
    }
    return new Promise((resolve) => {
        server.close(() => {
            resolve(testResults);
        })
    })
}


// t.test("WPT Harness Tests + ScrollTimeline polyfill", parentTest => {
//     // TODO: switch to a less callback-y async-await syntax
//     // https://node-tap.org/docs/api/promises/#promises
//     runWebDriverTests().then(results => {
//         results.forEach((browserResults, browser) => {
//             parentTest.test(`Running on ${browser} browser`, vendorTest => {
//                 Object(browserResults).forEach(suit => {
//                     vendorTest.test(suit.test, harnessPageTest => {
//                         suit.tests.forEach(item => {
//                             harnessPageTest.test(item.name, harnessSubTest => {
//                                 harnessSubTest.equal(+item.status, 0, item.message);
//                                 harnessSubTest.end();
//                             });
//                         });
//                         harnessPageTest.end();
//                     });
//                 });
//                 vendorTest.end();
//             });
//         });
//         parentTest.end();
//     });
// });

// t.tearDown(() => {
//     if( builder.isSaucelabsTest === true ) {
//         exec("ps aux | grep sc | grep -v grep | awk  '{print $2}' | xargs kill -9", (error, stdout, stderr) => {
//             if (error) {
//                 console.log(`error: ${error.message}`);
//                 return;
//             }
//             if (stderr) {
//                 console.log(`stderr: ${stderr}`);
//                 return;
//             }
//             console.log(`stdout: ${stdout}`);
//         });
//     }
// })


t.test("??", t =>{
    t.fail("something")
    t.end()
})

t.tearDown(() => {
    exec("ps aux | grep sc | grep -v grep | awk  '{print $2}' | xargs kill -9")
})
