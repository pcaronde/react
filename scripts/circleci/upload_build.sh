#!/bin/bash

set -e

if [ -z $CI_PULL_REQUEST ] && [ -n "$BUILD_SERVER_ENDPOINT" ]; then
  curl \
    -F "react=@build/dist/react.development.js" \
    -F "react.min=@build/dist/react.production.min.js" \
    -F "react-dom=@build/dist/react-dom.development.js" \
    -F "react-dom.min=@build/dist/react-dom-production.min.js" \
    -F "react-dom-server=@build/dist/react-dom-server.development.js" \
    -F "react-dom-server.min=@build/dist/react-dom-server.production.min.js" \
    -F "commit=$CIRCLE_SHA1" \
    -F "date=`git log --format='%ct' -1`" \
    -F "pull_request=false" \
    -F "token=$BUILD_SERVER_TOKEN" \
    -F "branch=$CIRCLE_BRANCH" \
    $BUILD_SERVER_ENDPOINT
fi
