#!/bin/bash

TEST_DIR="test/wpt"

# if directory does not exist, clone fresh-stuff from WPT master
if [ ! -d $TEST_DIR ]; then
  git clone https://github.com/web-platform-tests/wpt $TEST_DIR
fi

check_output () {
  while read -r line; do
    echo $line
    if echo $line | grep -q 'you may start your tests.$'; then
      npm run test:ci
    fi
  done
}

./test/saucelabs_proxy/sc -u ${args[0]} -k ${args[1]} -i sc-wpt-tunnel | check_output

