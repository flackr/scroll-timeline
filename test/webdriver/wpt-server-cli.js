const wptServer = require("./wpt-server");
const TEST_CONFIGS = require("../tests.config.json");

// Env configs
WPT_SERVER_PORT = process.env.WPT_SERVER_PORT || "8081";

(async ()=>{
    await wptServer(TEST_CONFIGS, { WPT_SERVER_PORT })
})()