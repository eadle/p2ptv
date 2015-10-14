
/**
 * TODO write description
 * stream -
 */
P2PTV.PushPullWindow = function(stream, player) {
  var self = this;

  self._stream = stream;
  if (!self._stream) {
    throw new Error('Must pass Stream reference to PushPullWindow');
  }

  self._player = player;
  if (!self._player) {
    throw new Error('Must pass Player reference to PushPullWindow');
  }

  self._key = null;
  self._stream = {};
  self._initialTimecode = -1;

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
        var start = 9 + (0x07 & uint8view[0]);
        self._pushInitSegment({
          timecode: timecode,
          start: start,
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
          start: padding + 16,
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

    // initial media segment timecode unknown
    self._initialTimecode = -1;

    self._key = initSegment.timecode;
    self._stream[self._key] =  {
      initSegment: initSegment,
      mediaSegmentHash: {},
      timecodeQueue: []
    };

    self._player.appendInitSegment(initSegment.data.slice(initSegment.start));

  },

  /**
   * TODO fill this out
   * chunk - The decoded media segment chunk message.
   */
  _pushMediaSegmentChunk: function(chunk) {
    var self = this;
    
    var stream = self._stream[self._key];
    var mediaSegment = null;

    if (!(chunk.timecode in stream.mediaSegmentHash)) {
      mediaSegment = new P2PTV.MediaSegment(chunk);
      stream.mediaSegmentHash[chunk.timecode] = mediaSegment;
      stream.timecodeQueue.push(chunk.timecode);
    } else {
      mediaSegment = stream.mediaSegmentHash[chunk.timecode];
      mediaSegment.addChunk(chunk);
    }

    if (mediaSegment.isComplete()) {
      if (self._initialTimecode < 0) {
        self._initialTimecode = chunk.timecode;
      }
      var timestampOffset = (chunk.timecode - self._initialTimecode)/1000;
      self._player.appendMediaSegment(
        mediaSegment.getBlob(),
        timestampOffset
      );
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
