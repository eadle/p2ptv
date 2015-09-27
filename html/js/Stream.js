
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
