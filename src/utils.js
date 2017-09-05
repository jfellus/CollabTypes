// Polyfills

Array.prototype.remove || (Array.prototype.remove = function(x) {
	 for(var i = this.length; i--;) {
		 if(this[i] === x) this.splice(i, 1);
	 }
});
