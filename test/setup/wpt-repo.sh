#!/bin/bash

PROJ_DIR="$(cd "$(dirname "$1")" && pwd)"

WPT_DIR="$PROJ_DIR/test/wpt"

# if directory does not exist, clone fresh-stuff from WPT master
if [ ! -d "$WPT_DIR" ]; then
  echo "WPT folder not found, cloning from remote..."
  git clone https://github.com/web-platform-tests/wpt $WPT_DIR
fi

if [ ! -d "$WPT_DIR/polyfills" ]; then
  mkdir "$WPT_DIR/polyfills"
fi

rm -rf "$WPT_DIR/polyfills/scroll-timeline.js"
cp "$PROJ_DIR/dist/scroll-timeline.js" "$WPT_DIR/polyfills/"

WPT_DIR="$WPT_DIR" node "$PROJ_DIR/test/setup/inject-polyfill.js"