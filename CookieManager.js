var u2r   = require('u2r'),
    parse = require('url').parse;

function CookieManager(domains) {
  this.domains = domains || {};
}

CookieManager.prototype.set = function(url, cookies) {
  if (!Array.isArray(cookies)) return this;
  var domain = getDomain.call(this, u2r(url).host);

  // parsing cookie
  cookies.forEach(function(cookie) {
    var obj = cookie.split(";").reduce(function(sofar, v, k) {
      var val = v.split("=");
      if (val.length == 1) sofar[v] = true;
      else sofar[val[0].trim()] = val[1].trim();
      return sofar;
    }, {});
    obj.key = cookie.split("=", 1)[0];
    obj.value = obj[obj.key];
    delete obj[obj.key];
    obj.Expires = new Date(obj.Expires);
    (obj.Domain) ? getDomain.call(this, obj.Domain).$.push(obj) : domain.$.push(obj);
  }, this);
  return this;
};

CookieManager.prototype.get = function(url) {
  // parsing url
  var op         = u2r(url),
      isHTTP     = !!op.protocol.match(/^http/),
      isSecure   = (op.protocol == "https"),
      time       = new Date().getTime(),
      canditates = getCookieList.call(this, op.host),
      path       = op.path;

  if (!canditates) return "";

  var vals = canditates.reduce(function(sofar, cookieInfo) {
    if (cookieInfo.HttpOnly && !isHTTP) return sofar;
    if (cookieInfo.Secure && !isSecure) return sofar;
    if (cookieInfo.Expires) {
      if (typeof cookieInfo.Expires == "string") cookieInfo.Expires = new Date(cookieInfo.Expires);
      if (cookieInfo.Expires.getTime() < time) return sofar;
    }
    if (cookieInfo.Path && path.indexOf(cookieInfo.Path) != 0) return sofar;
    sofar[cookieInfo.key] = cookieInfo.value;
    return sofar;
  }, {});
  return Object.keys(vals).reduce(function(arr, k) {
    arr.push(k + "=" + vals[k]);
    return arr;
  }, []).join('; ');
};

function getCookieList(hostname) {
  return hostname.split('.').reverse().reduce(function(sofar, dom) {
    sofar.current = sofar.current[dom] || {};
    if (sofar.current.$) sofar.current.$.forEach(function(v) { sofar.arr.push(v) });
    return sofar;
  }, {current: this.domains, arr: []}).arr;
}

function getDomain(hostname) {
  return hostname.split(".").reverse().reduce(function(current, dom) {
    if (!current[dom]) current[dom] = {$: []};
    if (!dom) return current;
    return current[dom];
  }, this.domains);
}

module.exports = CookieManager;

