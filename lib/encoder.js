/* encoder.js */
'use strict';
var debug = require('debug')('encoder');

function Encoder(options) {
  options = options || {};
  var self = this;

  self._maxChunkSize = 16*1024;
  self._minInitSegHeader = 9;
  self._maxInitSegPayload = self._maxChunkSize - self._minInitSegHeader;
  self._minChunkHeader = 16;
  self._maxChunkPayload = self._maxChunkSize - self._minChunkHeader; 
  self._maxChunksPerMessage = 256;

  debug('settings: maxChunkSize=' + self._maxChunkSize + ', minInitSegHeader='
    + self._minInitSegHeader);
}

Encoder.prototype.getEmptyInitSegMessage = function(header) {
  var self = this;
  // header fields
  var timecode = header.timecode,
      payloadSize = header.payloadSize;
  debug('Creating empty initialzation segment message: timecode='
    + timecode + ', payloadSize=' + payloadSize);

  if (payloadSize > self._maxInitSegPayload) {
    throw new Error('payload size greater than maximum initialization segment payload');
  }

  // calculate message size and header size
  var tmp = self._minInitSegHeader + payloadSize,
      messageSize = nextMultiple8(tmp),
      padding = messageSize - tmp,
      headerSize = self._minInitSegHeader + padding;
  // create an empty initialization segment message
  var message = new ArrayBuffer(headerSize + payloadSize),
      float64view = new Float64Array(message),
      uint8view = new Uint8Array(message, 8);
  // encode header
  float64view[0] = timecode;
  uint8view[0] = (0x07 & padding);
  return {
    data: message,
    start: headerSize
  };
};

Encoder.prototype.getEmptyChunkMessage = function(header) {
  var self = this;
  // header fields
  var timecode = header.timecode,
      payloadSize = header.payloadSize,
      chunkIndex = header.chunkIndex,
      finalIndex = header.finalIndex,
      duration = header.duration;
  debug('Creating empty media segment chunk message: timecode='
    + timecode + ', payloadSize=' + payloadSize + ', chunkIndex='
    + chunkIndex + ', finalIndex=' + finalIndex + ', duration='
    + ((duration < 0) ? 'unknown' : (duration + 'ms')));

  if (payloadSize > self._maxChunkPayload) {
    throw new Error('payload size greater than maximum chunk payload');
  }

  // calculate message size and header size
  var tmp = self._minChunkHeader + payloadSize,
      messageSize = nextMultiple8(tmp),
      padding = messageSize - tmp,
      headerSize = self._minChunkHeader + padding;
  // create an empty media segment chunk message
  var message = new ArrayBuffer(headerSize + payloadSize),
      float64view = new Float64Array(message),
      uint32view = new Uint32Array(message),
      uint8view = new Uint8Array(message, 8);
  // encode header
  float64view[0] = timecode;
  uint8view[0] = (1 << 6) | (0x07 & padding);
  uint8view[1] = chunkIndex;
  uint8view[2] = finalIndex;
  uint32view[3] = duration;
  return {
    data: message,
    start: headerSize
  };
};

function nextMultiple8(x) {
  return (x <= 0) ? 0 : (x%8 == 0) ? x : x + (8 - x%8);
}

module.exports = Encoder;
