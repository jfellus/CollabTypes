
var DB = {};
DB.createIdPrefix = function() {
	// TODO : Create a unique ID in some 'session' table, there is a unique ID for each CollabXXX instance
}

DB.connect = function() {
	if(bConnected) return;

	// TODO DO Connect !
}

DB.createTable = function(name) {
	// TODO
}

DB.update = function(table, where, values) {
	// TODO
}

DB.insert = function(table, values) {
	// TODO
}

DB.remove = function(table, where) {
	// TODO
}

DB.connectTable = function(name) {
	DB.connect();
	return new DBTableConnection(name);
}

class DBTableConnection {
	constructor(table) { this.table = table; this.create(); }
	create() { return DB.createTable(this.table); }
	update(where, values) {	return DB.update(this.table, where, values); }
	insert(values) { return DB.insert(this.table, values); }
	remove(where) {	return DB.remove(this.table, where); }
}




module.exports = DB;
