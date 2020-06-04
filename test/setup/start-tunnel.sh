#!/bin/bash

PROJ_DIR="$( cd "$(dirname "$1")" && pwd)"

check_output () {
  while read -r line; do
    echo $line
    if echo $line | grep -q 'you may start your tests.$'; then
      "$PROJ_DIR/test/setup/run-ci.sh"
    fi
  done
}

if [ "$(uname)" == "Darwin" ]; then
  "$PROJ_DIR/test/saucelabs-proxy/mac/sc" -u $1 -k $2 -i sc-wpt-tunnel | check_output
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  "$PROJ_DIR/test/saucelabs-proxy/linux/sc" -u $1 -k $2 -i sc-wpt-tunnel | check_output
fi

