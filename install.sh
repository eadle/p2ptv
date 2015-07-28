#!/bin/bash

git clone git://github.com/siphontv/node-webrtc.git node_modules/wrtc
cd node_modules/wrtc
npm install
npm install && node-pre-gyp install --fallback-to-build
