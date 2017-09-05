(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const CollabTree = require("./collab-tree");

},{"./collab-tree":2}],2:[function(require,module,exports){
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

},{"./connection":3,"./tree":4}],3:[function(require,module,exports){
var ws = null; // TODO open and link with onReceive
var msgId = 0;
var callbacks = {};

var Server = {};

Server.send = function(msg, onAnswer) {
	callbacks[msgId] = onAnswer;
	ws.send({id:msgId,data:msg});
	msgId++;
}

Server.onReceive = function(msg) {
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

},{}],4:[function(require,module,exports){
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

},{"events":5}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[1]);
