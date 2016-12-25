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
 * Media Segment chunk message:
 * ----------------------------
 * TIMECODE (8 bytes): The timestamp associated with the current media
 *                     segment.
 * TYPE (2 bits): A Media Segment chunk is given type 1.
 * RESERVED (3 bits): Reserved for future use.
 * PADDING LENGTH (3 bits): The number of padding bytes to follow.
 * CHUNK INDEX (1 byte): The index of the Media Segment chunk.
 * FINAL CHUNK INDEX (1 byte): The last Media Segment chunk index.
 * PADDING (1 byte): So duration is aligned on a 4th byte.
 * DURATION (4 bytes): The duration of the associated Media Segment.
 * PADDING (0-7 bytes): The padding bytes preceeding the payload field.
 * PAYLOAD: The Media Segment chunk data.
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

/** 
 * Returns an Initialization Segment message with an empty payload field.
 *
 * headerField - The header field values.
 */
Encoder.prototype.getEmptyInitSegMessage = function(headerField) {
  var self = this;

  // header fields
  var timecode = headerField.timecode,
      payloadSize = headerField.payloadSize;

  debug('Creating empty initialzation segment message: timecode='
    + timecode + ', payloadSize=' + payloadSize);

  // FIXME this should never happen
  if (payloadSize > self._maxInitSegPayload) {
    throw new Error('payload size greater than maximum initialization'
      + 'segment payload');
  }

  // calculate message size and header size
  var tmp = self._minInitSegHeader + payloadSize,
      messageSize = nextMultiple8(tmp),
      padding = messageSize - tmp,
      headerSize = self._minInitSegHeader + padding;

  // encode header
  var message = new Buffer(headerSize + payloadSize);
  message.writeDoubleLE(timecode, 0); 
  message.writeUInt8(0x07 & padding, 8);

  return {
    data: message,
    start: headerSize
  };
};

/** 
 * Returns a Media Segment chunk message with an empty payload field.
 *
 * headerField - The header field values.
 */
Encoder.prototype.getEmptyChunkMessage = function(headerField) {
  var self = this;

  // header fields
  var timecode = headerField.timecode,
      payloadSize = headerField.payloadSize,
      chunkIndex = headerField.chunkIndex,
      finalIndex = headerField.finalIndex,
      duration = headerField.duration;

  debug('Creating empty media segment chunk message: timecode='
    + timecode + ', payloadSize=' + payloadSize + ', chunkIndex='
    + chunkIndex + ', finalIndex=' + finalIndex + ', duration='
    + ((duration < 0) ? 'unknown' : (duration + 'ms')));

  // FIXME this should never happen
  if (payloadSize > self._maxChunkPayload) {
    throw new Error('payload size greater than maximum chunk payload');
  }

  // calculate message size and header size
  var tmp = self._minChunkHeader + payloadSize,
      messageSize = nextMultiple8(tmp),
      padding = messageSize - tmp,
      headerSize = self._minChunkHeader + padding;

  // encode header
  var message = new Buffer(headerSize + payloadSize);
  message.writeDoubleLE(timecode, 0); 
  message.writeUInt8((1 << 6) | (0x07 & padding), 8);
  message.writeUInt8(chunkIndex, 9);
  message.writeUInt8(finalIndex, 10);
  message.writeInt32LE(duration, 12);

  return {
    data: message,
    start: headerSize
  };
};

/** Returns the next positive multiple of 8. */
function nextMultiple8(x) {
  return (x <= 0) ? 0 : (x%8 == 0) ? x : x + (8 - x%8);
}

module.exports = Encoder;
