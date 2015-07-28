/*
 * This is derived from WebRTC's adapter.js, but works with
 * spoofed user agents (so far). It was slapped together pretty
 * quickly, so expect it to change.
 *
 */
'use strict';

var webrtcDetectedBrowser = 'unknown';

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}

// display user agent
trace('User agent: ' + navigator.userAgent);
// determine which browser it is
if (navigator.userAgent.match(/Edge/)) {
  trace('This appears to be Edge');
  webrtcDetectedBrowser = 'edge';

} else if (navigator.userAgent.match(/Firefox/)) {
  trace('This appears to be Firefox');
  webrtcDetectedBrowser = 'firefox';

} else if (navigator.userAgent.match(/(OPR|Opera)/)) {
  trace('This appears to be Opera');
  webrtcDetectedBrowser = 'opera';

} else if (navigator.userAgent.match(/Chrom(e|ium)/)) {
  trace('This appears to be Chrome');
  webrtcDetectedBrowser = 'chrome';

} else {
  trace('This browser may not be supported');
  webrtcDetectedBrowser = 'unknown';
}

// should work even with a spoofed user agent
if (window.mozRTCPeerConnection) {
  trace('has prefix: moz');
  webrtcDetectedBrowser = 'firefox';
  
  // RTCPeerConnection object
  window.RTCPeerConnection = function(pcConfig, pcConstraints) {
    // create RTCIceServers with a single url.
    if (pcConfig && pcConfig.iceServers) {
      var newIceServers = [];
      for (var i = 0; i < pcConfig.iceServers.length; i++) {
        var server = pcConfig.iceServers[i];
        if (server.hasOwnProperty('urls')) {
          for (var j = 0; j < server.urls.length; j++) {
            var newServer = {
              url: server.urls[j]
            };
            if (server.urls[j].indexOf('turn') === 0) {
              newServer.username = server.username;
              newServer.credential = server.credential;
            }
            newIceServers.push(newServer);
          }
        } else {
          newIceServers.push(pcConfig.iceServers[i]);
        }
      }
      pcConfig.iceServers = newIceServers;
    }
    return new mozRTCPeerConnection(pcConfig, pcConstraints);
  };

  // RTCSessionDescription object
  window.RTCSessionDescription = window.RTCSessionDescription
    || window.mozRTCSessionDescription;

  // RTCIceCandidate object
  window.RTCIceCandidate = window.RTCIceCandidate
    || window.mozRTCIceCandidate;

} else if (window.webkitRTCPeerConnection) {

  trace('has prefix: webkit');
  if (webrtcDetectedBrowser !== 'opera') {
    webrtcDetectedBrowser = 'chrome';
  }

  // RTCPeerConnection object
  window.RTCPeerConnection = function(pcConfig, pcConstraints) {
    return new webkitRTCPeerConnection(pcConfig, pcConstraints);
  };

  // add promise support
  ['createOffer', 'createAnswer'].forEach(function(method) {
    var nativeMethod = webkitRTCPeerConnection.prototype[method];
    webkitRTCPeerConnection.prototype[method] = function() {
      var self = this;
      if (arguments.length < 1 || (arguments.length === 1 &&
          typeof(arguments[0]) === 'object')) {
        var opts = arguments.length === 1 ? arguments[0] : undefined;
        return new Promise(function(resolve, reject) {
          nativeMethod.apply(self, [resolve, reject, opts]);
        });
      } else {
        return nativeMethod.apply(this, arguments);
      }
    };
  });
  ['setLocalDescription', 'setRemoteDescription',
      'addIceCandidate'].forEach(function(method) {
    var nativeMethod = webkitRTCPeerConnection.prototype[method];
    webkitRTCPeerConnection.prototype[method] = function() {
      var args = arguments;
      var self = this;
      return new Promise(function(resolve, reject) {
        nativeMethod.apply(self, [args[0],
            function() {
              resolve();
              if (args.length >= 2) {
                args[1].apply(null, []);
              }
            },
            function(err) {
              reject(err);
              if (args.length >= 3) {
                args[2].apply(null, [err]);
              }
            }]
          );
      });
    };
  });

  // RTCSessionDescription object
  window.RTCSessionDescription = window.RTCSessionDescription
    || window.webkitRTCSessionDescription;

  // RTCIceCandidate object
  window.RTCIceCandidate = window.RTCIceCandidate
    || window.webkitRTCIceCandidate;

} else if (!!window.RTCPeerConnection) {
  trace('Your browser doesn\'t support WebRTC');
} 

if (typeof module !== 'undefined') {
  module.exports = {
    RTCIceCandidate: RTCIceCandidate,
    RTCPeerConnection: RTCPeerConnection,
    RTCSessionDescription: RTCSessionDescription,
    webrtcDetectedBrowser: webrtcDetectedBrowser,
  };
}
