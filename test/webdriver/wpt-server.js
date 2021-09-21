const fs = require('fs');
const http = require('http');

async function wptServer(harnessTestURLs, testConfigs, env) {

    let polyfillStr = ``;
    testConfigs.polyfillFiles.forEach((polyfill) => {
        // TODO: check file ext to check whether its CSS or JS polyfill
        polyfillStr += `\n<script src="${polyfill}" type="text/javascript"></script>`;
    });

    let polyfillsSet = new Set(testConfigs.polyfillFiles);
    testConfigs.serveFiles.forEach((file) => {
      polyfillsSet.add(file);
    });

    function handler(req, res) {
        let url = req.url
        let fileToServe = env.WPT_DIR + url
        if( polyfillsSet.has(url) ) {
            fileToServe = process.cwd() + url
        }
        // this is not safe to use as generic server
        // anyone can navigate back to serve any file on your server
        // outside the desired `base` but for our use, it's fine.
        fs.readFile(fileToServe, "utf8", (err, data) => {
            if (err) {
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write('404 not found');
                return res.end();
            }

            res.statusCode = 200;
            // if the URL being served is for a harness test we need to inject the polyfill
            if( harnessTestURLs.has(fileToServe) ) {
                console.log("Injecting polyfill in " + url);
                data = data.replace(/(<\/.*title.*>)/gi, `$1${polyfillStr}`);
            }
            res.write(data);
            return res.end();
        });
    }
    let server = http.createServer(handler)
    return new Promise((res, rej) => {
        server.listen(env.WPT_SERVER_PORT, env.WPT_SERVER_ADDRESS, (err) => {
            if (err) {
                rej(err)
            }
            console.log(`Starting WPT server on ${env.WPT_SERVER_ADDRESS}:${env.WPT_SERVER_PORT}`)
            res(server)
        });
    })

}

module.exports = wptServer
