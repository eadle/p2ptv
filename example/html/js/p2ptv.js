'use strict';

var P2PTV = P2PTV || {

  VERSION: 'v0.2.0',
  CHANNEL: 'p2ptvchannel',
  ICE_SERVERS: [{url: 'stun:stun.l.google.com:19302'}],
  PC_CONSTRAINTS: {optional: [{DtlsSrtpKeyAgreement: true}]},
  DC_CONSTRAINTS: {reliable: false, id: this.CHANNEL},
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
   * P2PTV uses a custom WebRTC adapter. We store the WebRTC references
   * internally to avoid breaking other WebRTC applications.
   */
  RTCPeerConnection: null,
  RTCSessionDescription: null,
  RTCIceCandidate: null,
  detectedBrowser: 'unknown',
  _initialized: false,

  /**
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
        this.detectedBrowser('not supported');
      }
    }

  },

  /**
   * Checks support for all APIs used by P2PTV. Returns true if the browser 
   * supports all APIs, otherwise false is returned and results can be
   * parsed for more information.
   *
   * results - An empty object to be populated with API support results.
   */
  isSupported: function(results) {
    results = {};

    if (!this._initialized) {
      throw new Error('Must initialize P2PTV before checking for support');
    }

    // check WebSocket support
    results.supportsWebSocket = !!window.WebSocket;
    // check WebRTC v1.0 support -- internal references generated by adapter
    results.supportsRTCPeerConnection = !!this.RTCPeerConnection;
    results.supportsRTCSessionDescription = !!this.RTCSessionDescription;
    results.supportsRTCIceCandidate = !!this.RTCIceCandidate;
    // check MSE support
    results.supportsMediaSource = !!window.MediaSource;

    var supported = true;
    Object.keys(results).forEach(function(key) {
      supported = supported && results[key];
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
  }

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

  self._id = '';
  self._parents = {};
  self._children = {};
  self._initialized = false;
  self._streamId = P2PTV.generateStreamId();
  P2PTV.STREAMS[self._streamId] = self;
  // TODO implement P2PTV.Window
  // self._window = new P2PTV.Window();
  self._player = new P2PTV.Player(self._streamId, options);
  self._ws = null;

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
    // FIXME should be passing received data to the window
    var self = this;
    self._player.addData(data);
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
    peer.pc = new RTCPeerConnection(P2PTV.ICE_SERVERS,P2PTV.PC_CONSTRAINTS);
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
    var sdp = new RTCSessionDescription(offer);
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
    var sdp = new RTCSessionDescription(answer);
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
 * TODO fill this out
 *
 * streamId -
 * options - 
 */
P2PTV.Player = function(streamId, options) {
  var self = this;
  options = options || {};

  if (typeof streamId !== 'string') {
    throw new Error('P2PTV Player expects stream id: ' + streamId);
  }
  self._streamId = streamId;

  // FIXME width and height should be options
  self._width = 854;
  self._height = 480;
  self._parentElementId = options.parentElementId;

  self._initSegment = null;
  self._clusters = {}; 
  self._timecodeQueue = []; 
  self._appending = false;
  self._isPlaying = false;

  self._mediaSource = null;
  self._sourceBuffer = null;
  self._setupVideo();

  self._reader = new FileReader();
  self._reader.onload = function(e) {
    self._sourceBuffer.appendBuffer(new Uint8Array(e.target.result));
  };

};

P2PTV.Player.prototype = {
  /**
   * TODO fill this out
   */
  _setupVideo: function() {
    var self = this;

    // using MSE
    self._mediaSource = new MediaSource();

    // create video element
    var parentElement = document.getElementById(self._parentElementId);
    self._video = document.createElement('video');
    self._video.id = 'p2ptv-' + self._streamId;
    self._video.controls = true;
    self._video.width = self._width;
    self._video.height = self._height;
    self._video.src = window.URL.createObjectURL(self._mediaSource);
    self._video.pause();

    // append video element
    if (!!parentElement) {
      P2PTV.log('Appending stream ' + self._streamId + ' to '
        + self._parentElementId);
      parentElement.appendChild(self._video);
    } else {
      P2PTV.log('Appending stream ' + self._streamId + ' to body');
      document.body.appendChild(self._video);
    }

    // when the media source object is ready
    self._mediaSource.addEventListener('sourceopen', function(e) {
      P2PTV.log('sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';
      self._sourceBuffer = self._mediaSource.addSourceBuffer(type);
      self._sourceBuffer.addEventListener('updateend', function() {
        if (self._timecodeQueue.length > 0) {
          self._appendMediaSegment(self._timecodeQueue.shift());
        }   
      }, false);
    }, false);

    // testing sourceended callback
    self._mediaSource.addEventListener('sourceended', function(e) {
      P2PTV.log('source ended');
    }, false);

    // testing sourceclose callback
    self._mediaSource.addEventListener('sourceclose', function(e) {
      P2PTV.log('source closed');
    }, false);

  },

  /**
   * TODO fill this out
   *
   * timecode -
   */
  _appendMediaSegment: function(timecode) {
    var self = this;
    self._appending = true;
    P2PTV.log('appending media segment: timecode='+timecode);

    var cluster = new Blob(self._clusters[timecode], {type: 'video/webm'});
    self._reader.readAsArrayBuffer(cluster);

    if (!self._isPlaying) {
      P2PTV.log('playing video');
      self._isPlaying = true;
      self._video.play();
    }

    delete self._clusters[timecode];
    self._appending = false;
  },

  addData: function(data) {
    var self = this;

    // decode the message
    var float64view = new Float64Array(data);
    var timecode = float64view[0];
    var uint8view = new Uint8Array(data, 8);
    var int32view = new Int32Array(data);
    var type = uint8view[0] >> 6;
    switch (type) {
      case 0:
        var start = 9 + (0x07 & uint8view[0]);
        P2PTV.log('appending initialization segment: timecode=' + timecode);
        // check if we should add the init seg to source
        self._sourceBuffer.appendBuffer(data.slice(start));
        //self._initSegment = data.slice(start);
        break;
      case 1:

        // decode relevant header information
        var start = 16 + (0x07 & uint8view[0]);
        var lastIndex = uint8view[2];
        var chunkIndex = uint8view[1];

        //var duration = int32view[3];
        //P2PTV.log('received a chunk: chunkIndex=' + chunkIndex
        // + ', finalIndex=' + lastIndex + ', duration=' + duration + 'ms');

        // insert the cluster chunk into the cluster
        var cluster = self._clusters[timecode];
        if (!cluster) {
          cluster = new Array(lastIndex+1);
          cluster[chunkIndex] = data.slice(start);
          self._clusters[timecode] = cluster;
        } else {
          cluster[chunkIndex] = data.slice(start);
        }

        // check if we have a full cluster
        if (chunkIndex+1 === cluster.length) {
          //P2PTV.log('received a cluster: ' + timecode);
          if (!self._appending && self._timecodeQueue.length === 0)
            self._appendMediaSegment(timecode);
          else
            self._timecodeQueue.push(timecode);
        }

      default:
    }

  }

};

P2PTV.Player.prototype.constructor = P2PTV.Player;

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

P2PTV.Encoder = function() {

};

P2PTV.Encoder.prototype = {

};

P2PTV.Encoder.prototype.constructor = P2PTV.Encoder;

P2PTV.Decoder = function() {

};

P2PTV.Decoder.prototype = {

};

P2PTV.Decoder.prototype.constructor = P2PTV.Decoder;

P2PTV.InitSegment = function() {

};

P2PTV.InitSegment.prototype = {

};

P2PTV.InitSegment.prototype.constructor = P2PTV.InitSegment;

P2PTV.MediaSegment = function() {

};

P2PTV.MediaSegment.prototype = {

};

P2PTV.MediaSegment.prototype.constructor = P2PTV.MediaSegment;

P2PTV.Window = function() {

};

P2PTV.Window.prototype = {

};

P2PTV.Window.prototype.constructor = P2PTV.Window;
