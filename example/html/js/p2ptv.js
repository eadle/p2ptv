'use strict';

var P2PTV = P2PTV || {

  VERSION: 'v0.4.5',

  CHANNEL: 'p2ptvchannel',
  ICE_SERVERS: [{url: 'stun:stun.l.google.com:19302'}],
  PC_CONSTRAINTS: {optional: [{DtlsSrtpKeyAgreement: true}]},
  DC_CONSTRAINTS: {reliable: false, id: this.CHANNEL},

  MAX_MESSAGE_SIZE: 16*1024,
  MAX_CHUNKS_PER_MEDIA_SEGMENT: 256, // FIXME

  INIT_SEGMENT: 0,
  MIN_INIT_SEGMENT_HEADER: 9,
  MAX_INIT_SEGMENT_PAYLOAD: this.MAX_MESSAGE_SIZE
    - this.MIN_INIT_SEGMENT_HEADER,

  MEDIA_SEGMENT_CHUNK: 1,
  MIN_MEDIA_SEGMENT_CHUNK_HEADER: 16, 
  MAX_MEDIA_SEGMENT_CHUNK_PAYLOAD: this.MAX_MESSAGE_SIZE 
    -this.MIN_MEDIA_SEGMENT_CHUNK_HEADER,

  MEDIA_SEGMENT: 2,
  MIN_MEDIA_SEGMENT_HEADER: 9,

  STREAMS: {},

  /**
   * This function is used for logging.
   * text - The text to log.
   */
  log: function(text) {
    if (text[text.length - 1] === '\n') {
      text = text.substring(0, text.length - 1); 
    }
    if (window.performance) {
      var now = (window.performance.now() / 1000).toFixed(3);
      console.log(now + ': ' + text);
    } else {
      console.log(text);
    }
  },

  /**
   * Checks support for all APIs used by P2PTV. Returns true if the browser 
   * supports all APIs, otherwise false is returned and results can be
   * parsed for more information.
   *
   * supports - An empty object to be populated with API support results.
   */
  isSupported: function(supports) {

    if (!this._initialized) {
      throw new Error('Must initialize P2PTV before checking for support');
    }

    supports.WebSocket= !!window.WebSocket;

    supports.Blob= !!window.Blob;
    supports.FileReader= !!window.FileReader;
    supports.ArrayBuffer= !!window.ArrayBuffer;
    supports.Float64Array= !!window.Float64Array;
    supports.Uint8Array= !!window.Uint8Array;
    supports.Int32Array= !!window.Int32Array;

    supports.RTCPeerConnection= !!this.RTCPeerConnection;
    supports.RTCSessionDescription= !!this.RTCSessionDescription;
    supports.RTCIceCandidate= !!this.RTCIceCandidate;

    supports.MediaSource= !!window.MediaSource;
    supports.WebM_VP8 = (!supports.MediaSource) ? false : 
      MediaSource.isTypeSupported('video/webm;codecs="vp8,vorbis"');

    var supported = true;
    Object.keys(supports).forEach(function(key) {
      supported = supported && supports[key];
    });

    return supported;
  },

  /** 
  * Generates a unique stream id. 
  */
  generateStreamId: function() {
    var self = this;
    var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      +'abcdefghijklmnopqrstuvwxyz0123456789';
    var id = ''; 
    for (var i = 0; i < 12; i++) {
      var randomPoz = Math.floor(Math.random()*charSet.length);
      id += charSet.substring(randomPoz, randomPoz+1);
    }   
    return (id in self.STREAMS) ? self.generateStreamId() : id; 
  },

  /**
   * P2PTV uses a custom WebRTC adapter. We store the WebRTC references
   * internally to avoid breaking other WebRTC applications.
   */
  RTCPeerConnection: null,
  RTCSessionDescription: null,
  RTCIceCandidate: null,
  detectedBrowser: 'unknown',
  _initialized: false,

  /**
   * FIXME
   * A custom WebRTC adapter that works with spoofed user agents. 
   * Supports bare minimum features for maximum browser coverage.
   *
   * See: https://github.com/webrtc/adapter
   */
  adapter: function() {
    this.log('P2PTV ' + this.VERSION);
    if (!this._initialized) {
      this._initialized = true;

      // check user agent string for browser
      if (navigator.userAgent.match(/Edge/)) {
        this.log('This appears to be Edge');
        this.detectedBrowser = 'edge';
      } else if (navigator.userAgent.match(/Firefox/)) {
        this.log('This appears to be Firefox');
        this.detectedBrowser = 'firefox';
      } else if (navigator.userAgent.match(/(OPR|Opera)/)) {
        this.log('This appears to be Opera');
        this.detectedBrowser = 'opera';
      } else if (navigator.userAgent.match(/Chrom(e|ium)/)) {
        this.log('This appears to be Chrome');
        this.detectedBrowser = 'chrome';
      } else {
        this.log('This browser may not be supported');
        this.detectedBrowser = 'unknown';
      }

      if (typeof window === 'undefined' || !window.navigator) {
        // definitely not supported
        this.log('This does not appear to be a browser');
        this.detectedBrowser = 'not supported';
      } else if (!!window.mozRTCPeerConnection) {
        // has moz prefix -- firefox
        this.log('has prefix: moz');
        this.detectedBrowser = 'firefox';
        this.RTCPeerConnection = function(pcConfig, pcConstraints) {
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {url: server.urls[j]};
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
          return new mozRTCPeerConnection(pcConfig, pcConstraints);
        };
        this.RTCSessionDescription = window.RTCSessionDescription
          || window.mozRTCSessionDescription;
        this.RTCIceCandidate = window.RTCIceCandidate
          || window.mozRTCIceCandidate;

      } else if (!!window.webkitRTCPeerConnection) {
        // has webkit prefix -- chrome or opera 
        this.log('has prefix: webkit');
        if (this.detectedBrowser !== 'opera') {
          this.detectedBrowser = 'chrome';
        }
        this.RTCPeerConnection = function(pcConfig, pcConstraints) {
          return new webkitRTCPeerConnection(pcConfig, pcConstraints);
        };  
        ['createOffer', 'createAnswer'].forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            var self = this;
            if (arguments.length < 1 || (arguments.length === 1 &&
                typeof(arguments[0]) === 'object')) {
              var opts = arguments.length === 1 ? arguments[0] : undefined;
              return new Promise(function(resolve, reject) {
                nativeMethod.apply(self, [resolve, reject, opts]);
              });
            } else {
              return nativeMethod.apply(this, arguments);
            }   
          };  
        });
        ['setLocalDescription', 'setRemoteDescription',
            'addIceCandidate'].forEach(function(method) {
          var nativeMethod = webkitRTCPeerConnection.prototype[method];
          webkitRTCPeerConnection.prototype[method] = function() {
            var args = arguments;
            var self = this;
            return new Promise(function(resolve, reject) {
              nativeMethod.apply(self, [args[0],
                  function() {
                    resolve();
                    if (args.length >= 2) {
                      args[1].apply(null, []);
                    }
                  },
                  function(err) {
                    reject(err);
                    if (args.length >= 3) {
                      args[2].apply(null, [err]);
                    }
                  }]
                );
            });
          };
        });
        this.RTCSessionDescription = window.RTCSessionDescription
          || window.webkitRTCSessionDescription;
        this.RTCIceCandidate = window.RTCIceCandidate
          || window.webkitRTCIceCandidate;
      } else {
        this.log('Your browser doesn\'t appear to support WebRTC');
        this.detectedBrowser = 'not supported';
      }
    }

  },

  /* No operation. */
  NOP: function() {}

};

/**
 * A P2PTV livestream session.
 * options - The configuration for this instance.
 */
P2PTV.Stream = function(options) {
  var self = this;
  options = options || {};

  P2PTV.adapter();

  var results = {};
  if (!P2PTV.isSupported(results)) {
    P2PTV.log('Your browser does not support P2PTV ' + P2PTV.VERSION);
    if (typeof options.onNoSupport === 'function') {
      options.onNoSupport(results);
    }
    return null;
  }

  self._streamId = P2PTV.generateStreamId();
  P2PTV.STREAMS[self._streamId] = self;

  self._id = '';
  self._parents = {};
  self._children = {};
  self._player = new P2PTV.MediaPlayer(self._streamId, options);
  self._pushPullWindow = new P2PTV.PushPullWindow(self, self._player);
  self._ws = null;

  self._initialized = false;

  var server = options.server;
  if (typeof server !== 'string') {
    throw new Error('Must specify a server to connect to: ' + server);
  }
  self._setupSession(server);

  return self;
};

P2PTV.Stream.prototype = {
  /**
   * Initializes the livestream session.
   * Connects to streaming server and sets the WebSocket callback functions.
   */
  _setupSession: function(server) {
    var self = this;

    self._ws = new WebSocket(server);
    self._ws.binaryType = 'arraybuffer';

    self._ws.onopen = function() {
      P2PTV.log('connected to server');
      self._ws.send(JSON.stringify({
        'type': 'init',
        'browser': P2PTV.detectedBrowser
      }));
    };

    self._ws.onclose = function() {
      // FIXME should we attempt to reconnect?
      P2PTV.log('disconnected to server');
    };

    self._ws.onmessage = function(event) {
      var data = event.data;
      if (data instanceof ArrayBuffer) {
        self._pushData(data);
      } else {
        var message = {};
        try {
          message = JSON.parse(data);
        } catch(error) {
          // FIXME how do you want to handle this?
          P2PTV.log(error);
          return;
        }
        self._handleMessage(message);
      }
    };

    self._ws.onerror = function(error) {
      // FIXME how do you want to handle this?
      P2PTV.log('!!! WebSocket Error: ' + error + ' !!!');
    };

  },

  /**
   * Handle a session message received from the server.
   * message - A session management message.
   */
  _handleMessage: function(message) {
    var self = this;

    switch (message.type) {
      case 'handle':
        self._id = message.id;
        P2PTV.log('received id: ' + self._id);
        self._initialized = true;
        break;
      case 'peer':
        var pid = message.id,
            relation = message.relation;
        P2PTV.log('adding peer ' + pid + ': ' + relation);
        var peer = self._setupPeerConnection(pid, relation);
        peer.channel = peer.pc.createDataChannel(P2PTV.DC_CONSTRAINTS);
        peer.setupDataChannel();
        if ('parent' === relation) {
          self._parents[pid] = peer;
        } else {
          self._children[pid] = peer;
        }
        self._makeOffer(peer);
        break;
      case 'offer':
        var pid = message.id,
            relation = message.relation;
        P2PTV.log('answering peer ' + pid + ': ' + relation);
        var peer = self._setupPeerConnection(pid, relation);
        peer.pc.ondatachannel = function(event) {
          peer.channel = event.channel;
          peer.setupDataChannel();
          if ('parent' === relation) {
            self._parents[pid] = peer;
          } else {
            self._children[pid] = peer;
          }
        };
        self._handleOffer(message, peer);
        break;
      case 'answer':
        P2PTV.log('received answer sdp from: ' + message.id);
        var pid = message.id;
        var peer = (pid in self._parents)
          ? self._parents[pid] : self._children[pid];
        self._handleAnswer(message, peer);
        break;
      case 'ice':
        P2PTV.log('received ice candidate from: ' + message.id);
        var pid = message.id;
        if (pid in self._parents) {
          self._handleIce(message, self._parents[pid]);
        } else if (pid in self._children) {
          self._handleIce(message, self._children[pid]);
        }
        break;
      default:
    }

  },

  /**
   * TODO fill this out
   *
   * data -
   */
  _pushData: function(data) {
    var self = this;

    // FIXME data should be emitted from window to other peers
    self._pushPullWindow.pushData(data);

    // broadcast data to children
    for (var key in self._children) {
      if (self._children.hasOwnProperty(key)) {
        self._children[key].send(data);
      }
    }
  },

  /**
   * TODO fill this out
   *
   * peer -
   */
  _setupPeerConnection: function(peer) {
    var self = this;
    var peer = new Peer(self, pid, relation);
    peer.pc = new P2PTV.RTCPeerConnection(P2PTV.ICE_SERVERS,
      P2PTV.PC_CONSTRAINTS);
    peer.pc.onicecandidate = function(event) {
      var candidate = event.candidate;
      if (candidate) {
        self._ws.send(JSON.stringify({
          'type': 'ice',
          'id': peer.id,
          'sdp': candidate
        }));
      }
    };
    return peer;
  },

  /**
   * TODO fill this out
   *
   * peer -
   */
  _makeOffer: function(peer) {
    var self = this;
    peer.pc.createOffer(function(desc) {
      P2PTV.log('created offer for: ' + peer.id);
      peer.pc.setLocalDescription(desc, function() {
        P2PTV.log('set local description for: ' + peer.id);
        var mystate = (peer.id in self._parents) ? 'child' : 'parent';
        self._ws.send(JSON.stringify({
          'type': 'offer',
          'relation': mystate,
          'id': peer.id,
          'sdp': desc.sdp
        }));
      }, self._traceErr);
    }, self._traceErr);
  },

  /**
   * TODO fill this out
   *
   * peer -
   */
  _makeAnswer: function(peer) {
    var self = this;
    peer.pc.createAnswer(function(desc) {
      P2PTV.log('created answer for: ' + peer.id);
      peer.pc.setLocalDescription(desc, function() {
        P2PTV.log('set local description answer for: ' + peer.id);
        self._ws.send(JSON.stringify({
          'type': 'answer',
          'id': peer.id,
          'sdp': desc.sdp
        }));
      }, self._traceErr);
    }, self._traceErr);
  },

  /**
   * TODO fill ths out
   *
   * offer -
   * peer -
   */
  _handleOffer: function(offer, peer) {
    var self = this;
    var sdp = new P2PTV.RTCSessionDescription(offer);
    peer.pc.setRemoteDescription(sdp, function() {
      P2PTV.log('set remote offer description for: ' + peer.id);
      self._makeAnswer(peer);
    }, self._traceErr);
  },

  /**
   * TODO fill this out
   *
   * answer -
   * peer -
   */
  _handleAnswer: function(answer, peer) {
    var self = this;
    var sdp = new P2PTV.RTCSessionDescription(answer);
    peer.pc.setRemoteDescription(sdp, function() {
      P2PTV.log('set remote answer description for: ' + peer.id);
    }, self._traceErr);
  },

  /**
   * TODO fill this out
   *
   * sdp -
   * peer -
   */
  _handleIce: function(sdp, peer) {
    var self = this;
    var candidate = new RTCIceCandidate(sdp);
    peer.pc.addIceCandidate(candidate, function() {
      P2PTV.log('successfully added ICE candidate for: ' + peer.id);
    }, self._traceErr);
  },
  
  /** TODO fill this out */
  _traceErr: function(err) {
    P2PTV.log(err);
  },

};

P2PTV.Stream.prototype.constructor = P2PTV.Stream;

/**
 * Simple MSE wrapper for playback of WebM Byte Stream Format.
 *
 * id - The stream id generated for the associated stream.
 * options - The options for the video player.
 */
P2PTV.MediaPlayer = function(id, options) {
  var self = this;
  options = options || {};

  if (typeof id !== 'string') {
    throw new Error('P2PTV MediaPlayer expects an id: ' + id);
  }

  self._id = id;
  self._streamQueue = [];

  // control settings
  self._timeDisplayMode = 0;
  self._playOnMediaSegment = true;

  // create video element
  self._video = document.createElement('video');
  self._video.id = 'p2ptv-' + self._id;
  self._video.width = options.width || 854;
  self._video.height = options.height || 480;
  self._video.controls = !options.mediaPlayerControls;
  if (typeof options.mediaPlayerControls === 'object') {
    self._setupControls(options.mediaPlayerControls);
  }

  // append video element
  var parentElementId = options.parentElementId;
  self._parentElement = document.getElementById(parentElementId);
  if (!!self._parentElement) {
    P2PTV.log('Appending stream ' + self._id + ' to ' + parentElementId);
    self._parentElement.appendChild(self._video);
  } else {
    P2PTV.log('Appending stream ' + self._id + ' to body');
    document.body.appendChild(self._video);
    self._parentElement = document.body;
  }

  // FIXME temporary update loop
  setInterval(function() {

    if (self._streamQueue.length > 0) {
      var stream = self._streamQueue[0];

      // FIXME should switch stream.readyState
      if (!stream.active) {
        stream.active = true;
        self._video.src = window.URL.createObjectURL(stream.mediaSource);
        self._video.pause();
      } else if (self._streamIsFinished(stream)) {
        var oldStream = self._streamQueue.shift();
        oldStream.mediaSource.endOfStream();
      } else if (self._streamCanAppend(stream)) {
        stream.appending = true;
        var mediaSegment = stream.mediaSegmentQueue.shift();
        stream.sourceBuffer.timestampOffset = mediaSegment.timestampOffset;
        stream.reader.readAsArrayBuffer(mediaSegment.data);
      }

    }

  }, 1000/30);

};

P2PTV.MediaPlayer.prototype = {

  /** Returns true if a stream should append to the source buffer. */
  _streamCanAppend: function(stream) {
    return !stream.appending && !stream.sourceBuffer.updating
      && (stream.mediaSegmentQueue.length > 0);
  },

  /** Returns true if a stream . */
  _streamIsFinished: function(stream) {
    var self = this;
    return stream.complete && stream.stalled
      && (stream.mediaSegmentQueue.length === 0);
  },

  /** Setup MediaSource, SourceBuffer, and FileReader callbacks. */
  _setupStreamCallbacks: function(stream) {
    var self = this;

    stream.mediaSource.addEventListener('sourceopen', function(event) {
      // P2PTV.log('MediaSource event: sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';

      stream.sourceBuffer = stream.mediaSource.addSourceBuffer(type);

      stream.sourceBuffer.addEventListener('updateend', function() {
        // P2PTV.log('SourceBuffer event: updateend');
        stream.appending = false;
      }, false);

      stream.sourceBuffer.appendBuffer(stream.initSegment);

    }, false);

    stream.mediaSource.addEventListener('sourceended', function(event) {
      // P2PTV.log('MediaSource event: sourceended');
    }, false);

    stream.reader.onload = function(event) {
      stream.sourceBuffer.appendBuffer(new Uint8Array(event.target.result));
      if (stream.reader.readyState === FileReader.DONE) {
        if (stream.active && self._video.paused
          && self._playOnMediaSegment) {
          P2PTV.log('playing video');
          self._video.play();
        }
      }
    };

  },

  /** Setup custom controls. */
  _setupControls: function(controls) {
    var self = this;
    controls = controls || {};

    self._playerContainerElement = controls.playerContainer;

    // media player callbacks
    self._onPlayCallback = controls.onPlay || P2PTV.NOP;
    self._onPauseCallback = controls.onPause || P2PTV.NOP;
    self._onLastCallback = controls.onLast || P2PTV.NOP;
    self._onMuteCallback = controls.onMute || P2PTV.NOP;
    self._onUnmuteCallback = controls.onUnmute || P2PTV.NOP;
    self._onVolumeChangeCallback = controls.onVolumeChange || P2PTV.NOP;
    self._onSettingsCallback = controls.onSettings || P2PTV.NOP;
    self._onMaximizeCallback = controls.onMaximize || P2PTV.NOP;
    self._onMinimizeCallback = controls.onMinimize || P2PTV.NOP;

    // gui elements
    self._playbackButtonElement = controls.playbackButton;
    self._lastButtonElement = controls.lastButton;
    self._volumeButtonElement = controls.volumeButton;
    self._volumeSliderElement = controls.volumeSlider;
    self._settingsButtonElement = controls.settingsButton;
    self._resizeButtonElement = controls.resizeButton;
    self._elapsedTimeElement = controls.elapsedTime;

    // playing and pausing stream 
    if (!!self._playbackButtonElement) {
      self._playbackButtonElement.onclick = function() {
        if (self._video.paused) {
          self._playOnMediaSegment = true;
          self._video.play();
        } else {
          self._playOnMediaSegment = false;
          self._video.pause();
        }
      };
    }

    // jumping to most recent media segment
    if (!!self._lastButtonElement) {
      self._lastButtonElement.onclick = function() {
        // TODO jump to the last media segment
        console.log('!!! last button click not implemented !!!');
        self._onLastCallback();
      };
    }

    // muting and unmuting
    if (!!self._volumeButtonElement) {
      self._volumeButtonElement.onclick = function() {
        self._video.muted = !self._video.muted;
        if (self._video.muted) {
          self._onMuteCallback();
        } else {
          self._onUnmuteCallback();
        }
      };
    }

    // FIXME volume slider needs some fine-tweaking
    if (!!self._volumeSliderElement) {
      self._volumeSliderElement.onchange = function() {
        if (self._video.muted) {
          self._video.muted = false;
        }
        self._video.volume = self._volumeSliderElement.value/100;
      };
      self._volumeSliderElement.oninput = function() {
        if (self._video.muted) {
          self._video.muted = false;
        }
        self._video.volume = self._volumeSliderElement.value/100;
      };
    }

    // FIXME not sure how to handle this yet
    if (!!self._settingsButtonElement) {
      self._settingsButtonElement.onclick = function() {
        self._onSettingsCallback();
      };
    }

    // maximizing and minimizing the media player
    if (!!self._resizeButtonElement) {
      self._resizeButtonElement.onclick = function() {

        if (self.isFullScreen()) {
          // minimize window
          if (document.cancelFullScreen) {
            document.cancelFullScreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
          }
        } else {
          // maximize window
          if (self._playerContainerElement.mozRequestFullScreen) {
            self._playerContainerElement.mozRequestFullScreen();
          } else {
            self._playerContainerElement.webkitRequestFullScreen();
          }
        }

      };
    }

    // clicking elapsed time changes display mode
    if (!!self._elapsedTimeElement) {
      self._elapsedTimeElement.onclick = function() {
        // TODO clicking elapsed time should change format mode
        // ...
      };
    }

    self._video.onstalled = function() {
      if (self._streamQueue.length > 0) {
        self._streamQueue[0].stalled = true;
      }
    };

    self._video.addEventListener('playing', function() {
      self._onPlayCallback();
    }, false);

    self._video.addEventListener('pause', function() {
      self._onPauseCallback();
    }, false);

    self._video.addEventListener('volumechange', function() {
      if (!self._video.muted) {
        self._onVolumeChangeCallback(self._video.volume);
      }
    }, false);

    self._video.addEventListener('timeupdate', function() {
      if (!!self._elapsedTimeElement) {
        var currentTime = self._video.currentTime;
        var hours = Math.floor(currentTime/3600),
            minutes = Math.floor(currentTime/60)%60,
            seconds = Math.floor(currentTime)%60;
        var format = (hours > 0) ? hours + ';' : '';
        format += (hours > 0 && minutes < 10) ? '0' + minutes : minutes;
        format += ':';
        format += (seconds < 10) ? '0' + seconds : seconds;
        self._elapsedTimeElement.innerHTML = format;
      }
    }, false);

    var onFullScreenChange = function() {
      if (self.isFullScreen()) {
        self._onMaximizeCallback();
      } else {
        self._onMinimizeCallback();
      }
    };
    // FIXME shouldn't set all of them
    document.onmozfullscreenchange = onFullScreenChange;
    document.onwebkitfullscreenchange = onFullScreenChange;
    document.onfullscreenchange = onFullScreenChange;

  },

  /** Returns true if the media player is in fullscreen. */
  isFullScreen: function() {
    return (document.webkitIsFullScreen || document.mozFullScreen);
  },


    
  /**
   * Append an initialization segment to the append stream.
   *
   * data - An initialization segment ArrayBuffer.
   */
  appendInitSegment: function(data) {
    var self = this;

    P2PTV.log('appending initialization segment: length=' + data.byteLength
      + ' bytes');

    if (self._streamQueue.length > 0) {
      // previous stream isn't expecting any more media segments
      self._streamQueue[self._streamQueue.length-1].complete = true;      
    }

    var stream = {
      active: false,
      appending: true,
      complete: false,
      stalled: false,
      initSegment: data,     // stores ArrayBuffer
      mediaSegmentQueue: [], // stores Blob and timestampOffset
      initialTimecode: -1,   // initial media segment timecode unknown
      sourceBuffer: null,
      mediaSource: new MediaSource(),
      reader: new FileReader()
    };
    self._setupStreamCallbacks(stream);
    self._streamQueue.push(stream);

  },

  /**
   * Append a media segment to the append stream.
   *
   * data - A media segment Blob with a zeroed out timecode.
   * timecode - The original timecode of the media segment.
   */
  appendMediaSegment: function(data, timecode) {
    var self = this;

    P2PTV.log('appending media segment: timecode=' + timecode
     + ', length=' + data.size + ' bytes');

    var stream = self._streamQueue[self._streamQueue.length - 1];

    if (stream.initialTimecode < 0) {
      stream.initialTimecode = timecode;
    }

    timecode = timecode | 0;
    var timestampOffset = (timecode - stream.initialTimecode)/1000;

    stream.mediaSegmentQueue.push({
      timestampOffset: timestampOffset,
      data: data
    });

  }

};

P2PTV.MediaPlayer.prototype.constructor = P2PTV.MediaPlayer;

/**
 * TODO fill this out
 *
 * client -
 * id -
 * relation -
 */
P2PTV.Peer = function(client, id, relation) {
  var self = this;

  self._client = client || null;
  if (null === self._client || undefined === self._client) {
    throw new Error('Peer expects client reference');
  }

  self.id = id || null;
  if (typeof self.id !== 'string') {
    throw new Error('Peer expects valid identifier');
  }

  if (relation !== 'parent' && relation !== 'child') {
    throw new Error('Peer expects valid relation');
  }

  self.isParent = ('parent' === relation);
  self.isChild = !self.isParent;
  self.pc = null;
  self.channel = null;

};

P2PTV.Peer.prototype = {
  /**
   * TODO fill this out
   * message -
   */
  send: function(message) {
    var self = this;
    if ('open' === self.channel.readyState) {
      self.channel.send(message);
    }
  },

 
  /**
   * TODO fill this out
   */
  setupDataChannel: function() {
    var self = this;
    self.channel.binaryType = 'arraybuffer';

    // on p2ptvchannel open 
    self.channel.onopen = function() {
      var readyState = self.channel.readyState;
      P2PTV.log(P2PTV.CHANNEL + ' state is: ' + readyState);
      if ('open' === readyState) {
        var testMessage = P2PTV.CHANNEL + ' test message';
        P2PTV.log('sent data channel message: "' + testMessage + '"');
        self.send(testMessage);
      }   
    };  

    // on p2ptvchannel close
    self.channel.onclose = function() {
      var readyState = self.channel.readyState;
      P2PTV.log(P2PTV.CHANNEL + ' state is: ' + readyState);
    }

    if (self.isParent) {
      // on parent p2ptvchannel message
      self.channel.onmessage = function(event) {
        var data = event.data;
        if (typeof data === 'string') {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' string: ' + data);
        } else {
          self._client._pushData(data);
        }
      };
    } else {
      // on child p2ptvchannel message
      self.channel.onmessage = function(event) {
        var data = event.data;
        if (typeof data === 'string') {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' string: ' + data);
        } else {
          P2PTV.log('received ' + P2PTV.CHANNEL + ' ArrayBuffer: '
            + data.byteLength + ' bytes');
        }
      };
    }

    // on p2ptvchannel error
    self.channel.onerror = function(err) {
      P2PTV.log(P2PTV.CHANNEL + ' error: ' + err.toString());
    };

    P2PTV.log('setup ' + P2PTV.CHANNEL);
  }


};

P2PTV.Peer.prototype.constructor = P2PTV.Peer;

P2PTV.InitSegment = function(args) {
  var self = this;
  args = args || {};

  self._timecode = args.timecode;
  self._start = args.start;
  self._data = args.data;

};

P2PTV.InitSegment.prototype = {

};

P2PTV.InitSegment.prototype.constructor = P2PTV.InitSegment;

/**
 * TODO write description
 *
 * chunk -
 */
P2PTV.MediaSegment = function(chunk) {
  var self = this;

  self._timecode = chunk.timecode;
  self._numChunks = chunk.finalIndex + 1;
  self._chunkData = new Array(self._numChunks);
  self._blob = null;
  self._processed = [];

  self.addChunk(chunk);

};

P2PTV.MediaSegment.prototype = {
  /**
   * Add media segment chunk data.
   *
   * chunk - The media segment chunkattributes and data.
   */
  addChunk: function(chunk) {
    var self = this;

    if (chunk.index < self._numChunks && !self._chunkData[chunk.index]) {
      self._chunkData[chunk.index] = chunk.data.slice(chunk.start);
      self._processed.push(chunk.index);
    }

  },
  /**
   *
   */
  needsPull: function() {

  },

  /**
   *
   */
  isComplete: function() {
    return this._processed.length === this._numChunks;
  },

  /**
   * Assembly the media segment chunks into a Blob.
   */
  getBlob: function(initSegment) {
    var self = this;
    if (null === self._blob) {
      if (!!initSegment) {
        P2PTV.log('in getBlob: unshifting an initialization segment');
        self._chunkData.unshift(initSegment);
      }
      self._blob = new Blob(self._chunkData, {type: 'video/webm'});
    }
    return self._blob;
  },
  /**
   * Should be called before deleting this object.
   */
  destroy: function() {
    // TODO
  },
};

P2PTV.MediaSegment.prototype.constructor = P2PTV.MediaSegment;

/**
 * TODO write description
 * stream -
 */
P2PTV.PushPullWindow = function(stream, player) {
  var self = this;

  self._stream = stream;
  if (!self._stream) {
    throw new Error('Must pass Stream reference to PushPullWindow');
  }

  self._player = player;
  if (!self._player) {
    throw new Error('Must pass Player reference to PushPullWindow');
  }

  self._key = null;
  self._stream = {};

};

P2PTV.PushPullWindow.prototype = {

  /**
   * Push data received from parent into the window.
   *
   * data - ArrayBuffer storing a P2PTV message. Byte length is a multiple 
   *        of 8 greater than or equal to 16.
   */
  pushData: function(data) {
    this._decode(data);
  },

  /**
   * // TODO write description
   * data -
   */
  _decode: function(data) {
    var self = this;

    var float64view = new Float64Array(data),
        uint8view = new Uint8Array(data, 8),
        int32view = new Int32Array(data);

    var type = uint8view[0] >> 6,
        timecode = float64view[0];
    
    switch (type) {
      case P2PTV.INIT_SEGMENT:
        var start = 9 + (0x07 & uint8view[0]);
        self._pushInitSegment({
          timecode: timecode,
          start: start,
          data: data
        }); 
        break;
      case P2PTV.MEDIA_SEGMENT_CHUNK:
        var padding = 0x07 & uint8view[0];
        self._pushMediaSegmentChunk({
          timecode: timecode,
          index: uint8view[1],
          finalIndex: uint8view[2],
          duration: int32view[3],
          start: padding + 16,
          data: data
        });
        break;
      /*
      case P2PTV.MEDIA_SEGMENT:
        var start = ??;
        self._pushMediaSegment({
          timecode: timecode,
          data: 
        });
        break;
      */
      default: // not implemented
    }

  },

  /**
   * TODO fill this out
   * initSegment - The decoded initialization segment message.
   */
  _pushInitSegment: function(initSegment) {
    var self = this;

    self._key = initSegment.timecode;
    self._stream[self._key] =  {
      initSegment: initSegment,
      mediaSegmentHash: {},
      timecodeQueue: []
    };

    self._player.appendInitSegment(
      initSegment.data.slice(initSegment.start)
    );
  },

  /**
   * TODO fill this out
   * chunk - The decoded media segment chunk message.
   */
  _pushMediaSegmentChunk: function(chunk) {
    var self = this;
    
    var stream = self._stream[self._key];
    var mediaSegment = null;

    if (!(chunk.timecode in stream.mediaSegmentHash)) {
      mediaSegment = new P2PTV.MediaSegment(chunk);
      stream.mediaSegmentHash[chunk.timecode] = mediaSegment;
      stream.timecodeQueue.push(chunk.timecode);
    } else {
      mediaSegment = stream.mediaSegmentHash[chunk.timecode];
      mediaSegment.addChunk(chunk);
    }

    if (mediaSegment.isComplete()) {
      self._player.appendMediaSegment(
        mediaSegment.getBlob(),
        chunk.timecode
      );
    }

  },
  
  /**
   * TODO write function description
   * mediaSegment - The decoded media segment message.
   */
  _pushMediaSegment: function(mediaSegment) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   */
  _pullInitSegment: function(timecode) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   * chunkIndex -
   */
  _pullMediaSegmentChunk: function(timecode, chunkIndex) {
    // TODO
  },

  /**
   * TODO write function description
   */
  reset: function() {
    // TODO
  }
};

P2PTV.PushPullWindow.prototype.constructor = P2PTV.PushPullWindow;
