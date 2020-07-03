const fs = require('fs');
const http = require('http');

const base = 'test/wpt';

async function wptServer(testConfigs, env) {

    let polyfillStr = ``;
    testConfigs.polyfillFiles.forEach((polyfill) => {
        // TODO: check file ext to check whether its CSS or JS polyfill
        polyfillStr += `\n<script src="${polyfill}" type="text/javascript"></script>`;
    });

    let harnessTestURLs = new Set(testConfigs.harnessTests);
    function handler(req, res) {
        let url = req.url

        // this is not safe to use as generic server
        // anyone can navigate back to serve any file on your server
        // outside the desired `base` but for our use, it's fine.
        // also, its sync file-reader and server, not streams based
        // so I'd avoid outside our small use case
        fs.readFile(base + url, "utf8", (err, data) => {
            if (err) {
                res.writeHead(404, {"Content-Type": "text/plain"});
                res.write('404 not found');
                return res.end();
            }

            res.statusCode = 200;
            // if the URL being served is for a harness test we need to inject the polyfill
            if( harnessTestURLs.has(url) ) {
                console.log("Injecting polyfill in " + url);
                data = data.replace(/(<\/.*title.*>)/gi, `$1${polyfillStr}`);
            }
            res.write(data);
            return res.end();
        });
    }
    let server = http.createServer(handler)
    return new Promise((res, rej) => {
        server.listen(env.WPT_SERVER_PORT, (err) => {
            if (err) {
                rej(err)
            }
            console.log(`Starting WPT server on localhost:${env.WPT_SERVER_PORT}`)
            res(server)
        });
    })

}

module.exports = wptServer