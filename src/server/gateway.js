'use strict';

var net = require('net'),
    Peer = require('./peer.js'),
    debug = require('debug')('gateway'),
    PushPullWindow = require('./push-pull-window.js');

/**
 * Previously a WebRTC gateway. This is to be integrated into P2PTV.
 */
function Gateway(options) {

  var self = this;
  self.children = {};

  options = options || {}; 
  self.id = options.id;
  if (typeof self.id !== 'string') {
    throw new Error('Expects string as id (' + self.id + ')');
  }
  var port = options.port || 9001;
  if (typeof port !== 'number' || port < 1000) {
    throw new Error('Expects port number greater than 999 (' + port + ')');
  }
  var bitrate = options.bitrate || 2000;
  if (typeof port !== 'number' || bitrate < 1) {
    throw new Error('Expects bitrate greater than 0 (' + bitrate + ')');
  }
  var durations = options.durations || false;
  if (typeof durations !== 'boolean') {
    throw new Error('Expects durations of type boolean (' + durations + ')');
  }
  debug('options: id=' + self.id + ', port=' + port + ', bitrate='
    + bitrate + ', durations=' + durations);

  var sentChunks = 0;
  var sentInitSegments = 0;
  self.lastInitSegment = null;

  self.pushPullWindow = new PushPullWindow({
    durations: durations,
    bitrate: bitrate
  });

  // webm byte stream has given us a cluster chunk to broadcast
  self.pushPullWindow.on('Media Segment Chunk', function(data) {
    self.broadcast(data);
    sentChunks++;
  });

  // webm byte stream has given us an initialization segment to broadcast
  self.pushPullWindow.on('Initialization Segment', function(data) {
    self.lastInitSegment = data;
    self.broadcast(data);
    sentInitSegments++;
  });

  // listen for ffmpeg output on port 9001
  net.createServer(function(sock) {
    debug('FFmpeg connected');
    sock.on('data', function(data) {
      if (null !== data) {
        self.pushPullWindow.write(data);
      }
    });
    sock.on('close', function(data) {
      debug('FFmpeg disconnected...');
    });
  }).listen(port);
  debug('Listening for FFmpeg data on ' + port + '...');

}

/** 
 * Connect the Peer to the Gateway.
 *
 * peer - The Peer object to connect.
 */
Gateway.prototype.connect = function(peer) {
  var self = this;
  if (null !== peer && undefined !== peer) {
    peer.connectedToGateway = true;
    self.children[peer.id] = peer;
    if (!!self.lastInitSegment) {
      peer.send(self.lastInitSegment);
    }
  } else {
    debug('at connect: INVALID PEER OBJECT ('+peer+')');
  }
};

/**
 * Broadcasts a Buffer object to all children.
 *
 * data - The data buffer to broadcast.
 */
Gateway.prototype.broadcast = function(data) {
  var self = this;

  Object.keys(self.children).forEach(function(key) {
    var child = self.children[key];
    if (!!child) {
      child.send(data);
    } 
  });

};

/**
 * Disconnects the Peer from the Gateway.
 * The Peer is also destroyed in this method.  
 *
 * peer - The Peer object do disconnect and destroy.
 */
Gateway.prototype.disconnect = function(peer) {
  var self = this;

  if (!!peer) {
    if (peer.id in self.children) {
      delete self.children[peer.id];
    }
    peer.destroy();
  }
};

module.exports = Gateway;
