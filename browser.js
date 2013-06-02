var u2r   = require('u2r');
var Junjo = require('junjo'); 
var spawn = require('child_process').spawn;
var cl    = require('termcolor').define();
var CookieManager = require('./CookieManager');

require('./buffer-concat');

const userAgents = {
  'firefox' : 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10.6; ja-JP-mac; rv:1.9.2.16) Gecko/20110319 Firefox/3.6.16',
};
Object.freeze(userAgents);

const defaultHeader = {
  'User-Agent'      : 'node.js/' + process.version + ' ('+ process.platform +') http.clientRequest',
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language' : 'ja,en-us;q=0.7,en;q=0.3',
  'Accept-Charset'  : 'Shift_JIS,utf-8;q=0.7,*;q=0.7',
  'Keep-Alive'      : 120,
  'Connection'      : 'keep-alive',
  //'Accept-Encoding' : 'gzip,deflate',
};
Object.freeze(defaultHeader);


var browse = (function() {

  var $J = new Junjo.Template({noTimeout : true, destroy: true});

  $J.inputs({
    url     : 0,
    options : 1
  });

  $J.start(function(url, options) {
    this.$.debug = options.debug;
  });

  $J('header', function(options) {
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
    //if (this.$.debug && options.cookie) console.ecyan("using cookie", options.cookie);
    return header;
  })
  .after('options');


  $J('request', function(url, header, options) {
    var ops = u2r(url, options);
    if (ops.method == "POST") {
      header["Content-Type"]  = "application/x-www-form-urlencoded";
      header["Content-Length"] = ops.body.length;
    }

    if (this.$.debug) {
      console.egreen("-----REQUEST INFORMATION -----------");
      console.egreen("access to ", url);
      console.egreen("options", ops);
      console.egreen("header", header);
      console.egreen("------------------------------------");
    }

    var http = require(ops.protocol);
    delete ops.protocol;

    var req = http.request(ops, this.cb);
    req.on('error', this.fail);

    Object.keys(header).forEach(function(k) {
      req.setHeader(k, header[k]);
    });

    if (ops.body) req.write(ops.body);
    req.end();
    this.out.url = url;
  })
  .fail(function(e) {
    this.err = e;
    this.terminate();
  })
  .after('url', 'header', 'options')
  .post(function(res) {
    if (this.$.debug) {
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
      this.out.result = '';
      this.terminate();
      */
    }
  });

  $J('contentType', function(contentType) {
    var vals = contentType.split("; charset=");
    contentType = vals[0];
    var charset = vals[1] || "binary";
    if (typeof contentType != 'string' || !contentType) {
      return 'utf-8';
    }
    return Junjo.multi(contentType, charset);
  })
  .failSafe('', 'binary')
  .pre(function(res) {
    return res.headers['content-type'];
  })
  .after('request');


  $J('resultStream', function(res, contentType, charset, options) {
    charset = options.charset || charset;
    var stream;
    if (charset == "binary") {
      stream = res;

    }
    else {
      this.text = true;
      if (charset.toLowerCase().split(/[-_]/).join('') == 'utf8') {
        stream = res;
      }
      else {
        if (this.$.debug) console.eyellow("converting charset", charset, "to utf-8");
        var iconv = spawn('iconv', ['-f', charset, '-t', 'utf-8']);
        res.pipe(iconv.stdin);
        stream = iconv.stdout;
      }
      this.length = res.headers['content-length'];
    }
    this.absorb(stream, 'data', function(data, result) {
      return (result) ? Buffer.concat(result, data) : data;
    });
  })
  .eshift()
  .post(function(out) {
    if (!out) out = "";
    var len = out.length;
    if (this.$.debug && this.length && this.length != len) {
      console.ered("content-length in header (", this.length, ") and the actual length (", len, ") don't match");
    }
    this.out['result'] = (this.text) ? out.toString() : out;
  })
  .after('request', 'contentType', 'options');

  return function browse(url, options, callback) {
    return (url) ? new $J().exec(url, options, callback) : new $J();
  };
})();

var browser = function browser(url, options, callback) {

  var $ret = new Junjo({clear: true, destroy: true});

  $ret.start(function(options) {
    options || (options = {});
    this.$.cookieManager= new CookieManager(options.cookies);
  });

  $ret("agent", function() { return "" });

  options || (options = {});

  Object.keys(browser.prototype).forEach(function(name) {
    $ret[name] = browser.prototype[name];
  });

  $ret.noTimeout(true);
  $ret.count = 0;

  var mR = parseInt(options.maxRedirect);
  var rC = parseInt(options.redirectCount);
  $ret.maxRedirect  = !isNaN(mR) ? mR : 10;
  $ret.redirectCount= !isNaN(rC) ? rC : 0;

  if (this instanceof browser) return $ret;
  $ret.browse(url, options);
  return $ret.exec(callback);
};

/**
 * options
 *   (string) selector : css selector of the form to use, required.
 *   (string) from     : url of contents which contains the form to use, optional.
 *   (string) to       : url to submit, optional, default <form action="THIS VALUE">
 *   (object) data     : values to submit, optional, default {}.
 *   (string) method   : default POST
 *
 *   besides above, usual options for browsing are available such as debug, cookie, ua etc...
 **/
browser.prototype.submit = function() {
  var label = (arguments.length > 1) ? Array.prototype.shift.call(arguments) : undefined;
  var options = arguments[0];
  if (!options || typeof options != "object") throw new Error("browser#submit: options must be object.");
  if (typeof options.selector != "string") throw new Error("browser#submit: css selector is required.");
  var $b = this;
  var ret;
  if (typeof options.from == "string") ret = $b.browse(options.from);
  delete options.from;
  var formSubmit = $b.browse(label, function(err, out) {
    options.data || (options.data = {});
    var selector = options.selector;
    var $ = require("cheerio").load(out.result);
    var $form = $(selector);
    var url = options.to || $form.attr("action") || out.url;
    if (url.indexOf('/') == 0) {
      if (!out.url) throw new Error('No domain is specified in form ', selector);
      url = u2r(out.url).host + url;
    }
    delete options.to, options.selector;

    $form.find("input").each(function(k, el) {
      var $el = $(el);
      var name = $el.attr("name"), type = $el.attr("type"), val = $el.attr("value");
      if (type == "hidden" || type == "submit") {
        if (options.data[name] === undefined) options.data[name] = val;
      }
    });
    options.method = options.method || 'POST';
    return Junjo.multi(url, options);
  });
  if (ret) formSubmit.after();
  return ret || formSubmit;
};

browser.prototype.browse = function() {
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
  })
  .fail(function(e) {
    this.err = e;
    console.red(e.message);
    this.terminate();
  });

  // getting host
  this.register(hostlbl, host).after(firstlbl)
  .fail(function(e) {
    this.err = e;
    this.terminate();
  });

  // setting request cookie, referer, userAgent
  this.register("request_cookie" + count, function(url, options, host) {
    if ($b.redirectCount > $b.maxRedirect) throw new Error("redirect count exceeded");
    this.$.debug = options.debug;
    if (this.$.debug) console.eyellow("redirect count", $b.redirectCount, "/", $b.maxRedirect);

    options.cookie = this.$.cookieManager.get(url);
    if (this.$.debug) console.eyellow("cookie", options.cookie);

    options.ua = options.ua || this.results("agent");
    if (this.$.debug) console.eyellow("userAgent", options.ua || "(node.js default)");

    if (this.$.referer) {
      options.referer = this.$.referer;
    }
    this.$.referer = options.referer;
    if (this.$.debug) console.eyellow("referer", this.$.referer || "(null)");
    
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
      if (this.$.debug) {
        console.eyellow("redirected to ", out.location);
        console.eyellow("original result", out.result);
      }
      var $jb = new browser();
      $jb.maxRedirect   = $b.maxRedirect;
      $jb.redirectCount = ++$b.redirectCount;
      $jb.browse(out.location, {
        ua      : options.ua,
        referer : this.$.referer,
        debug   : this.$.debug
      });
      $jb.exec({cookies: this.$.cookieManager.domains}, this.cb);
      this.noreferer = options.noreferer;
    }
    else $b.redirectCount = 0;

    out.cookies = this.$.cookieManager.domains;
    return Junjo.multi(err, out);
  })
  .errout()
  .post(function(err, out) {
    if (!this.noreferer) this.$.referer = out.url;
  })
  .after("browse" + count, hostlbl, firstlbl);

  return ret;
};

module.exports = browser;

module.exports.Junjo = Junjo;

module.exports.browse = function() {
  var url = Array.prototype.shift.call(arguments);
  var cb  = Array.prototype.pop.call(arguments);
  var $b = new browser().noTimeout(true);
  $b.browse(url, arguments[0]);
  if (typeof cb != "function") cb = function() {};
  $b.exec(cb);
  return $b;
};
