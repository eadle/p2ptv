
P2PTV.PushPullWindow = function(stream) {
  var self = this;

  self._stream = stream;
  if (!self._stream) {
    throw new Error('Must pass Stream reference to PushPullWindow');
  }

};

P2PTV.PushPullWindow.MAX_CHUNK_SIZE = 16*1024;
// P2PTV.PushPullWindow. = ;
// P2PTV.PushPullWindow. = ;
// P2PTV.PushPullWindow. = ;
// P2PTV.PushPullWindow. = ;
P2PTV.PushPullWindow.MAX_CHUNKS_PER_MEDIA_SEGMENT = 256; // FIXME

P2PTV.PushPullWindow.prototype = {

  /**
   * Push data received from parent into the window.

   * data - ArrayBuffer storing a P2PTV message. Byte length is a multiple 
   *        of 8 greater than or equal to 16.
   */
  pushData: function(data) {
    this._decoder.decode(data);
  },

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
        self._pushPullWindow.pushInitSegment({
          timecode: timecode,
          data: data.slice(start)
        }); 
        break;
      case P2PTV.MEDIA_SEGMENT_CHUNK:
        var start = 16 + (0x07 & uint8view[0]);
        self._pushMediaSegmentChunk({
          timecode: timecode,
          chunkIndex: uint8view[1],
          finalIndex: uint8view[2],
          duration: int32view[3],
          data: data.slice(start)
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
   *
   */
  _pushInitSegment: function(initSegment) {
    // TODO
  },

  /**
   *
   */
  _pushMediaSegmentChunk: function(mediaSegmentChunk) {
    // TODO
  },
  
  /**
   *
   */
  _pushMediaSegment: function(mediaSegment) {
    // TODO
  },

  /**
   *
   */
  _pullInitSegment: function(timecode) {
    // TODO
  },

  /**
   *
   */
  _pullMediaSegmentChunk: function(timecode, chunkIndex) {
    // TODO
  },

  /**
   *
   */
  reset: function() {
    // TODO
  }
};

P2PTV.PushPullWindow.prototype.constructor = P2PTV.PushPullWindow;
