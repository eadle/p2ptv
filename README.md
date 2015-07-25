# p2ptv
An open source P2P livestreaming module for synchronized playback in HTML5.

**p2ptv** connects a [WebRTC](http://www.webrtc.org/) gateway to the browser to
allow livestreaming of [WebM](http://www.webmproject.org/) using the WebRTC API 
and the experimental [MSE](https://w3c.github.io/media-source/) API. Livestreams
are transcoded to WebM and converted into the [WebM Byte Stream Format](https://w3c.github.io/media-source/webm-byte-stream-format.html) before being pushed into the P2P delivery network.

This project is experimental and may be unstable. Feel free to [contribute](#contributing).

## Supported browsers
- Supports Chrome and Opera.

Firefox has an incomplete implementation of MSE. You have to modify flags in about:config.
```
media.mediasource.enabled = true
media.mediasource.webm.enabled = true
media.mediasource.whitelist = false
```

# Goals
- **significantly** reduce the cost of livestreaming
- **significantly** reduce video delivery bandwidth
- reliable MSE usage across browsers
- hybrid tree-mesh overlay network
- mp4 support ([ISO BMFF Byte Stream Format](https://w3c.github.io/media-source/isobmff-byte-stream-format.html))

## Dependencies
- python2
- git 
- pkg-config
- libncurses-devel
- libssl-devel
- libnss-devel
- libexpat-devel

Debian/Ubuntu:
```
$ apt-get install python2.7 git-all pkg-config libncurses5-dev libssl-dev libnss3-dev libexpat-dev
```

CentOS/Fedora/RHEL:
```
$ yum install python git pkgconfig openssl-devel ncurses-devel nss-devel expat-devel
```

## Install
```
$ npm install p2ptv --save-dev
```

## Usage
To enable logging:
```
$ DEBUG=p2ptv,gateway,peer,push-pull-window node --harmony examples/example.js
```

## Transcoding
FFmpeg example goes here.

## License
MIT

## Contributing
There's lots of work to be done. Feel free to create an [issue](https://github.com/siphontv/webm-byte-stream/issues) or pull request.
