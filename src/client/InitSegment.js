
P2PTV.InitSegment = function(args) {
  var self = this;
  args = args || {};

  self._timecode = args.timecode;
  self._start = args.start;
  self._data = args.data;

};

P2PTV.InitSegment.prototype = {

};

P2PTV.InitSegment.prototype.constructor = P2PTV.InitSegment;
