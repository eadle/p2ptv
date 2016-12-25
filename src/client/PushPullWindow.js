
/**
 * TODO write description
 * stream -
 */
P2PTV.PushPullWindow = function(player) {
  var self = this;

  self._player = player;
  if (!self._player) {
    throw new Error('Must pass Player reference to PushPullWindow');
  }

  self._key = null;
  self._stream = {};
  self._window = [];

};

P2PTV.PushPullWindow.prototype = {

  /**
   * Push data received from parent into the window.
   *
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
   * Push decoded initialization segment into window.
   *
   * initSegment - The decoded initialization segment message.
   */
  _pushInitSegment: function(initSegment) {
    var self = this;

    self._key = initSegment.timecode;
    self._stream[self._key] =  {
      initSegment: initSegment,
      mediaSegmentHash: {},
      timecodeQueue: []
    };

    // pass initialization segment to media player
    self._player.appendInitSegment(
      initSegment.data.slice(initSegment.start)
    );

    // TODO push initialization segment to children
    // ...

  },

  /**
   * TODO fill this out
   *
   * chunk - The decoded media segment chunk message.
   *
   * preconditions - chunks may be received out of order
   *               - chunks may be from different media segments
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
      self._player.appendMediaSegment(
        mediaSegment.getBlob(),
        chunk.timecode
      );
      // push media segment key into free queue
      self._window.push({
        key: self._key,
        timecode: chunk.timecode
      });
      // make sure window length stays within limit
      if (P2PTV.MAX_WINDOW_LENGTH <= self._window.length) {
        var key = self._window[0].key;
        var timecode = self._window[0].timecode;
        self._stream[key].mediaSegmentHash[timecode] = null;
        self._window.shift();
      }
    }

    // TODO push media segment chunk to children
    // ...

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
