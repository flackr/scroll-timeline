#!/bin/bash

PROJ_DIR="$(cd "$(dirname "$1")" && pwd)"

WPT_DIR="$PROJ_DIR/test/wpt"

# if directory does not exist, clone fresh-stuff from WPT master
if [ ! -d "$WPT_DIR" ]; then
  echo "WPT folder not found, cloning from remote..."
  git clone https://github.com/web-platform-tests/wpt $WPT_DIR
else
  # ask git to attempt to rebase our changes on top of remote
  git -C "$WPT_DIR" pull --ff-only
fi