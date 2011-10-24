var browser = require('browser');
var T = require('./load.test');

browser.browse("shinout.net", function(err, out) {
  T.equal(out.statusCode, 200);
  T.equal(out.cookies.length, 0);
  T.equal(typeof out.responseHeaders.date, "string");
  T.equal(typeof out.responseHeaders["content-length"], "string");
  T.equal(typeof out.result, "string");
});
