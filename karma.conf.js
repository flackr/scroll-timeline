const IS_CI = String(process.env.CI) === "true";
const POLYFILL_VERSION = require('./package.json').version

const sauceLabsLaunchers = {
    sl_edge: {
        base: 'SauceLabs',
        browserName: 'MicrosoftEdge',
        platform: 'Windows 10'
    },
    sl_chrome: {
        base: 'SauceLabs',
        browserName: 'chrome',
        platform: 'Windows 10'
    },
    sl_firefox: {
        base: 'SauceLabs',
        browserName: 'firefox',
        platform: 'Windows 10'
    }
};

module.exports = function(config) {
    config.set({
        browsers: IS_CI
            ? Object.keys(sauceLabsLaunchers)
            : ["Chrome" /* sadly Chromium-based-Edge support seems buggy via karma-edgium-launcher and unsupported in karma-edge-launcher */],
        browserLogOptions: { terminal: true },
        browserConsoleLogOptions: { terminal: true },
        browserNoActivityTimeout: 5 * 60 * 1000,

        captureTimeout: 0,
        concurrency: 2,
        customLaunchers: IS_CI ? sauceLabsLaunchers : undefined,

        files: [
            'test/**/*.js'
        ],
        frameworks: ['mocha', 'chai'],

        mochaReporter: {
            showDiff: true
        },

        sauceLabs: {
            build: `CI #${process.env.GITHUB_RUN_NUMBER} (${process.env.GITHUB_RUN_ID})`,
            tunnelIdentifier:
                process.env.GITHUB_RUN_NUMBER ||
                `local${POLYFILL_VERSION}`,
            connectLocationForSERelay: 'localhost',
            connectPortForSERelay: 4445,
            startConnect: !!IS_CI
        }
    });
};