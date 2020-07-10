const { magenta, cyan, red, green, black, bold } = require("kleur");

async function reporter(results) {
    let passes = 0;
    let failures = 0;
    let harnessPageOK = 0;
    let harnessPageErr = 0;
    results.forEach((browserResults, browser) => {
        Object(browserResults).forEach(suite => {
            console.log(`${magenta().bold([browser.toUpperCase()])} ${cyan().bold("testing: " + suite.test)}`)
            if (suite.status === 0) {
                console.log(green().bold("Harness Test Status: OK"))
                harnessPageOK++
            } else {
                console.log(red().bold("Harness Test: Error"))
                console.log(red(suite.message))
                harnessPageErr++
            }
            console.log(bold("Details:"))
            suite.tests.forEach(t => {
                if (t.status === 0) {
                    passes++;
                    console.log(`\t${green().bold("PASS:")} ${green(t.name)} `)
                } else {
                    failures++;
                    console.log(`\t${red().bold("FAILED ON:")} ${red(t.name)} `)
                    console.log(`\t     ${ red("Error: ") + t.message }`)
                    console.log(`\t     ${ red("Stack: ") + t.stack} \n`);
                }
            })
        })
    })

    console.log(black().bold().bgWhite(` SUMMARY `))
    console.log(`Harness Tests Successfuly Completed: ${harnessPageOK}/${harnessPageOK + harnessPageErr}`);
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

module.exports = reporter;