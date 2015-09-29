
/**
 * TODO write description
 * stream -
 */
P2PTV.PushPullWindow = function(stream) {
  var self = this;

  self._stream = stream;
  if (!self._stream) {
    throw new Error('Must pass Stream reference to PushPullWindow');
  }

  self._initSegmentHash = {};
  self._mediaSegmentHash = {};

};

P2PTV.PushPullWindow.prototype = {

  /**
   * Push data received from parent into the window.

   * data - ArrayBuffer storing a P2PTV message. Byte length is a multiple 
   *        of 8 greater than or equal to 16.
   */
  pushData: function(data) {
    this._decode(data);
  },

  /**
   * // TODO write description
   * data -
   */
  _decode: function(data) {
    var self = this;

    var float64view = new Float64Array(data),
        uint8view = new Uint8Array(data, 8),
        int32view = new Int32Array(data);

    var type = uint8view[0] >> 6,
        timecode = float64view[0];
    
    switch (type) {
      case P2PTV.INIT_SEGMENT:
        self._pushInitSegment({
          timecode: timecode,
          start: 9 + (0x07 & uint8view[0]),
          data: data
        }); 
        break;
      case P2PTV.MEDIA_SEGMENT_CHUNK:
        var padding = 0x07 & uint8view[0];
        self._pushMediaSegmentChunk({
          timecode: timecode,
          index: uint8view[1],
          finalIndex: uint8view[2],
          duration: int32view[3],
          start: padding + P2PTV.MEDIA_SEGMENT_CHUNK_HEADER,
          data: data
        });
        break;
      /*
      case P2PTV.MEDIA_SEGMENT:
        var start = ??;
        self._pushMediaSegment({
          timecode: timecode,
          data: 
        });
        break;
      */
      default: // not implemented
    }

  },

  /**
   * TODO fill this out
   * initSegment - The decoded initialization segment message.
   */
  _pushInitSegment: function(initSegment) {
    var self = this;

    // TODO should only be logged while debugging
    P2PTV.log('pushing initialization segment:'
      + ' timecode=' + initSegment.timecode
      + ', length=' + initSegment.data.byteLength + ' bytes');

    // TODO
  },

  /**
   * TODO fill this out
   * chunk - The decoded media segment chunk message.
   */
  _pushMediaSegmentChunk: function(chunk) {
    var self = this;

    // FIXME should only be logged while debugging
    var durationString = (chunk.duration > 0) ? chunk.duration : 'unknown';
    P2PTV.log('pushing media segment chunk:'
      + ' timecode=' + chunk.timecode 
      + ', chunkIndex=' + chunk.index
      + ', finalIndex=' + chunk.finalIndex
      + ', duration=' + durationString
      + ', length=' + chunk.data.byteLength + ' bytes');

    var mediaSegment = null;
    if (!(timecode in self._mediaSegmentHash)) {
      mediaSegment = new P2PTV.MediaSegment(chunk);
      self._mediaSegmentHash[timecode] = mediaSegment;
    } else {
      mediaSegment = self._mediaSegmentHash[timecode]; 
      mediaSegment.addChunk(chunk);
    }

    // TODO
    if (mediaSegment.isComplete()) {
      var blob = mediaSegment.getBlob();
    }

  },
  
  /**
   * TODO write function description
   * mediaSegment - The decoded media segment message.
   */
  _pushMediaSegment: function(mediaSegment) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   */
  _pullInitSegment: function(timecode) {
    // TODO
  },

  /**
   * TODO write function description
   * timecode -
   * chunkIndex -
   */
  _pullMediaSegmentChunk: function(timecode, chunkIndex) {
    // TODO
  },

  /**
   * TODO write function description
   */
  reset: function() {
    // TODO
  }
};

P2PTV.PushPullWindow.prototype.constructor = P2PTV.PushPullWindow;
