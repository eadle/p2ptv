'use strict';

var ws = require('ws'),
    Peer = require('./peer.js'),
    Gateway = require('./gateway.js'),
    debug = require('debug')('p2ptv');

/**
 * P2PTV is the livestreaming module.
 *
 * options - An object that specifies the configuration of this instance.
 *   signaling - The WebSocket port used for WebRTC signaling and general 
 *               session management.
 *   upstream - The port where video data is received from FFmpeg.
 *   bitrate - The rate at which to emit data from the module in Kbps.
 *   durations - Whether or not to include Media Segment durations. There
 *               is a startup penalty of exactly the duration of the first
 *               Media Segment.
 */
function P2PTV(options) {
  var self = this;

  options = options || {};
  // signaling port
  var signaling = options.signaling || 8188;
  if (typeof signaling !== 'number' || signaling < 1000) {
    throw new Error('Signaling port must be an integer greater than 999 ('
      + signaling + ')');
  }
  // upstream port
  var upstream = options.upstream || 9001;
  if (typeof upstream !== 'number' || upstream < 1000) {
    throw new Error('Media port must be an integer greater than 999 ('
      + upstream + ')');
  }
  // gateway will push data at this rate
  var bitrate = options.bitrate || 2000;
  if (typeof bitrate !== 'number' || bitrate < 1) {
    throw new Error('Bitrate must be a positive number (' + bitrate + ')');
  }
  // whether or not to include media segment durations
  var durations = options.durations || false;
  if (typeof durations !== 'boolean') {
    throw new Error('durations must be a boolean value (' + durations
      + ')');
  }
  debug('options: signaling=' + signaling + ', upstream=' + upstream
    + ', bitrate=' + bitrate + ', durations=' + durations);

  self.clients = {};
  self.gateway = new Gateway({
    id: self._generateId(),
    port: upstream,
    bitrate: bitrate,
    durations: durations
  });
  self.wss = new ws.Server({
    port: signaling
  });

  self.wss.on('connection', function(connection) {
    self._setupClientSession(connection);
  });
  debug('Listening for clients on ' + signaling + '...');

}

/**
 * Establishes client session and sets up client socket callbacks.
 *
 * connection - The WebSocket connection.
 */
P2PTV.prototype._setupClientSession = function(connection) {
  var self = this;

  var ip = connection._socket.remoteAddress,
      port = connection._socket.remotePort,
      id = null;

  debug('Client connected: '+ip+':'+port);

  connection.on('close', function() {
    debug('Client disconnected: '+ip+':'+port);
    self._discardClient(id);
  });

  connection.on('message', function(data) {
    var message = JSON.parse(data);
    switch (message.type) {
      case 'init':
          var browser = message.browser;
          if (self._validBrowser(browser)) {
            debug('Client has valid browser: ' + browser);
            id = self._generateId();
            self.clients[id] = new Peer(id, connection, browser);
            connection.send(JSON.stringify({'type': 'handle', 'id': id}));
            debug('Client initialized: ' + ip + ':' + port + ' >>> ' + id);
            self.gateway.connect(self.clients[id]);
            debug('Connecting ' + id + ' to gateway...');
          }
        break;
      case 'offer':
        debug('Received offer from '+id+': '+data);
        self._relayOffer(id, message);
        break;
      case 'answer':
        debug('Received answer from '+id+': '+data);
        self._relayAnswer(id, message);
        break;
      case 'ice':
        debug('Received ICE candidate from '+id+': '+data);
        self._relayIce(id, message);
        break;
      default:
        debug('Unknown message type: ' + message.type);
    }
  });

  connection.on('error', function(err) {
    self._discardClient(id);
    connection.close();
  });

};

/**
 * Relays the SDP offer from id to pid.
 *
 * id - The id of the offering peer.
 * offer - The SDP offer to send.
 */
P2PTV.prototype._relayOffer = function(id, offer) {
  var self = this,
      pid = offer.id;
  if (pid !== id && pid in self.clients) {
    self.clients[pid].send(JSON.stringify({
      'type': 'offer',
      'id': id,
      'relation': offer.relation,
      'sdp': offer.sdp
    }));
  } 
};

/**
 * Relays the SDP answer from id to pid.
 *
 * id - The id of the answering peer.
 * answer - The SDP answer to send.
 */
P2PTV.prototype._relayAnswer = function(id, answer) {
  var self = this,
      pid = answer.id;

  if (pid !== id && pid in self.clients) {
    self.clients[pid].send(JSON.stringify({
      'type': 'answer',
      'id': id,
      'sdp': answer.sdp
    }));
  } 
};

/**
 * Relays the ICE candidate from id to pid.
 *
 * id - The id of the sending peer.
 * ice - The ICE candidate to send.
 */
P2PTV.prototype._relayIce = function(id, ice) {
  var self = this,
      pid = ice.id,
      sdp = ice.sdp;
  if (pid !== id && pid in self.clients) {
    self.clients[pid].send(JSON.stringify({
      'type': 'ice',
      'id': id,
      'sdp': sdp
    }));
  } 
};

/**
 * Ends the session of the specified client.
 *
 * id - The id of the client.
 */
P2PTV.prototype._discardClient = function(id) {
  var self = this;
  if (id in self.clients) {
    var peer = self.clients[id];
    if (peer.connectedToGateway) {
      self.gateway.disconnect(peer);
    }
    delete self.clients[id];
  }
};

/**
 * Returns true if the browser *might* support WebRTC. Currently only
 * Firefox, Chrome, and Opera support WebRTC. Edge appears to be going with
 * their own implementation *cough* and may not be supported.
 *
 * browser - The browser string to check.
 */
P2PTV.prototype._validBrowser = function(browser) {
  switch (browser) {
    case 'firefox':
    case 'chrome':
    case 'opera':
      return true;
    default:
      return false;
  }
};

/**
 * Creates a unique identifier for a client.
 */
P2PTV.prototype._generateId = function() {
  var self = this;
  var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    +'abcdefghijklmnopqrstuvwxyz0123456789';
  var id = ''; 
  for (var i = 0; i < 12; i++) {
    var randomPoz = Math.floor(Math.random()*charSet.length);
    id += charSet.substring(randomPoz, randomPoz+1);
  }   
  return (id in self.clients) ? self._generateId : id; 
};

module.exports = P2PTV;
