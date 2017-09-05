require("./utils");

var Server = {};





// WS Server


var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {});
server.listen(10000, function() { });

var allConnections = [];

// create the server
wsServer = new WebSocketServer({  httpServer: server });

// WebSocket server
wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);

  connection.on('message', function(message) {
	  if(message.type === 'utf8') Server.onMessage(connection, message.utf8Data);
  });

  connection.on('close', function(connection) {
	  allConnections.remove(connection);
  });

  allConnections.push(connection);
});



// API

Server.sendAll = function(o) {
	if(typeof o != 'string') o = JSON.stringify(o);
	allConnections.forEach(function(c){ c.send(o); });
}

Server.sendAllExcept = function(o, except) {
	if(typeof o != 'string') o = JSON.stringify(o);
	allConnections.forEach(function(c){ if(c!==except) c.send(o); });
}

Server.onMessage = function() {throw "Server.onMessage Handler not defined";}

module.exports = Server;
