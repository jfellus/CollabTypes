var Tree = require("./tree");
var Connection = require("./connection");

class CollabTree {
	/** The name of the CollabTree is the name of the corresponding SQL table */
	constructor(name) {
		super();
		var _super = super;
		this.name = name;
		this.tree = new Tree();
		this.db =
		this.curId = 0;
		Connection.connectTable(name).then((db) => {
			that.db = db;
				return Server.createIdPrefix();
		}).then((idPrefix) => {
			that.idPrefix = idPrefix;
			_super.emit('ready');
		});
	}

	/** @return a TreeNode (see ./tree.js) */
	getNode(id) {
		var n = this.tree.nodes[id];
		if(!n) throw "NoSuchTreeNode";
		return n;
	}

	/** Creates a new TreeNode, update database, and notify to other peers
	 *	@param parent: optional. If defined as null, this means "root". If not specified, props.parent must be defined
	 *  NOTE : Unique IDs are created here */
	create(props, parent) {
		var db = this.db;
		var name = this.name;
		var that = this;
		var node = this.tree.create(props, parent, this._createId());
		db.insert(node);
		this._notify('add', node);

		node.on('reparent', function(r){
			db.update({id:r.node.id},{parent:r.node.parent.id});
			that._notify('reparent', {id:r.node.id,parent:r.node.parent.id});
		});
		node.on('remove', function(node){
			db.remove({id:node.id});
			that._notify('remove', node.id);
		});

		return node;
	}

	/** Node removal facility (nodes can be directly removed with notification and so on by calling TreeNode.detach()) */
	remove(node) { return node.detach(); }

	/** Node reparenting facility (nodes can be directly reparented with notification and so on by calling TreeNode.reparent()) */
	reparent(node, newParent) { return node.reparent(newParent); }

	/** Fill the Tree from the database */
	fetch() {
		var nodes = this.tree.nodes;
		var r = this.db.selectAll();
		var x;
		while(x = r.fetchAssoc()) {
			if(!nodes[x.parent]) nodes[x.parent] = this.tree.create(x,this.tree.root);
			if(!nodes[x.id]) nodes[x.id] = this.tree.create(x);
			else nodes[x.id].reparent(x.parent);
		}
		return this.tree;
	}

	/** Apply an incoming update from another peer */
	apply(cmd, x) {
		if(cmd==='add') this._apply_add(x);
		else if(cmd==='remove') this._apply_remove(x);
		else if(cmd==='reparent') this._apply_reparent(x);
		else throw "NoSuchCommand";
	}

	// Private

	_apply_add(node) {
		if(!node.id || !node.parent) throw "Must have id and parent properties";
		var parent = this.getNode(node.parent);
		return this.tree.create(node,parent);
	}

	_apply_reparent(node, newParent) {
		if(node.id) node = node.id;
		if(newParent.id) newParent = newParent.id;
		node = this.getNode(node);
		newParent = this.getNode(newParent);
		node.reparent(newParent);
	}

	_apply_remove(node) {
		if(node.id) node = node.id;
		node = this.getNode(node);
		node.detach();
	}

	_notify(cmd, x) {
		Connection.send({type:'CollabTree', name:this.name, cmd:cmd, x:x});
	}

	_createId() {
		return this.idPrefix + (this.curId++);
	}
}

module.exports = CollabTree;
