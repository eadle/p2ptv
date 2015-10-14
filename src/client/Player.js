
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

  self._appending = false;
  self._hasInitSegment = false;
  self._playOnMediaSegment = true;
  self._initSegmentQueue  = []; // stores ArrayBuffer
  self._mediaSegmentQueue = []; // stores timecode and Blob
  self._sourceBuffer = null;
  self._reader = new FileReader();
  self._mediaSource = new MediaSource();

  // create video element
  self._timeDisplayMode = 0;
  self._video = document.createElement('video');
  self._video.id = 'p2ptv-' + self._streamId;
  self._video.controls = !options.mediaPlayerControls;
  self._video.width = options.width || 854;
  self._video.height = options.height || 480;
  self._video.src = window.URL.createObjectURL(self._mediaSource);
  self._video.pause();
  self._setPlayerCallbacks(options.mediaPlayerControls);

  // append video element
  var parentElementId = options.parentElementId;
  self._parentElement = document.getElementById(parentElementId);
  if (!!self._parentElement) {
    P2PTV.log('Appending stream ' + self._streamId + ' to '
      + parentElementId);
    self._parentElement.appendChild(self._video);
  } else {
    P2PTV.log('Appending stream ' + self._streamId + ' to body');
    document.body.appendChild(self._video);
    self._parentElement = document.body;
  }

  // FIXME temporary update loop
  setInterval(function() {
    if (!self._appending && !self._sourceBuffer.updating
      && self._mediaSegmentQueue.length > 0) {
      self._appending = true;
      var mediaSegment = self._mediaSegmentQueue.shift();
      self._sourceBuffer.timestampOffset = mediaSegment.timestampOffset;
      self._reader.readAsArrayBuffer(mediaSegment.data);
    }
  }, 1000/30);

};

P2PTV.Player.prototype = {

  /** Set MediaSource and SourceBuffer callbacks. */
  _setPlayerCallbacks: function(controls) {
    var self = this;
    controls = controls || {};

    // media player control callbacks
    self._onPlayCallback = controls.onPlay || P2PTV.NOP;
    self._onPauseCallback = controls.onPause || P2PTV.NOP;
    self._onLastCallback = controls.onLast || P2PTV.NOP;
    self._onMuteCallback = controls.onMute || P2PTV.NOP;
    self._onUnmuteCallback = controls.onUnmute || P2PTV.NOP;
    self._onVolumeChangeCallback = controls.onVolumeChange || P2PTV.NOP;
    self._onSettingsCallback = controls.onSettings || P2PTV.NOP;
    self._onMaximizeCallback = controls.onMaximize || P2PTV.NOP;
    self._onMinimizeCallback = controls.onMinimize || P2PTV.NOP;

    // FIXME should enforce some requirements for custom controls
    self._playerContainerElement = controls.playerContainer;
    self._playbackButtonElement = controls.playbackButton;
    self._lastButtonElement = controls.lastButton;
    self._volumeButtonElement = controls.volumeButton;
    self._volumeSliderElement = controls.volumeSlider;
    self._settingsButtonElement = controls.settingsButton;
    self._resizeButtonElement = controls.resizeButton;
    self._elapsedTimeElement = controls.elapsedTime;

    // controls pausing and playing
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

    // jump to last media segment
    if (!!self._lastButtonElement) {
      self._lastButtonElement.onclick = function() {
        // TODO jump to the last media segment
        console.log('!!! last button click not implemented !!!');
        self._onLastCallback();
      };
    }

    // clicking volume button will mute and unmute
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

    // FIXME need to format current time
    if (!!self._elapsedTimeElement) {
      self._elapsedTimeElement.onclick = function() {
        // TODO clicking elapsed time should change format mode
        // ...
      };
    }


    // setting up video event callbacks
    // FIXME this is ugly
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
    // required for proper icon rendering on fullscreen change
    document.onmozfullscreenchange = document.onwebkitfullscreenchange
      = document.onfullscreenchange = function() {
      if (self.isFullScreen()) {
        self._onMaximizeCallback();
      } else {
        self._onMinimizeCallback();
      }
    };

    self._mediaSource.addEventListener('sourceopen', function(event) {
      P2PTV.log('MediaSource event: sourceopen');
      var type = 'video/webm; codecs="vorbis,vp8"';
      self._sourceBuffer = self._mediaSource.addSourceBuffer(type);
    }, false);

    self._reader.onload = function(event) {
      self._sourceBuffer.appendBuffer(new Uint8Array(event.target.result));
      if (self._reader.readyState === FileReader.DONE) {
        if (self._video.paused && self._playOnMediaSegment) {
          P2PTV.log('playing video');
          self._video.play();
        }
        self._appending = false; 
      }
    };

  },

  /** Returns true if the media player is in fullscreen. */
  isFullScreen: function() {
    return (document.webkitIsFullScreen || document.mozFullScreen);
  },
    
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
      self._initSegmentQueue.push(data);
    }
  },

  /**
   * A media segment is ready for the player.
   * data - The media segment data assembled by the push pull window.
   */
  appendMediaSegment: function(data, timestampOffset) {
    var self = this;
    timestampOffset = timestampOffset || 0;
    P2PTV.log('appending media segment: timestampOffset=' + timestampOffset
     + ', length=' + data.size + ' bytes');

    self._mediaSegmentQueue.push({
      timestampOffset: timestampOffset,
      data: data
    });
  }

};

P2PTV.Player.prototype.constructor = P2PTV.Player;
