'use strict';

function Peer(client, id, relation) {
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
}

Peer.prototype.send = function(message) {
  var self = this;
  if ('open' === self.channel.readyState) {
    self.channel.send(message);
  }
};

// TODO Need to implement pulling of missing data.
//      See handle p2ptvchannel child message.
Peer.prototype.setupDataChannel = function() {
  var self = this;
  self.channel.binaryType = 'arraybuffer';

  // on p2ptvchannel open 
  self.channel.onopen = function() {
    var readyState = self.channel.readyState;
    trace('sendrecv channel state is: ' + readyState);
    if ('open' === readyState) {
      var testMessage = '\n       ___        _         \n      |__ \\      '
        +'| |        \n  _ __   ) |_ __ | |___   __\n |  _ \\ / /|  _ \\| _'
        +'_\\ \\ / /\n | |_) / /_| |_) | |_ \\ V / \n | .__/____| .__/ \\__'
        +'| \\_/  \n | |       | |              \n |_|       |_|          ';
      trace('sent data channel message: "' + testMessage + '"');
      self.send(testMessage);
    }
  };

  // on p2ptvchannel close
  self.channel.onclose = function() {
    var readyState = self.channel.readyState;
    trace('sendrecv channel state is: ' + readyState);
  }

  // on p2ptvchannel message
  if (self.isParent) {
    // handle parent p2ptvchannel message
    self.channel.onmessage = function(event) {
      var data = event.data;
      if (typeof data === 'string') {
        trace('received p2ptvchannel string: '+data);
        // FIXME Are we only expecting binary data?
      } else {
        // trace('received p2ptvchannel ArrayBuffer: '+data.byteLength+' bytes');
        self._client._pushData(data);
      }
    };
  } else {
    // handle child p2ptvchannel message
    self.channel.onmessage = function(event) {
      var data = event.data;
      if (typeof data === 'string') {
        trace('received p2ptvchannel string: '+data);
        // FIXME Are we only expecting binary data?
      } else {
        trace('received p2ptvchannel ArrayBuffer: '+data.byteLength+' bytes');
        // FIXME Are we expecting pull requests in binary or string form?
      }
    };
  }

  // on p2ptvchannel error
  self.channel.onerror = function(err) {
    trace('p2ptvchannel error: ' + err.toString());
  };

  trace('setup p2ptvchannel');
};

