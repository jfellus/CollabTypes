const EventEmitter = require('events');

// TreeNode

// NOTE : A Tree has a single root TreeNode. This is the only node with parent=null. All other nodes must be
// descendants of the root


class TreeNode extends EventEmitter {
	constructor(id, parent) {
		super();
		this.id = id;
		this.parent = parent;
		this.children = [];
		if(this.parent) this.parent.children.push(this);
	}

	isRoot() {
		return this.parent === null;
	}

	add(child) {
		if(child.parent !== this) child.reparent(this);
	}

	reparent(newParent) {
		if(!newParent) throw "ParentCantBeNull";
		if(this.parent == newParent) return;
		if(this.isAncestor(newParent)) throw "WouldCreateCycle";
		var oldParent = this.parent;
		oldParent.children.remove(this);
		this.parent = newParent;
		this.parent.children.push(this);
		super.emit('reparent', {node:this,oldParent:oldParent});
	}

	remove(child) {
		if(child.parent != this) throw "ChildParentMismatch";
		child.detach();
	}

	isDescendant(ancestor) {
		return ancestor.isAncestor(this);
	}

	isAncestor(child) {
		if(!child) return false;
		if(!child.parent) return false;
		if(child.parent == this) return true;
		return this.isAncestor(child.parent);
	}

	isSibling(node) {
		return node.parent === this.parent;
	}

	detach() {
		this.parent.children.remove(this);
		super.emit('remove', this);
	}

	getTree() {
		if(this.tree) return this.tree;
		if(!this.parent) return null;
		return this.parent.getTree();
	}
}

// Tree

class Tree extends EventEmitter {
	constructor() {
		// Create root node with special id 'root'
		this.root = new TreeNode('root', null);
		this.root.tree = this;
		this.nodes = {root:this.root};
	}

	/** @param parent: optional. If defined as null, this means "root". If not specified, props.parent must be defined
	    @param id: optional. If not defined, props.id must be defined */
	create(props, parent, id) {
		if(parent===null) parent = 'root';
		if(!parent) {
			if(props.parent===null) parent = 'root';
			else if(props.parent) parent = props.parent;
			else throw "NoParent";
		}
		if(!id) {
			if(props.id) id = props.id;
			else throw "NoID";
		}
		if(!parent.id) parent = this.nodes[parent];
		if(!parent) throw "NoSuchParent";
		var n = new TreeNode(id, parent);
		for(var k in props) {
			if(k!='id' && k!='parent') n[k] = props[k];
		}
		return n;
	}
}




module.exports = Tree;
