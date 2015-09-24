'use strict';

var debug = require('debug')('encoder');

/** 
 * Encodes Initialization Segments and Media Segments into WebRTC
 * data channel friendly application-layer messages. Messages generated are
 * received by the browser as ArrayBuffer objects. The size of each message
 * is a multiple of 8 and is less than or equal to 16KB. See below for a
 * quick overview of the P2PTV protocol.
 *
 * Initialization Segment message:
 * -------------------------------
 * TIMECODE (8 bytes): The timecode at which the Initialization Segment
 *                     was generated. Number of milliseconds since epoch.
 * TYPE (2 bits): An Initialization Segment is given type 0.
 * RESERVED (3 bits): Reserved for future use.
 * PADDING LENGTH (3 bits): The number of padding bytes to follow.
 * PADDING (0-7 bytes): The padding bytes preceeding the payload field.
 * PAYLOAD: The actual Initialization Segment to be used by MSE.
 *
 * Media Segment message:
 * ----------------------
 * TIMECODE (8 bytes): The timecode at which the associated Media Segment
 *                     was generated. Number of milliseconds since epoch.
 * TYPE (2 bits): An Initialization Segment is given type 0.
 * RESERVED (3 bits): Reserved for future use.
 * PADDING LENGTH (3 bits): The number of padding bytes to follow.
 * CHUNK INDEX (1 byte): The index of the Media Segment chunk.
 * LAST CHUNK INDEX (1 byte): The last Media Segment chunk index.
 * PADDING (0-7 bytes): The padding bytes preceeding the payload field.
 */
function Encoder(options) {
  options = options || {};
  var self = this;

  self._maxChunkSize = 16*1024;
  self._minInitSegHeader = 9;
  self._maxInitSegPayload = self._maxChunkSize - self._minInitSegHeader;
  self._minChunkHeader = 16;
  self._maxChunkPayload = self._maxChunkSize - self._minChunkHeader; 
  self._maxChunksPerMessage = 256;

  debug('settings: maxChunkSize=' + self._maxChunkSize
    + ', minInitSegHeader=' + self._minInitSegHeader);
}

/** FIXME: Use Node.js Buffer instead of ArrayBuffer. */
Encoder.prototype.getEmptyInitSegMessage = function(header) {
  var self = this;
  // header fields
  var timecode = header.timecode,
      payloadSize = header.payloadSize;
  debug('Creating empty initialzation segment message: timecode='
    + timecode + ', payloadSize=' + payloadSize);

  if (payloadSize > self._maxInitSegPayload) {
    throw new Error('payload size greater than maximum initialization'
      + 'segment payload');
  }

  // calculate message size and header size
  var tmp = self._minInitSegHeader + payloadSize,
      messageSize = nextMultiple8(tmp),
      padding = messageSize - tmp,
      headerSize = self._minInitSegHeader + padding;


  // FIXME use Buffer instead
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

/** FIXME: Use Node.js Buffer instead of ArrayBuffer. */
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


  // FIXME: use Buffer instead
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
