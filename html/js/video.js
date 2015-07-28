/* video.js -- temporary wrapper for MSE */
'use strict';

function TempPlayer(id) {
  var self = this;

  self._isPlaying = false;
  self._initSegment = null;
  self._clusters = {};
  self._timecodeQueue = [];
  self._appending = false;

  self._setupVideo(id, 854, 480);

  self._reader = new FileReader();
  self._reader.onload = function(e) {
    self._sourceBuffer.appendBuffer(new Uint8Array(e.target.result));
  };
}

TempPlayer.prototype._setupVideo = function(id, width, height) {
  var self = this;

  // check that browser supports MediaSource
  if (!MediaSource)
    throw new Error('Your web browser lacks MediaSource support.');

  // create the media source
  self._mediaSource = new MediaSource();
  //var url = URL.createObjectURL(self._mediaSource);
  // setup video element
  self._video = document.getElementById(id);
  self._video.src = window.URL.createObjectURL(self._mediaSource);
  self._video.width = width;
  self._video.height = height;
  self._video.pause();

  // when the media source object is ready
  self._mediaSource.addEventListener('sourceopen', function(e) {
    console.log('sourceopen');
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
    trace('source ended');
  }, false);

  // testing sourceclose callback
  self._mediaSource.addEventListener('sourceclose', function(e) {
    trace('source closed');
  }, false);

};

TempPlayer.prototype._appendMediaSegment = function(timecode) {
  var self = this;
  self._appending = true;
  trace('appending media segment: timecode='+timecode);

  var cluster = new Blob(self._clusters[timecode], {type: 'video/webm'});
  self._reader.readAsArrayBuffer(cluster);

  // start playing video
  /*if (!self._isPlaying) {
    trace('appended buffer, giving it a second before playing...');
    setTimeout(function() {
      trace('playing video');
      self._isPlaying = true;
      self._video.play();
    }, 1000);
  }*/
  if (!self._isPlaying) {
    trace('playing video');
    self._isPlaying = true;
    self._video.play();
  }

  delete self._clusters[timecode];
  self._appending = false;
}

TempPlayer.prototype.addData = function(data) {
  var self = this;

  //console.log('addData');
  // decode the message
  var float64view = new Float64Array(data);
  var timecode = float64view[0];
  var uint8view = new Uint8Array(data, 8); 
  var type = uint8view[0] >> 6;
  switch (type) {
    case 0:
      var start = 9 + (0x07 & uint8view[0]);
      trace('appending initialization segment: timecode=' + timecode);
      // check if we should add the init seg to source
      self._sourceBuffer.appendBuffer(data.slice(start));
      //self._initSegment = data.slice(start);
      break;
    case 1:

      // decode relevant header information
      var start = 16 + (0x07 & uint8view[0]);
      var lastIndex = uint8view[2];
      var chunkIndex = uint8view[1];

      //trace('received a chunk (' + chunkIndex + ')');
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
        //trace('received a cluster: ' + timecode);
        if (!self._appending && self._timecodeQueue.length === 0)
          self._appendMediaSegment(timecode);
        else
          self._timecodeQueue.push(timecode);
      }

    default:
  }

}
