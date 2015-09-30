
/**
 * TODO write description
 *
 * chunk -
 */
P2PTV.MediaSegment = function(chunk) {
  var self = this;

  self._timecode = chunk.timecode;
  self._numChunks = chunk.finalIndex + 1;
  self._chunkData = new Array(self._numChunks);
  self._blob = null;
  self._processed = [];

  self.addChunk(chunk);

};

P2PTV.MediaSegment.prototype = {
  /**
   * Add media segment chunk data.
   *
   * chunk - The media segment chunkattributes and data.
   */
  addChunk: function(chunk) {
    var self = this;

    if (chunk.index < self._numChunks && !self._chunkData[chunk.index]) {
      self._chunkData[chunk.index] = chunk.data.slice(chunk.start);
      self._processed.push(chunk.index);
    }

  },
  /**
   *
   */
  needsPull: function() {

  },

  /**
   *
   */
  isComplete: function() {
    return this._processed.length === this._numChunks;
  },

  /**
   * Assembly the media segment chunks into a Blob.
   */
  getBlob: function(initSegment) {
    // FIXME
    var self = this;
    if (!!initSegment) {
      P2PTV.log('in getBlob: unshifting an initialization segment');
      self._chunkData.unshift(initSegment);
    }
    var blob = new Blob(self._chunkData, {type: 'video/webm'});
    return blob;
  },
  /**
   * Should be called before deleting this object.
   */
  destroy: function() {
    // TODO
  },
};

P2PTV.MediaSegment.prototype.constructor = P2PTV.MediaSegment;
