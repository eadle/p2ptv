'use strict';

var Writable = require('stream').Writable,
    debug = require('debug')('push-pull-window'),
    WebMByteStream = require('webm-byte-stream'),
    Encoder = require('./encoder.js');

/**
 * TODO fill this out
 *
 * options -
 */
function PushPullWindow(options) {

  var self = this;
  options = options || {};
  Writable.call(self, {});

  var durations = options.durations || false;
  if (typeof durations !== 'boolean') {
    throw new Error('durations must be a boolean value (' + durations +')');
  }

  var bitrate = options.bitrate;
  if (typeof bitrate !== 'number' || bitrate < 1) {
    throw new Error('bitrate must be a positive number (' + bitrate + ')');
  }

  self._tc = [];
  self._window = {};
  self._pushQueue = [];
  self._encoder = new Encoder();
  self._webmstream = new WebMByteStream({durations: durations});

  // get byte stream ready for datachannel
  var lastTime = new Date().getTime();
  self._webmstream.on('Initialization Segment', function(data) {
    self._pushInitSegment(data, lastTime); // TODO
  });
  self._webmstream.on('Media Segment', function(data) {
    lastTime = new Date().getTime();
    self._pushMediaSegment(data, lastTime);
  });

  // push media segment chunks to gateway
  var messagesPerSec = (bitrate*1024)/self._encoder._maxChunkSize;
  setInterval(function() {
    var chunk = self._pushQueue.shift();
    if (chunk) {
      self.emit('Media Segment Chunk', chunk);
    }
  }, 1000/messagesPerSec);
  debug('Pushes ' + messagesPerSec + ' messages per second');
 
}

require('util').inherits(PushPullWindow, Writable);
PushPullWindow.prototype._write = function(data, enc, done) {
  var self = this;
  self._webmstream.write(data);
  done();
};

/**
 * Push an Initialization Segment into the distribution network.
 *
 * data - Buffer storing the Initialization Segment data.
 * timecode - The time at which the Initialization Segment was generated.
 */
PushPullWindow.prototype._pushInitSegment = function(data, timecode) {
  var self = this;

  if (data.length > self._encoder._maxInitSegPayload) {
    throw new Error('Initialization Segment is too large: '
      + data.length + ' bytes');
  }

  // build empty message
  var message = self._encoder.getEmptyInitSegMessage({
    timecode: timecode,
    payloadSize: data.length
  });

  // write payload
  data.copy(message.data, message.start, 0, data.length);

  // push initialization segment
  self.emit('Initialization Segment', message.data);
  debug('Emitting Initialization Segment: '+message.data.length+' bytes');

};

/**
 * Push a Media Segment into the distribution network. The Media Segment is
 * subdivided and distributed as sequential chunks.
 *
 * data - Buffer storing the Media Segment data.
 * timecode - The time at which the Media Segment was generated.
 */
PushPullWindow.prototype._pushMediaSegment = function(data, timecode) {
  var self = this;

  var cluster = data.cluster,
      duration = data.duration,
      numChunks = Math.ceil(cluster.length/self._encoder._maxChunkPayload),
      maxChunkPayload = self._encoder._maxChunkPayload,
      maxChunksPerMessage = self._encoder._maxChunksPerMessage;

  debug('Pushing media segment: timecode=' + timecode + ', duration='
    + ((duration < 0) ? 'unknown' : (duration + 'ms')) + ', chunks='
    + numChunks);

  if (numChunks > maxChunksPerMessage) {
    throw new Error('Media Segment is too large: ' + numChunks
      + ' chunks greater than max ' + maxChunksPerMessage);
  }

  // window contains previous and current media segment
  self._tc.push(timecode);
  self._window[timecode] = [];
  if (self._tc.length > 2) {
    var tc = self._tc.shift();
    delete self._window[tc];
  }

  // split the media segment into chunks
  var start = 0;
  var finalIndex = numChunks - 1;
  for (var chunk = 0; chunk < numChunks; chunk++) {
    // calculate payload size
    var payloadSize = ((cluster.length - start) > maxChunkPayload)
      ? maxChunkPayload : (cluster.length - start);
    // build empty message
    var message = self._encoder.getEmptyChunkMessage({
      timecode: timecode,
      chunkIndex: chunk,
      finalIndex: finalIndex,
      duration: duration,
      payloadSize: payloadSize
    });
    // write payload
    cluster.copy(message.data, message.start, start, start + payloadSize);
    start += payloadSize;
    // push chunk into queue
    self._pushQueue.push(message.data);
    self._window[timecode].push(message.data);
  }

};

/**
 * TODO fill this out
 *
 * timecode -
 * chunkIndex -
 */
PushPullWindow.prototype.pullChunk = function(timecode, chunkIndex) {
  var self = this;

  if (timecode in self._window) {
    return self._window[timecode][chunkIndex];
  } else {
    return null;
  }

};

module.exports = PushPullWindow;
