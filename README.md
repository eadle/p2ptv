# p2ptv
An open source P2P livestreaming module for synchronized playback in HTML5.

**p2ptv** distributes live [WebM](http://www.webmproject.org/) by sending
the [WebM Byte Stream Format](https://w3c.github.io/media-source/webm-byte-stream-format.html) directly to the browser where the experimental [MSE](https://w3c.github.io/media-source/) API is used for playback. Livestreams are
transcoded from RTMP or from a file before being processed by this module.

The plan is to **significantly** reduce the cost of livestreaming by forming
a P2P distribution network using WebRTC. Right now, it is working only as
a client-server architecture. If you're interested in starting a webservice,
it is probably in your best interest to use conventional streaming methods. 

Please note that this is alpha software. Meaning it is experimental,
unstable, incomplete, and likely to change drastically between versions.
Feel free to [contribute](#contributing) if you are interested in the
project.

## Supported browsers
- Chrome 34+
- Opera 15+ 
- Firefox 43+

## Install
```
npm install p2ptv
```
or
```
$ git clone git://github.com/siphontv/p2ptv.git
$ cd p2ptv
$ npm install
```

- You may need to [install FFmpeg](https://trac.ffmpeg.org/wiki/CompilationGuide) from source with --enable-libvorbis and --enable-libvpx flags.
- You may need to [setup an RTMP server](https://obsproject.com/forum/resources/how-to-set-up-your-own-private-rtmp-server-using-nginx.50/).
- [OBS](https://obsproject.com/download#linux) has been extremely useful. 

## Usage
Without logging:
```
$ node examples/example.js
```

With verbose logging:
```
$ DEBUG=p2ptv,gateway,peer,push-pull-window node examples/example.js
```

## Transcoding
There's no FFmpeg flag to force placement of a keyframe at the beginning of each cluster.
Until this project switches to DASH, just set -cluster_size_limit and -cluster_time_limit 
to 999999999 or some value that's greater than your expected media segments. It's ugly, but it works.

From RTMP (with upstream port set to 9001):
```
ffmpeg -re -i rtmp://localhost:1935/480p/test -c:a libvorbis -c:v libvpx \
-g 150 -crf 23 -lag-in-frames 15 -profile:v 2 -qmax 50 -qmin 1 \
-cpu-used 0 -slices 4 -b:v 2M -cluster_size_limit 999999999 \
-cluster_time_limit 999999999 -deadline realtime \
-f webm tcp://localhost:9001;
```

From a file:
```
ffmpeg -i media/test.mp4 -c:a libvorbis -c:v libvpx -g 150 -crf 23 \
-lag-in-frames 15 -profile:v 2 -qmax 50 -qmin 1 -cpu-used 0 -b:v 1M \
-cluster_size_limit 999999999 -cluster_time_limit 999999999 \
-deadline realtime -f webm tcp://127.0.0.1:9001
```

You may have better results transcoding from RTMP. It really depends on how
much processing power you're willing to give your transcoding box.

## License
MIT

## Contributing
Feel free to create an [issue](https://github.com/siphontv/p2ptv/issues) or
pull request.

Could always use some feedback from FFmpeg wizards.
