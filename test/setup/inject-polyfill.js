const fs = require("fs");
const configs = require("../tests.config.json");

const WPT_DIR = process.env.WPT_DIR

if( !WPT_DIR ) {
  throw new Error("Please specify WPT tests directory via --WPT_DIR=<dir> in command line arguments");
}

let polyfillStr = ``;
configs.polyfillFiles.forEach((polyfill) => {
  // TODO: check file ext to check whether its CSS or JS polyfill
  polyfillStr += `\n<script src="${polyfill}"></script>`;
});

async function editTestFiles() {
  for (const testPath of configs.harnessTests) {
    let filePath = WPT_DIR + testPath;
    let file = false;
    try {
      file = await isFile(filePath);
    } catch (e) {
      throw new Error(e);
    }
    if (file) {
      let success = false;
      try {
        success = await injectToFileInPlace(filePath, polyfillStr);
      } catch (e) {
        throw new Error(e);
      }
    }
  }
}

function injectToFileInPlace(filePath, injectedStr) {
  return new Promise((resolve) => {
    fs.readFile(filePath, "utf8", (errRead, data) => {
      if (errRead) {
        throw new Error(errRead);
      }
      if (data.indexOf(configs.polyfillFiles[0]) > -1) {
        return resolve(true);
      }
      const result = data.replace(/(<\/.*title.*>)/gi, `$1${injectedStr}`);
      fs.writeFile(filePath, result, "utf8", (errWrite) => {
        if (errWrite) {
          throw new Error(errWrite);
        }
        resolve(true);
      });
    });
  }).catch((e) => {
    throw new Error(e);
  });
}

function isFile(testPath) {
  return new Promise((resolve, reject) => {
    fs.lstat(testPath, (err, stat) => {
      if (err) {
        throw new Error(err);
      }
      if (!stat.isFile()) {
        return resolve(false);
      }
      resolve(true);
    });
  }).catch((e) => {
    throw new Error(e);
  });
}

editTestFiles();