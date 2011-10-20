require('termcolor').define();
var assert = require('assert');
var T = { count : 0, success : 0 };
T.__proto__.total = function() { return this.success + '/' + this.count };

[ 'equal', 'ok', 'fail', 'notEqual', 'deepEqual', 'notDeepEqual', 'strictEqual', 'notStrictEqual']
.forEach(function(fname) {
  T.__proto__[fname] = (function(n) {
    return function() {
      this.count++;
      try {
        // var name = Array.prototype.pop.call(arguments);
        var name = arguments[arguments.length -1];
        assert[n].apply(assert, arguments);
        this.success++;
        console.green('[OK]', this.total(),  n, name);
        return true;
      }
      catch (e) {
        console.ered('[NG]', this.total(), n, name);
        console.eblue(e.stack);
        return false;
      }
    }
  })(fname);
});

module.exports = T;
