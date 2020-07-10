#!/bin/bash

# remove old demo site folder & create new empty one
rm -rf build
mkdir build

# recursively copy demo/ dir to build/
cp -rf demo/ build/

# copy demos root page that lists all demos
cp index.html build/

# copy the latest dist/ folder which has the polyfill files
cp -rf dist build/

# update every *.html file in build folder to the deployed polyfill dist/ folder
# local dev env: demos points to ../../dist
# production env: demos point to ../dist

# sed behaviour differs a bit between unix variants
# this works well in linux-based OS (e.g. GitHub CI) or perosnal Macs
if [ "$(uname)" == "Darwin" ]; then
  find build -name '*.html' -exec sed -i '' -e 's/..\/..\/dist/..\/dist/g' {} +
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  find build -name '*.html' -exec sed -i 's/..\/..\/dist/..\/dist/g' {} +
fi
