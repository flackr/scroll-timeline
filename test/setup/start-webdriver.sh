#!/bin/bash

PROJ_DIR="$(cd "$(dirname "$1")" && pwd)"

npm run serve:wpt > /dev/null 2>&1 &

until $(curl --output /dev/null --silent --head --fail http://localhost:8081/polyfills/scroll-timeline.js); do
    npm run test:run:webdriver
    sleep 5
done

