'use strict';
var debug = require('debug')('peer'),
    ws = require('ws');

/**
 * The Peer object encapsulates a client session.
 *
 * id - The id generated for this Peer.
 * connection - The WebSocket connection.
 * browser - Best guess as to what browser is being used.
 */
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
  self.receivedInitSegment = false; // FIXME
  self.connectedToGateway = false;

}

/** Closes and cleans up connection with gateway. */
Peer.prototype.destroy = function() {
  var self = this;

  if (!!self.connection) {
    self.connection.close();
    self.connection = null;
  }

}

/**
 * Starts to establish an RTCPeerConnection between peers.
 *
 * peer - The peer to establish an RTCPeerConnection with.
 */
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

/**
 * Request to be the child in the peer connection.
 *
 * pid - The peer id of the parent.
 */
Peer.prototype.addParent = function(pid) {
  var self = this;
  debug('[PEER] ' + self.id + ' adding parent: ' + pid);

  self.send(JSON.stringify({
    'type': 'peer',
    'id': pid,
    'relation': 'parent'
  }));

};

/**
 * Request to be the parent in the peer connection.
 *
 * pid - The peer id of the child.
 */
Peer.prototype.addChild = function(pid) {
  var self = this;
  debug('[PEER] ' + self.id + ' adding child: ' + pid);

  self.send(JSON.stringify({
    'type': 'peer',
    'id': pid,
    'relation': 'child'
  }));

};

/**
 * Send the peer data.
 *
 * data - The data to send.
 */
Peer.prototype.send = function(data) {
  var self = this;

  if (ws.OPEN === self.connection.readyState) {
    self.connection.send(data);
  }

};

module.exports = Peer;
