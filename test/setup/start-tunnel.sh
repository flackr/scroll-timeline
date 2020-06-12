#!/bin/bash

PROJ_DIR="$( cd "$(dirname "$1")" && pwd)"

SAUCE_NAME=$(grep SAUCE_NAME "$PROJ_DIR/.env" | cut -d '=' -f2)
SAUCE_KEY=$(grep SAUCE_KEY "$PROJ_DIR/.env" | cut -d '=' -f2)
TUNNEL_ID=$(grep SC_TUNNEL_ID "$PROJ_DIR/.env" | cut -d '=' -f2)

check_output () {
  while read -r line; do
    echo $line
    if echo $line | grep -q 'you may start your tests.$'; then
      npm run test:sauce:run
    fi
  done
}

if [ "$(uname)" == "Darwin" ]; then
  "$PROJ_DIR/test/local-proxy/mac/sc" -u $SAUCE_NAME -k $SAUCE_KEY -i $TUNNEL_ID | check_output
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  "$PROJ_DIR/test/local-proxy/linux/sc" -u $SAUCE_NAME -k $SAUCE_KEY -i $TUNNEL_ID | check_output
fi
