
/**
 * Simple MSE wrapper for playback of WebM Byte Stream Format.
 *
 * id - The stream id generated for the associated stream.
 * options - The options for the video player.
 */
P2PTV.MediaPlayer = function(id, options) {
  var self = this;
  options = options || {};

  if (typeof id !== 'string') {
    throw new Error('P2PTV MediaPlayer expects an id: ' + id);
  }

  self._id = id;
  self._streamQueue = [];

  // control settings
  self._timeDisplayMode = 0;
  self._playOnMediaSegment = true;

  // create video element
  self._video = document.createElement('video');
  self._video.id = 'p2ptv-' + self._id;
  self._video.controls = !options.mediaPlayerControls;
  self._video.width = options.width || 854;
  self._video.height = options.height || 480;
  //self._video.src = window.URL.createObjectURL(self._stream.mediaSource);
  //self._video.pause();

  if (typeof options.mediaPlayerControls === 'object') {
    self._setupControls(options.mediaPlayerControls);
  }

  // append video element
  var parentElementId = options.parentElementId;
  self._parentElement = document.getElementById(parentElementId);
  if (!!self._parentElement) {
    P2PTV.log('Appending stream ' + self._id + ' to ' + parentElementId);
    self._parentElement.appendChild(self._video);
  } else {
    P2PTV.log('Appending stream ' + self._id + ' to body');
    document.body.appendChild(self._video);
    self._parentElement = document.body;
  }

  // FIXME temporary update loop
  setInterval(function() {


    if (self._streamQueue.length > 0) {
      var stream = self._streamQueue[0];

      // FIXME should switch stream.readyState
      if (!stream.active) {
        stream.active = true;
        self._video.src = window.URL.createObjectURL(stream.mediaSource);
        self._video.pause();
      } else if (self._streamIsFinished(stream)) {
        self._streamQueue.shift();
      } else if (self._streamCanAppend(stream)) {
        stream.appending = true;
        var mediaSegment = stream.mediaSegmentQueue.shift();
        stream.sourceBuffer.timestampOffset = mediaSegment.timestampOffset;
        stream.reader.readAsArrayBuffer(mediaSegment.data);
      }

    }

  }, 1000/30);

};

P2PTV.MediaPlayer.prototype = {

  /** Returns true if a stream should append to the source buffer. */
  _streamCanAppend: function(stream) {
    return !stream.appending && !stream.sourceBuffer.updating
      && (stream.mediaSegmentQueue.length > 0);
  },

  /** Returns true if a stream . */
  _streamIsFinished: function(stream) {
    var self = this;
    return stream.complete && (stream.mediaSegmentQueue.length === 0) 
      && (self._video.readyState <= 2);
  },

  /** Setup MediaSource, SourceBuffer, and FileReader callbacks. */
  _setupStreamCallbacks: function(stream) {
    var self = this;

    stream.mediaSource.addEventListener('sourceopen', function(event) {
      // P2PTV.log('MediaSource event: sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';

      stream.sourceBuffer = stream.mediaSource.addSourceBuffer(type);

      stream.sourceBuffer.addEventListener('updateend', function() {
        // P2PTV.log('SourceBuffer event: updateend');
        stream.appending = false;
      }, false);

      stream.sourceBuffer.appendBuffer(stream.initSegment);

    }, false);

    stream.mediaSource.addEventListener('sourceended', function(event) {
      // P2PTV.log('MediaSource event: sourceended');
    }, false);

    stream.reader.onload = function(event) {
      stream.sourceBuffer.appendBuffer(new Uint8Array(event.target.result));
      if (stream.reader.readyState === FileReader.DONE) {
        if (stream.active && self._video.paused
          && self._playOnMediaSegment) {
          P2PTV.log('playing video');
          self._video.play();
        }
      }
    };

  },

  /** Setup custom controls. */
  _setupControls: function(controls) {
    var self = this;
    controls = controls || {};

    self._playerContainerElement = controls.playerContainer;

    // media player callbacks
    self._onPlayCallback = controls.onPlay || P2PTV.NOP;
    self._onPauseCallback = controls.onPause || P2PTV.NOP;
    self._onLastCallback = controls.onLast || P2PTV.NOP;
    self._onMuteCallback = controls.onMute || P2PTV.NOP;
    self._onUnmuteCallback = controls.onUnmute || P2PTV.NOP;
    self._onVolumeChangeCallback = controls.onVolumeChange || P2PTV.NOP;
    self._onSettingsCallback = controls.onSettings || P2PTV.NOP;
    self._onMaximizeCallback = controls.onMaximize || P2PTV.NOP;
    self._onMinimizeCallback = controls.onMinimize || P2PTV.NOP;

    // gui elements
    self._playbackButtonElement = controls.playbackButton;
    self._lastButtonElement = controls.lastButton;
    self._volumeButtonElement = controls.volumeButton;
    self._volumeSliderElement = controls.volumeSlider;
    self._settingsButtonElement = controls.settingsButton;
    self._resizeButtonElement = controls.resizeButton;
    self._elapsedTimeElement = controls.elapsedTime;

    // playing and pausing stream 
    if (!!self._playbackButtonElement) {
      self._playbackButtonElement.onclick = function() {
        if (self._video.paused) {
          self._playOnMediaSegment = true;
          self._video.play();
        } else {
          self._playOnMediaSegment = false;
          self._video.pause();
        }
      };
    }

    // jumping to most recent media segment
    if (!!self._lastButtonElement) {
      self._lastButtonElement.onclick = function() {
        // TODO jump to the last media segment
        console.log('!!! last button click not implemented !!!');
        self._onLastCallback();
      };
    }

    // muting and unmuting
    if (!!self._volumeButtonElement) {
      self._volumeButtonElement.onclick = function() {
        self._video.muted = !self._video.muted;
        if (self._video.muted) {
          self._onMuteCallback();
        } else {
          self._onUnmuteCallback();
        }
      };
    }

    // FIXME volume slider needs some fine-tweaking
    if (!!self._volumeSliderElement) {
      self._volumeSliderElement.onchange = function() {
        if (self._video.muted) {
          self._video.muted = false;
        }
        self._video.volume = self._volumeSliderElement.value/100;
      };
      self._volumeSliderElement.oninput = function() {
        if (self._video.muted) {
          self._video.muted = false;
        }
        self._video.volume = self._volumeSliderElement.value/100;
      };
    }

    // FIXME not sure how to handle this yet
    if (!!self._settingsButtonElement) {
      self._settingsButtonElement.onclick = function() {
        self._onSettingsCallback();
      };
    }

    // maximizing and minimizing the media player
    if (!!self._resizeButtonElement) {
      self._resizeButtonElement.onclick = function() {

        if (self.isFullScreen()) {
          // minimize window
          if (document.cancelFullScreen) {
            document.cancelFullScreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
          }
        } else {
          // maximize window
          if (self._playerContainerElement.mozRequestFullScreen) {
            self._playerContainerElement.mozRequestFullScreen();
          } else {
            self._playerContainerElement.webkitRequestFullScreen();
          }
        }

      };
    }

    // clicking elapsed time changes display mode
    if (!!self._elapsedTimeElement) {
      self._elapsedTimeElement.onclick = function() {
        // TODO clicking elapsed time should change format mode
        // ...
      };
    }

    self._video.addEventListener('playing', function() {
      self._onPlayCallback();
    }, false);

    self._video.addEventListener('pause', function() {
      self._onPauseCallback();
    }, false);

    self._video.addEventListener('volumechange', function() {
      if (!self._video.muted) {
        self._onVolumeChangeCallback(self._video.volume);
      }
    }, false);

    self._video.addEventListener('timeupdate', function() {
      if (!!self._elapsedTimeElement) {
        var currentTime = self._video.currentTime;
        var hours = Math.floor(currentTime/3600),
            minutes = Math.floor(currentTime/60)%60,
            seconds = Math.floor(currentTime)%60;
        var format = (hours > 0) ? hours + ';' : '';
        format += (hours > 0 && minutes < 10) ? '0' + minutes : minutes;
        format += ':';
        format += (seconds < 10) ? '0' + seconds : seconds;
        self._elapsedTimeElement.innerHTML = format;
      }
    }, false);

    var onFullScreenChange = function() {
      if (self.isFullScreen()) {
        self._onMaximizeCallback();
      } else {
        self._onMinimizeCallback();
      }
    };
    // FIXME shouldn't set all of them
    document.onmozfullscreenchange = onFullScreenChange;
    document.onwebkitfullscreenchange = onFullScreenChange;
    document.onfullscreenchange = onFullScreenChange;

  },

  /** Returns true if the media player is in fullscreen. */
  isFullScreen: function() {
    return (document.webkitIsFullScreen || document.mozFullScreen);
  },


    
  /**
   * Append an initialization segment to the append stream.
   *
   * data - An initialization segment ArrayBuffer.
   */
  appendInitSegment: function(data) {
    var self = this;

    P2PTV.log('appending initialization segment: length=' + data.byteLength
      + ' bytes');

    if (self._streamQueue.length > 0) {
      // previous stream isn't expecting any more media segments
      self._streamQueue[self._streamQueue.length-1].complete = true;      
    }

    var stream = {
      active: false,
      appending: true,
      complete: false,
      initSegment: data,     // stores ArrayBuffer
      mediaSegmentQueue: [], // stores Blob and timestampOffset
      initialTimecode: -1,   // initial media segment timecode unknown
      sourceBuffer: null,
      mediaSource: new MediaSource(),
      reader: new FileReader()
    };
    self._setupStreamCallbacks(stream);
    self._streamQueue.push(stream);

  },

  /**
   * Append a media segment to the append stream.
   *
   * data - A media segment Blob with a zeroed out timecode.
   * timecode - The original timecode of the media segment.
   */
  appendMediaSegment: function(data, timecode) {
    var self = this;

    P2PTV.log('appending media segment: timecode=' + timecode
     + ', length=' + data.size + ' bytes');

    var stream = self._streamQueue[self._streamQueue.length - 1];

    if (stream.initialTimecode < 0) {
      stream.initialTimecode = timecode;
    }

    timecode = timecode | 0;
    var timestampOffset = (timecode - stream.initialTimecode)/1000;

    stream.mediaSegmentQueue.push({
      timestampOffset: timestampOffset,
      data: data
    });

  }

};

P2PTV.MediaPlayer.prototype.constructor = P2PTV.MediaPlayer;
