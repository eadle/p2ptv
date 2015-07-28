var P2PTV = require('../index.js');

var p2ptv = new P2PTV({
  signaling: 8188,  // ws port
  upstream: 9001,   // upstream port
  bitrate: 2500,    // bitrate in Kbps 
  durations: false
});
