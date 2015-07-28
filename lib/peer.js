/* peer.js */
'use strict';
var debug = require('debug')('peer');

function Peer(id, connection, browser) {
  var self = this;

  if (typeof id !== 'string') {
    throw new Error('Expected id of type string ('+id+')');
  }
  if (null === connection || undefined === connection) {
    throw new Error('Expected valid WebSocket connection ('+connection+')');
  }

  self.id = id;
  self.browser = browser || 'unknown';
  self.connection = connection;
  self.ip = connection._socket.remoteAddress;
  self.port = connection._socket.remotePort;
  var address = self.ip + ':' + self.port;
  debug('New peer: id=' + id + ', browser=' + browser + ', address=' + address);

  // only used when connected to gateway
  self.receivedInitSegment = false;
  self.connectedToGateway = false;
  self.channel = null;
  self.pc = null;

}

/* Closes and cleans up connection with gateway. */
Peer.prototype.destroy = function() {
  var self = this;

  // close data channel
  if (self.channel) {
    self.channel.close();
    self.channel = null;
  }

  // close peer connection
  if (self.pc) {
    self.pc.close();
    self.pc = null;
  }

  debug('Destroyed ' + self.id);

}

/* This peer establishes an RTCPeerConnection with peer. */
Peer.prototype.connect = function(peer) {
  var self = this;

  // handshake order bug workaround
  switch (self.browser) {
    case 'firefox':
      debug('[PEER] ' + self.id + ' has Firefox (peer makes offer)');
      peer.addChild(self.id);
      break;
    case 'chrome':
      debug('[PEER] ' + self.id + ' has Chrome (makes offer)');
      self.addParent(peer.id);
      break;
    case 'opera':
      debug('[PEER] ' + self.id + ' has Opera (makes offer)');
      self.addParent(peer.id);
      break;
    case 'edge':
      debug('[PEER] ' + self.id + ' has Edge (not supported yet)');
      // TODO should end the client session
      break;
    default:
      debug('[PEER] ' + self.id + ' has unknown browser (not supported)');
      // TODO should end the client session
      break;
  }

}

/* This peer adds a parent peer. */
Peer.prototype.addParent = function(pid) {
  var self = this;
  debug('[PEER] ' + self.id + ' adding parent: ' + pid);

  self.send(JSON.stringify({
    'type': 'peer',
    'id': pid,
    'relation': 'parent'
  }));

};

/* This peer adds a child peer. */
Peer.prototype.addChild = function(pid) {
  var self = this;
  debug('[PEER] ' + self.id + ' adding child: ' + pid);

  self.send(JSON.stringify({
    'type': 'peer',
    'id': pid,
    'relation': 'child'
  }));

};

/* Send this peer data on the DataChannel. */
Peer.prototype.send = function(data) {
  var self = this;

  var OPEN = 1; // FIXME
  if (OPEN === self.connection.readyState) {
    self.connection.send(data);
  }

};

module.exports = Peer;
