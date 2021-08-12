const wptServer = require("./wpt-server");
const TEST_CONFIGS = require("../tests.config.json");
const harnessTests = require("./harness-tests");

// Env configs
WPT_SERVER_ADDRESS = process.env.WPT_SERVER_ADDRESS || "127.0.0.1";
WPT_SERVER_PORT = process.env.WPT_SERVER_PORT || "8081";
WPT_DIR = process.env.WPT_DIR || "test/wpt";

(async () => {
    let harnessTestUrls = await harnessTests.retrieve(TEST_CONFIGS.harnessTests, { WPT_DIR }).catch(err => { throw err })
    await wptServer(harnessTestUrls, TEST_CONFIGS, { WPT_SERVER_ADDRESS, WPT_SERVER_PORT, WPT_DIR })
})()
