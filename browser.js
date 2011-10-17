var u2r   = require('u2r');
var Junjo = require('junjo'); 
var spawn = require('child_process').spawn;
var cl    = require('termcolor').define();
var CookieManager = require('./CookieManager');

var debug = true;

const userAgents = {
  'firefox' : 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.6; ja-JP-mac; rv:1.9.2.16) Gecko/20110319 Firefox/3.6.16',
};
Object.freeze(userAgents);

const defaultHeader = {
  'User-Agent': 'node.js/' + process.version + ' ('+ process.platform +') http.clientRequest',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-us;q=0.7,en;q=0.3',
  'Accept-Charset': 'Shift_JIS,utf-8;q=0.7,*;q=0.7',
  'Keep-Alive': 120,
  'Connection': 'keep-alive',
  //'Accept-Encoding': 'gzip,deflate',
};
Object.freeze(defaultHeader);


var browse = (function() {

  var $j = new Junjo({result: true});
  $j.noTimeout();

  $j.inputs({
    url     : 0,
    options : 1,
    debug   : 2
  });


  $j('header', function(options) {
    options || (options = {});
    var header = (!options || !options.header) ? {} : options.header;

    Object.keys(defaultHeader).forEach(function(k) {
      if (typeof header[k] == "undefined") {
        header[k] = defaultHeader[k];
      }
    });
    if (options.cookie) header['Cookie'] = options.cookie;
    if (options.referer) header['Referer'] = options.referer;
    if (options.ua && userAgents[options.ua]) {
      header["User-Agent"] = userAgents[options.ua];
    }
    //if (debug && options.cookie) console.ecyan("using cookie", options.cookie);
    return header;
  })
  .after('options');


  $j('request', function(url, header, options) {
    var ops = u2r(url, options);
    if (ops.method == "POST") {
      header["Content-Type"]  = "application/x-www-form-urlencoded";
      header["Content-Length"] = ops.body.length;
    }

    if (debug) {
      console.egreen("-----REQUEST INFORMATION -----------");
      console.egreen("access to ", url);
      console.egreen("options", ops);
      console.egreen("header", header);
      console.egreen("------------------------------------");
    }

    var http = require(ops.protocol);
    var req = http.request(ops, this.cb);
    req.on('error', this.fail);

    Object.keys(header).forEach(function(k) {
      req.setHeader(k, header[k]);
    });

    if (ops.body) req.write(ops.body);
    req.end();
    this.out.url = url;
  })
  .after('url', 'header', 'options')
  .post(function(res) {
    if (debug) {
      console.ecyan("-----RESPONSE INFORMATION -----------");
      console.ecyan("statusCode", res.statusCode);
      console.ecyan("header", res.headers);
      console.ecyan("------------------------------------");
    }

    this.out.cookies = res.headers['set-cookie'] || [];
    this.out.statusCode = res.statusCode;
    this.out.responseHeaders = res.headers;

    if ([301, 302].indexOf(res.statusCode) >= 0) {
      this.out.location = res.headers.location;
      /*
      this.out.text = '';
      this.terminate();
      */
    }
  });


  $j('charset', function(contentType) {
    if (typeof contentType != 'string' || !contentType) {
      return 'utf-8';
    }
    return contentType.split('charset=')[1].toLowerCase();
  })
  .failSafe('utf-8')
  .pre(function(res) {
    return res.headers['content-type'];
  })
  .after('request');


  $j('iconv', function(res, charset) {
    var stream;

    if (charset.split(/[-_]/).join('') == 'utf8') {
      stream = res;
    }
    else {
      if (debug) console.eyellow("converting charset", charset, "to utf-8");
      var iconv = spawn('iconv', ['-f', charset, '-t', 'utf-8']);
      res.pipe(iconv.stdin);
      stream = iconv.stdout;
    }

    this.absorbData(stream);
  })
  .post(function(err, out) {
    this.out['text'] = out;
  })
  .err()
  .after('request', 'charset');


  return function browse(url, options, callback) {
    return (url) ? $j.clone().exec(url, options, callback) : $j.clone();
  }
})();

var jbrowser = (function() {
  var $b = new Junjo();
  $b.start(function(cookieManager) {
    this.$.cookieManager= cookieManager || new CookieManager();
  });
  $b("agent", function() { return "" });

  return function jbrowser(url, options, callback) {
    var $ret = $b.clone();
    options || (options = {});
    Object.keys(jbrowser.prototype).forEach(function(name) {
      $ret[name] = jbrowser.prototype[name];
    });
    $ret.noTimeout();
    $ret.count = 0;
    var mR = parseInt(options.maxRedirect), rC = parseInt(options.redirectCount);
    $ret.maxRedirect  = !isNaN(mR) ? mR : 10;
    $ret.redirectCount= !isNaN(rC) ? rC : 0;

    if (this instanceof jbrowser) return $ret;
    $ret.browse(url, options);
    return $ret.exec(callback);
  };
})();

jbrowser.prototype.browse = function() {
  var count = ++this.count;
  var firstlbl = "url_options" + count;
  var firstfn, host; // values to register
  var lastlbl = (arguments.length > 1 && (typeof arguments[1] == 'function' || typeof arguments[1] == 'string'))
    ? Array.prototype.shift.call(arguments)
    : "response" + count;
  var hostlbl = "host" + count;
  var $b = this;


  // getting url and option from previous callback
  if (arguments.length == 0) {
    firstfn = function(url, options) {
      return Junjo.multi(url, options || {});
    };
    host = function(url, options) { return u2r(url).host };
  }

  else {

    // getting url and option from given function 
    if (typeof arguments[0] == "function") {
      firstfn = arguments[0];
      host = function(url, options) { return u2r(url).host };
    }

    // getting url and option from given arguments 
    else {
      var url = arguments[0];
      firstfn = Junjo.multi(url, typeof arguments[1] == "object" ? arguments[1] : {});
      host = u2r(url).host;
    }
  }

  // set url and options
  var ret = this.register(firstlbl, firstfn)
  .post(function(url, options) {
    if (Array.isArray(url)) {
      options = url[1], url = url[0];
    }
    if (!options) options = {};
    return Junjo.multi(url, options);
  });

  // getting host
  this.register(hostlbl, host).after(firstlbl);

  // setting request cookie, referer, userAgent
  this.register("request_cookie" + count, function(url, options, host) {
    if ($b.redirectCount > $b.maxRedirect) throw new Error("redirect count exceeded");
    if (debug) console.yellow("redirect count", $b.redirectCount, "/", $b.maxRedirect);

    options.cookie = this.$.cookieManager.get(url);
    if (debug) console.yellow("cookie", options.cookie);

    options.ua = options.ua || this.results("agent");
    if (debug) console.eyellow("userAgent", options.ua || "(node.js default)");

    if (this.$.referer) {
      options.referer = this.$.referer;
    }
    this.$.referer = options.referer;
    if (debug) console.eyellow("referer", this.$.referer || "(null)");
    
    return Junjo.multi(url, options);
  })
  .after(firstlbl, hostlbl);

  // browse 
  this.register("browse" + count, function(url, options) {
    browse(url, options, this.cb);
  })
  .after("request_cookie" + count);

  // getting / setting response cookie
  this.register(lastlbl, function(err, out, host, url, options) {
    this.$.cookieManager.set(url, out.cookies);

    // if redirect flag, rebrowse
    if (out.location && !options.noredirect) {
      if (debug) console.eyellow("redirected to ", out.location);
      console.ered("original text", out.text);
      var $jb = new jbrowser();
      $jb.maxRedirect   = $b.maxRedirect;
      $jb.redirectCount = ++$b.redirectCount;
      $jb.browse(out.location, {
        ua            : options.ua,
        referer       : this.$.referer
      });
      $jb.exec(this.$.cookieManager, this.cb);
      this.noreferer = options.noreferer;
    }
    else $b.redirectCount = 0;

    return Junjo.args(err, out);
  })
  .firstError()
  .errout()
  .post(function(err, out) {
    if (!this.noreferer) this.$.referer = out.url;
  })
  .after("browse" + count, hostlbl, firstlbl);

  return ret;
};

module.exports = jbrowser;
module.exports.Junjo = Junjo;
