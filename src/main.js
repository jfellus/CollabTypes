Server = require("./server");

Server.onMessage = function(c,x) {
	Server.sendAll(x);
}
