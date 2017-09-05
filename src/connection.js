var ws = new WebSocket("ws://"+ window.location.hostname + ":10000");
ws.onmessage = Server.onReceive;

var msgId = 0;
var callbacks = {};

var Server = {};

Server.send = function(msg, onAnswer) {
	callbacks[msgId] = onAnswer;
	ws.send({id:msgId,data:msg});
	msgId++;
}

Server.onReceive = function(msg) {
	if(typeof msg === 'string') return Server.onReceive(JSON.decode(msg));
	if(msg.id) {
		var f = callbacks[msg.id];
		if(f) f(msg.data);
		delete callbacks[msg.id];
	}
}

Server.sendAsync = function(msg) {
	return new Promise((resolve,reject) => {
		Server.send(msg,function(ans) { resolve(ans);});
	});
}

Server.createIdPrefix = function() {
	return Server.sendAsync({cmd:'createIdPrefix'});
}

Server.createTable = function(name) {
	return Server.sendAsync({cmd:'createTable', name:name});
}

Server.update = function(table, where, values) {
	return Server.sendAsync({cmd:'update', table:table, where:where, values:values});
}

Server.insert = function(table, values) {
	return Server.sendAsync({cmd:'insert', table:table, values:values});
}

Server.remove = function(table, where) {
	return Server.sendAsync({cmd:'remove', table:table, where:where});
}

Server.connectTable = function(name) {
	var t = new DBTableConnection(name);
	return t.create();
}

class DBTableConnection {
	constructor(table) { this.table = table; }
	create() { return Server.createTable(this.table); }
	update(where, values) {	return Server.update(this.table, where, values); }
	insert(values) { return Server.insert(this.table, values); }
	remove(where) {	return Server.remove(this.table, where); }
}




module.exports = Server;
