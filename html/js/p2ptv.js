/* p2ptv.js -- prototype API */
'use strict';

function P2PTV(options) {
  var self = this;
  options = options || {};

  if (!(window.RTCPeerConnection && window.RTCSessionDescription && window.RTCIceCandidate)) {
    trace('Your browser does not support WebRTC v1.0 API');
    // TODO provide upgrade options
    return;
  }

  var vidElement = document.getElementById(options.video);
  if (null === vidElement || undefined === vidElement) {
    throw new Error('must specify a valid video element id');
    return;
  }

  self._iceServers = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
  self._pcConstraints = {optional: [{DtlsSrtpKeyAgreement: true}]};
  self._dcConstraints = {reliable: false, id: 'p2ptvchannel'};

  self._id = '';
  self._parents = {};
  self._children = {};
  self._initialized = false;
  self._player = new TempPlayer(options.video);  // FIXME

  self._ws = null;
  var server = options.server;
  if (undefined === server || null === server) {
    throw new Error('must specify a server to connect to');
    return;
  }
  self._setupServerConnection(server);
  
  trace('p2ptv v0.0.0');
}

P2PTV.prototype._setupServerConnection = function(server) {
  var self = this;
  self._ws = new WebSocket(server);

  self._ws.onopen = function() {
    trace('connected to server');
    self._ws.send(JSON.stringify({
      'type': 'init',
      'browser': webrtcDetectedBrowser
    }));
  };

  self._ws.onclose = function() {
    trace('disconnected from server');
  };

  self._ws.onmessage = function(event) {
    var message = JSON.parse(event.data);
    trace('received message from ' + message.id + ': ' + event.data);
    switch (message.type) {
      case 'handle':
        self._id = message.id;
        self._initialized = true;
        trace('received id: ' + self._id);
        break;
      case 'peer':
        // trace('connect to peer: ' + message.id);
        var pid = message.id,
            relation = message.relation;
        trace('add peer ' + pid + ': ' + relation);
        var peer = self._setupPeerConnection(pid, relation);
        // offerer has to create the data channel
        peer.channel = peer.pc.createDataChannel(self._dcConstraints);
        peer.setupDataChannel();
        if ('parent' === relation) {
          self._parents[pid] = peer;
        } else {
          self._children[pid] = peer;
        }
        self._makeOffer(peer);
        break;
      case 'offer':
        trace('received offer sdp from ' + message.id + ': '+ event.data);
        var pid = message.id,
            relation = message.relation;
        trace('answer peer ' + pid + ': ' + relation);
        var peer = self._setupPeerConnection(pid, relation);
        // on data channel callback
        peer.pc.ondatachannel = function(event) {
          peer.channel = event.channel;
          peer.setupDataChannel();
          if ('parent' === relation) {
            self._parents[pid] = peer;
          } else {
            self._children[pid] = peer;
          }
        };
        // handle the SDP offer
        self._handleOffer(message, peer);
        break;
      case 'answer':
        trace('received answer sdp from: ' + message.id);
        var pid = message.id;
        var peer = (pid in self._parents) ? self._parents[pid] : self._children[pid];
        self._handleAnswer(message, peer);
        break;
      case 'ice':
        trace('received ice candidate from: ' + message.id);
        var pid = message.id;
        if (pid in self._parents) {
          self._handleIce(message, self._parents[pid]);
        } else if (pid in self._children) {
          self._handleIce(message, self._children[pid]);
        }
        break;
      default:
    }
  };
  self._ws.onerror = function(err) {
    trace('WebSocket error: ' + err);
    throw err;
  };
};

P2PTV.prototype._pushData = function(data) {
  var self = this;
  self._player.addData(data);
  // broadcast data to children
  for (var key in self._children) {
    if (self._children.hasOwnProperty(key)) {
      self._children[key].send(data);
    }
  }
};

P2PTV.prototype._setupPeerConnection = function(pid, relation) {
  var self = this;
  var peer = new Peer(self, pid, relation);
  peer.pc = new RTCPeerConnection(self._iceServers, self._pcConstraints);
  self._setupListeners(peer);
  return peer;
};

P2PTV.prototype._setupListeners = function(peer) {
  var self = this;
  trace('listening for ICE candidates');
  peer.pc.onicecandidate = function(event) {
    var candidate = event.candidate;
    if (candidate) {
      trace('sending ICE candidate to: ' + peer.id);
      self._ws.send(JSON.stringify({
        'type': 'ice',
        'id': peer.id,
        'sdp': candidate
      }));
    }
  };
};

P2PTV.prototype._handleOffer = function(offer, peer) {
  var self = this;
  var sdp = new RTCSessionDescription(offer);
  peer.pc.setRemoteDescription(sdp, function() {
    trace('set remote offer description for: ' + peer.id);
    self._makeAnswer(peer);
  }, self._traceErr);
};

P2PTV.prototype._handleAnswer = function(answer, peer) {
  var self = this;
  var sdp = new RTCSessionDescription(answer);
  peer.pc.setRemoteDescription(sdp, function() {
    trace('set remote answer description for: ' + peer.id);
  }, self._traceErr);
};

P2PTV.prototype._makeOffer = function(peer) {
  var self = this;
  peer.pc.createOffer(function(desc) {
    trace('created offer for: ' + peer.id);
    peer.pc.setLocalDescription(desc, function() {
      trace('set local description for: ' + peer.id);
      var mystate = (peer.id in self._parents) ? 'child' : 'parent';
      self._ws.send(JSON.stringify({
        'type': 'offer',
        'relation': mystate,
        'id': peer.id,
        'sdp': desc.sdp
      }));
    }, self._traceErr);
  }, self._traceErr);
};

P2PTV.prototype._makeAnswer = function(peer) {
  var self = this;
  peer.pc.createAnswer(function(desc) {
    trace('created answer for: ' + peer.id);
    peer.pc.setLocalDescription(desc, function() {
      trace('set local description answer for: ' + peer.id);
      self._ws.send(JSON.stringify({
        'type': 'answer',
        'id': peer.id,
        'sdp': desc.sdp
      }));
    }, self._traceErr);
  }, self._traceErr);
};

P2PTV.prototype._traceErr = function(err) {
  trace(err);
};
