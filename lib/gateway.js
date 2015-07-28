/* gateway.js */
'use strict';
var net = require('net'),
    webrtc = require('wrtc'),
    Peer = require('./peer.js'),
    debug = require('debug')('gateway'),
    PushPullWindow = require('./push-pull-window.js');

var RTCIceCandidate = webrtc.RTCIceCandidate,
    RTCPeerConnection = webrtc.RTCPeerConnection,
    RTCSessionDescription = webrtc.RTCSessionDescription;

var servers = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]},
  pcConstraints = {optional: [{DtlsSrtpKeyAgreement: true}]},
  dcConstraints = {reliable: false, id: 'p2ptvchannel'};

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
  self.initSegment = null;

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
    self.initSegment = data;
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
    
  }).listen(port, '127.0.0.1');
  debug('Listening for FFmpeg data on ' + port + '...');

}

// broadcast data to all children
Gateway.prototype.broadcast = function(data) {
  var self = this;

  Object.keys(self.children).forEach(function(key) {
    var child = self.children[key];
    if (null === child || undefined === child) {
      throw new Error('null or undefined child');
    }

    // FIXME
    if (child && child.channel && 1 === child.connection.readyState) {
      if ('open' === child.channel.readyState) {
        // FIXME segmentation fault in native plugin
        child.channel.send(data.slice());
      }
    }
  });

};

// setupd p2ptvchannel with child pid
Gateway.prototype.setupDataChannel = function(channel, pid) {
  var self = this;

  channel.binaryType = 'arraybuffer';

  channel.onopen = function() {
    debug('p2ptvchannel opened with ' + pid);
    if (null !== self.initSegment) {
      if ('open' === channel.readyState) {
        channel.send(self.initSegment.slice());
      }
      debug('Sent ' + pid + ' initialization segment');
      self.children.receivedInitSegment = true;
    }
  };

  channel.onmessage = function(event) {
    var data = event.data;
    if (typeof data === 'string') {
      debug('Received message from ' + pid + ': ' + data);
    } else {
      debug('Received binary data from ' + pid + ': ' + data.length + ' bytes');
    }
  };

  channel.onclose = function() {
    debug('p2ptvchannel closed with ' + pid);
    self.disconnect(self.children[pid]);
  };

  channel.onerror = function(event) {
    debug('p2ptvchannel error with ' + pid + ': ' + event);
    self.disconnect(self.children[pid]);
  };

}

Gateway.prototype.handleOffer = function(peer, message) {
  var self = this;
  if (null !== peer && undefined !== peer) {
    if (!(peer.id in self.children)) {
      // add to children hash
      self.children[peer.id] = peer;
      // create the peer connection
      var pc = new RTCPeerConnection(servers, pcConstraints);
      pc.ondatachannel = function(event) {
        peer.channel = event.channel;
        self.setupDataChannel(peer.channel, peer.id);
      };
      // ice candidate callback
      pc.onicecandidate = function(event) {
        var candidate = event.candidate;
        if (candidate) {
          peer.send(JSON.stringify({
            'id': self.id,
            'type': 'ice',
            'sdp': candidate
          }));      
        }
      }; 
      // set remote description
      var sdp = new RTCSessionDescription(message);
      pc.setRemoteDescription(sdp, function() {
        debug('Successfully set remote description for '+peer.id);
      }, _onSetRemoteDescriptionError);
      // send answer to peer
      pc.createAnswer(function(desc) {
        pc.setLocalDescription(desc);
        peer.send(JSON.stringify({
          'id': self.id,
          'type': 'answer',
          'sdp': desc.sdp
        }));
      }, _onCreateSessionDescriptionError);
      // don't forget to set this
      peer.pc = pc;
    } else {
      debug('at handleOffer: GATEWAY ALREADY HAS CHILD '+pid);
    }
  } else {
    debug('at handleOffer: INVALID PEER ID ('+peer+')');
  }
};

Gateway.prototype.handleAnswer = function(pid, message) {
  var self = this;
  if (pid in self.children) {
    // just have to set the remote description
    var sdp = new RTCSessionDescription(message);
    self.children[pid].pc.setRemoteDescription(sdp, function() {
      debug('Successfully set remote description for '+pid);
    }, _onSetRemoteDescriptionError);
  } else {
    debug('at handleAnswer: INVALID PEER ID ('+pid+')');
  }
};

Gateway.prototype.handleIce = function(pid, sdp) {
  var self = this;
  if (pid in self.children) {
    // just have to add the ice candidate
    var candidate = new RTCIceCandidate(sdp);
    self.children[pid].pc.addIceCandidate(candidate, function() {
      debug('Successfully added ICE candidate for ' + pid);
    }, _onAddIceCandidateError);
  } else {
    debug('at handleIce: INVALID PEER ID ('+pid+')');
  }
};

Gateway.prototype.connect = function(peer) {
  var self = this;
  if (null !== peer && undefined !== peer) {
    peer.connectedToGateway = true;
    self.children[peer.id] = peer;
    self.addChild(peer.id);
  } else {
    debug('at connect: INVALID PEER OBJECT ('+peer+')');
  }
};

Gateway.prototype.disconnect = function(peer) {
  var self = this;

  if (peer) {
    if (peer.id in self.children) {
      delete self.children[peer.id];
    }
    peer.destroy();
    debug('Deleted ' + peer.id);
  }
};

Gateway.prototype.addChild = function(pid) {
  var self = this;
  var peer = self.children[pid];  // FIXME
  // create the peer connection
  var pc = new RTCPeerConnection(servers, pcConstraints);
  // create the data channel
  var channel = pc.createDataChannel(dcConstraints);
  self.setupDataChannel(channel, pid);
  // ice candidate callback
  pc.onicecandidate = function(event) {
    var candidate = event.candidate;
    if (candidate) {
      peer.send(JSON.stringify({
        'id': self.id,
        'type': 'ice',
        'sdp': candidate
      }));      
    }
  }; 
  // send an offer to the peer 
  pc.createOffer(function(desc) {
    pc.setLocalDescription(desc);
    peer.send(JSON.stringify({
      'id': self.id,
      'relation': 'parent',  // gateway is always parent
      'type': 'offer',
      'sdp': desc.sdp
    }));
  }, _onCreateSessionDescriptionError);
  // don't forget to set these
  peer.pc = pc;
  peer.channel = channel;
};

function _onAddIceCandidateError(err) {
  debug('Failed to add ICE candidate: '+err.toString());
}
function _onCreateSessionDescriptionError(err) {
  debug('Failed to create local description: '+err.toString());
}
function _onSetRemoteDescriptionError(err) {
  debug('Failed to set remote description: '+err.toString());
}

module.exports = Gateway;
