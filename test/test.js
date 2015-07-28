var P2PTV = require('../lib/p2ptv.js'),
    Gateway = require('../lib/gateway.js'),
    Peer = require('../lib/peer.js'),
    PushPullWindow = require('../lib/push-pull-window.js'),
    Encoder = require('../lib/encoder.js'),
    assert = require('assert');

describe('p2ptv', function() {
  describe('P2PTV', function() {
    // TODO
  });
});

describe('gateway', function() {
  describe('Gateway', function() {
    // TODO
  });
});

describe('peer', function() {
  describe('Peer', function() {

    // TODO
    
  });
});


describe('push-pull-window', function() {
  describe('PushPullWindow', function() {
    describe('#_pushInitSegment', function() {
/*
      it('should emit initialization segment', function() {
        // TODO
      });

      it('should emit x media segment chunks', function() {
        // TODO
      }
*/
      it('should throw for a too large of an initialization segment', function() {
        var pushPullWindow = new PushPullWindow({bitrate: 300});
        var buffer = new Buffer(pushPullWindow._encoder._maxInitSegPayload + 1);
        assert.throws(function() {
          pushPullWindow._pushInitSegment(buffer);
        }, /too large/);
      });

    });
  });
});

describe('encoder', function() {
  describe('Encoder', function() {

    describe('#getEmptyChunkMessage', function() {
      it('should throw for payload size greater than maximum chunk payload', function() {
        var encoder = new Encoder();
        assert.throws(function() {
          encoder.getEmptyChunkMessage({timecode: 0, payloadSize: encoder._maxChunkPayload + 1});
        }, /payload size greater than/);
      });
    });

    describe('#getEmptyInitSegMessage', function() {
      it('should throw for payload size greater than maximum initialization segment payload', function() {
        var encoder = new Encoder();
        assert.throws(function() {
          encoder.getEmptyInitSegMessage({timecode: 0, payloadSize: encoder._maxInitSegPayload + 1});
        }, /payload size greater than/);
      });
    });

  });
});
