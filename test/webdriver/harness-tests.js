const glob = require('tiny-glob');
const fs = require('fs');

function _isMatchedHarnessTest(filePath) {
    return new Promise((res, rej) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return rej(err)
            }
            if (data.indexOf("/resources/testharness.js") > -1 && data.indexOf("/resources/testharnessreport.js") > -1) {
                return res(true)
            }
            return res(false)
        })
    })
}

async function retrieve(harnessTestsFiles, env) {
    let harnessTests = new Set()
    for (let i = 0; i < harnessTestsFiles.length; i++) {
        let files = await glob(env.WPT_DIR + harnessTestsFiles[i]).catch(err => { throw err })
        for (let j = 0; j < files.length; j++) {
            let isHarness = await _isMatchedHarnessTest(files[j]).catch(err => { throw err })
            if (isHarness === true) {
                harnessTests.add(files[j])
            }
        }
    }
    return harnessTests
}

module.exports = { retrieve }