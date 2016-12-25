'use strict';

var Peer = require('./peer.js'),
    Gateway = require('./gateway.js'),
    debug = require('debug')('network');

const NETWORK_TYPES = ['client-server'];

function Network(networkType, gateway) {
  var self = this;

  // verify that the requested network type is available
  if (typeof networkType !== 'string' || NETWORK_TYPES.indexOf(networkType) === -1) {
    throw new Error('Invalid network type (' + networkType + ')');
  }

  // verify that we have been passed the gateway node
/*
  if (null === gateway) {
    throw new Error('Invalid gateway reference (' + gateway + ')');
  }
*/

  // all networks use gateway reference
  self._gateway = gateway;

}

Network.prototype.insertClient = function(client) {

};

Network.prototype.removeClient = function(client) {

};

module.exports = Network;
