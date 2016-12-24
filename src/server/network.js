'use strict';

var Peer = require('./peer.js'),
    debug = require('debug')('network');

function Network(networkType) {
  var self = this;

  var networkTypes = [
    'client-server'
  ];

  if (typeof networkType !== 'string' || networkTypes.indexOf(networkType) === -1) {
    throw new Error('Invalid network type (' + networkType + ')');
  }

}

module.exports = Network;
