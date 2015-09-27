
/**
 * TODO fill this out
 *
 * streamId -
 * options - 
 */
P2PTV.Player = function(streamId, options) {
  var self = this;
  options = options || {};

  if (typeof streamId !== 'string') {
    throw new Error('P2PTV Player expects stream id: ' + streamId);
  }
  self._streamId = streamId;

  // FIXME width and height should be options
  self._width = 854;
  self._height = 480;
  self._parentElementId = options.parentElementId;

  self._initSegment = null;
  self._clusters = {}; 
  self._timecodeQueue = []; 
  self._appending = false;
  self._isPlaying = false;

  self._mediaSource = null;
  self._sourceBuffer = null;
  self._setupVideo();

  self._reader = new FileReader();
  self._reader.onload = function(e) {
    self._sourceBuffer.appendBuffer(new Uint8Array(e.target.result));
  };

};

P2PTV.Player.prototype = {
  /**
   * TODO fill this out
   */
  _setupVideo: function() {
    var self = this;

    // using MSE
    self._mediaSource = new MediaSource();

    // create video element
    var parentElement = document.getElementById(self._parentElementId);
    self._video = document.createElement('video');
    self._video.id = 'p2ptv-' + self._streamId;
    self._video.controls = true;
    self._video.width = self._width;
    self._video.height = self._height;
    self._video.src = window.URL.createObjectURL(self._mediaSource);
    self._video.pause();

    // append video element
    if (!!parentElement) {
      P2PTV.log('Appending stream ' + self._streamId + ' to '
        + self._parentElementId);
      parentElement.appendChild(self._video);
    } else {
      P2PTV.log('Appending stream ' + self._streamId + ' to body');
      document.body.appendChild(self._video);
    }

    // when the media source object is ready
    self._mediaSource.addEventListener('sourceopen', function(e) {
      P2PTV.log('sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';
      self._sourceBuffer = self._mediaSource.addSourceBuffer(type);
      self._sourceBuffer.addEventListener('updateend', function() {
        if (self._timecodeQueue.length > 0) {
          self._appendMediaSegment(self._timecodeQueue.shift());
        }   
      }, false);
    }, false);

    // testing sourceended callback
    self._mediaSource.addEventListener('sourceended', function(e) {
      P2PTV.log('source ended');
    }, false);

    // testing sourceclose callback
    self._mediaSource.addEventListener('sourceclose', function(e) {
      P2PTV.log('source closed');
    }, false);

  },

  /**
   * TODO fill this out
   *
   * timecode -
   */
  _appendMediaSegment: function(timecode) {
    var self = this;
    self._appending = true;
    P2PTV.log('appending media segment: timecode='+timecode);

    var cluster = new Blob(self._clusters[timecode], {type: 'video/webm'});
    self._reader.readAsArrayBuffer(cluster);

    if (!self._isPlaying) {
      P2PTV.log('playing video');
      self._isPlaying = true;
      self._video.play();
    }

    delete self._clusters[timecode];
    self._appending = false;
  },

  addData: function(data) {
    var self = this;

    // decode the message
    var float64view = new Float64Array(data);
    var timecode = float64view[0];
    var uint8view = new Uint8Array(data, 8);
    var int32view = new Int32Array(data);
    var type = uint8view[0] >> 6;
    switch (type) {
      case 0:
        var start = 9 + (0x07 & uint8view[0]);
        P2PTV.log('appending initialization segment: timecode=' + timecode);
        // check if we should add the init seg to source
        self._sourceBuffer.appendBuffer(data.slice(start));
        //self._initSegment = data.slice(start);
        break;
      case 1:

        // decode relevant header information
        var start = 16 + (0x07 & uint8view[0]);
        var lastIndex = uint8view[2];
        var chunkIndex = uint8view[1];

        //var duration = int32view[3];
        //P2PTV.log('received a chunk: chunkIndex=' + chunkIndex
        // + ', finalIndex=' + lastIndex + ', duration=' + duration + 'ms');

        // insert the cluster chunk into the cluster
        var cluster = self._clusters[timecode];
        if (!cluster) {
          cluster = new Array(lastIndex+1);
          cluster[chunkIndex] = data.slice(start);
          self._clusters[timecode] = cluster;
        } else {
          cluster[chunkIndex] = data.slice(start);
        }

        // check if we have a full cluster
        if (chunkIndex+1 === cluster.length) {
          //P2PTV.log('received a cluster: ' + timecode);
          if (!self._appending && self._timecodeQueue.length === 0)
            self._appendMediaSegment(timecode);
          else
            self._timecodeQueue.push(timecode);
        }

      default:
    }

  }

};

P2PTV.Player.prototype.constructor = P2PTV.Player;
