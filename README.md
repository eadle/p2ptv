# Waiting to publish...

[![NPM](https://nodei.co/npm/p2ptv.png?downloads=true&stars=true)](https://nodei.co/npm/p2ptv/)

# p2ptv
An open source P2P livestreaming module for synchronized playback in HTML5.

**p2ptv** connects a [WebRTC](http://www.webrtc.org/) gateway to the browser to
allow livestreaming of [WebM](http://www.webmproject.org/) using the WebRTC API 
and the experimental [MSE](https://w3c.github.io/media-source/) API. Livestreams
are transcoded to WebM before being pushed into the P2P delivery network.

This project is experimental, unstable, incomplete, and likely to change drastically between versions.
The gateway currently delivers the transcoding by sending the [WebM Byte Stream Format](https://w3c.github.io/media-source/webm-byte-stream-format.html) directly via the data channel, but this is likely to change to DASH. Feel free to [contribute](#contributing).

## Supported browsers
- Supports Chrome and Opera.

Firefox has an incomplete implementation of MSE. You have to modify flags in about:config.
```
media.mediasource.enabled = true
media.mediasource.webm.enabled = true
media.mediasource.whitelist = false
```

## Goals
- **significantly** reduce the cost of livestreaming
- **significantly** reduce video delivery bandwidth
- reliable MSE usage across browsers
- hybrid tree-mesh overlay network
- 720p and 1080p support

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

- You may need to [install FFmpeg](https://trac.ffmpeg.org/wiki/CompilationGuide) from source with --libvorbis and --libvpx flags.
- You may need to [setup an RTMP server](https://obsproject.com/forum/resources/how-to-set-up-your-own-private-rtmp-server-using-nginx.50/).
- [OBS](https://obsproject.com/download#linux) has been extremely useful. 

## Usage
With no logging:
```
$ node examples/example.js
```

With verbose logging:
```
$ DEBUG=p2ptv,gateway,peer,push-pull-window,encoder,webm-byte-stream node examples/example.js
```

## Transcoding
There's no FFmpeg flag to force placement of a keyframe at the beginning of each cluster.
Until this project switches to DASH, just set -cluster_size_limit and -cluster_time_limit 
to 999999999 or some value that's greater than your expected media segments. It's ugly, but it works.

From RTMP (with upstream port set to 9001):
```
ffmpeg -re -i rtmp://localhost:1935/360p/test -c:a libvorbis -c:v libvpx -g 150 -crf 23 -lag-in-frames 15 \
-profile:v 2 -qmax 50 -qmin 1 -cpu-used 0 -slices 4 -b:v 1M -cluster_size_limit 999999999 -cluster_time_limit \
999999999 -deadline realtime -f webm tcp://localhost:9001;
```

From a file (only useful for testing that p2ptv is setup correctly):
```
ffmpeg -i media/fractal.mp4 -c:a libvorbis -c:v libvpx -g 125 -crf 20 -lag-in-frames 15 -profile:v 0 -qmax 50 \
-qmin 1 -cpu-used 0 -slices 4 -b:v 1M -cluster_size_limit 999999999 -cluster_time_limit 999999999 -deadline \
realtime -f webm tcp://localhost:9001
```

## License
MIT

## Contributing
Feel free to create an [issue](https://github.com/siphontv/p2ptv/issues) or pull request.
Could always use some feedback from FFmpeg wizards.
