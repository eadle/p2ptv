
/**
 * Simple MSE wrapper for playback of WebM Byte Stream Format.
 *
 * streamId - The stream id generated for the associated stream.
 * options - The options for the video player.
 */
P2PTV.Player = function(streamId, options) {
  var self = this;
  options = options || {};

  if (typeof streamId !== 'string') {
    throw new Error('P2PTV Player expects stream id: ' + streamId);
  }
  self._streamId = streamId;

  self._initSegmentQueue  = []; // stores ArrayBuffer
  self._mediaSegmentQueue = []; // stores Blob

  self._appending = false;
  self._hasInitSegment = false;
  self._hasMediaSegment = false;

  self._sourceBuffer = null;
  self._reader = new FileReader();
  self._mediaSource = new MediaSource();

  self._setPlayerCallbacks();

  // create video element
  self._video = document.createElement('video');
  self._video.id = 'p2ptv-' + self._streamId;
  self._video.controls = true;
  self._video.width = options.width || 854;
  self._video.height = options.height || 480;
  self._video.src = window.URL.createObjectURL(self._mediaSource);
  self._video.pause();

  // append video element
  self._parentElementId = options.parentElementId;
  var parentElement = document.getElementById(self._parentElementId);
  if (!!parentElement) {
    P2PTV.log('Appending stream ' + self._streamId + ' to '
      + self._parentElementId);
    parentElement.appendChild(self._video);
  } else {
    P2PTV.log('Appending stream ' + self._streamId + ' to body');
    document.body.appendChild(self._video);
  }

  // temporary update loop
  setInterval(function() {
    if (!self._appending && !self._sourceBuffer.updating
      && self._mediaSegmentQueue.length > 0) {
      self._appending = true;
      self._reader.readAsArrayBuffer(self._mediaSegmentQueue.shift());
    }
  }, 1000/30);

};

P2PTV.Player.prototype = {

  /**
   * An initialization segment is ready for the player.
   * data - The initialization segment data received by the stream.
   */
  appendInitSegment: function(data) {
    var self = this;
    P2PTV.log('appending initialization segment: length=' + data.byteLength
      + ' bytes');
    if (!self._hasInitSegment) {
      self._sourceBuffer.appendBuffer(data);
    } else {
      this._initSegmentQueue.push(data);
    }
  },

  /**
   * A media segment is ready for the player.
   * data - The media segment data assembled by the push pull window.
   */
  appendMediaSegment: function(data, timecode) {
    var self = this;
    P2PTV.log('appending media segment: length=' + data.size + ' bytes');
    if (!self._hasMediaSegment) {
      timecode = -timecode || 0;
      P2PTV.log('setting timestampOffset to ' + timecode);
      self._sourceBuffer.timestampOffset = timecode;
      self._hasMediaSegment = true;
    }
    self._mediaSegmentQueue.push(data);
  },

  /** Set MediaSource and SourceBuffer callbacks. */
  _setPlayerCallbacks: function() {
    var self = this;

    self._mediaSource.addEventListener('sourceopen', function(event) {
      P2PTV.log('MediaSource event: sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';

      self._sourceBuffer = self._mediaSource.addSourceBuffer(type);
      //self._sourceBuffer.mode = 'sequence';
      P2PTV.log('timestampOffset: ' + self._sourceBuffer.timestampOffset);
      P2PTV.log('mode: ' + self._sourceBuffer.mode);

      self._sourceBuffer.addEventListener('abort', function() {
        P2PTV.log('SourceBuffer event: onabort');
      }, false);
      self._sourceBuffer.addEventListener('error', function(error) {
        P2PTV.log('SourceBuffer event: onerror: ' + error);
      }, false);
    }, false);
    self._mediaSource.addEventListener('sourceended', function(event) {
      P2PTV.log('sourceended');
    }, false);
    self._mediaSource.addEventListener('sourceclose', function(event) {
      P2PTV.log('sourceclose');
    }, false);

    self._reader.onload = function(event) {
      self._sourceBuffer.appendBuffer(new Uint8Array(event.target.result));
      // DONE: 2
      if (self._reader.readyState === FileReader.DONE) {
        if (self._video.paused) {
          P2PTV.log('playing video');
          self._video.play();
        }
        self._appending = false; 
      }
    };

  },

};

P2PTV.Player.prototype.constructor = P2PTV.Player;
