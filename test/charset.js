var browser = require('browser');
var T = require('./load.test');
var http = require('http');
var S = require('statichoster');
var s = new S(__dirname + '/data', {
  html: "text/html"
});

var server = http.createServer(function(req, res) {
  s.host(req, res, function(err, result) {
  });
});
server.listen(12345);

var eucURL = "localhost:12345/euc-jp.html"
var utfURL = "localhost:12345/utf8.html"

$b = new browser();
$b.browse("euc", eucURL, {charset: "euc-jp"});

$b.browse("utf", utfURL, {charset: "utf-8"});

$b(function(e1, euc, e2, utf) {
  T.equal(euc.result, utf.result);
  process.exit();
})
.after("euc", "utf");

$b.run();
