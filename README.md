browser
==========
[Node.js] browsing urls with cookies, that is, we can scrape with authenticated pages!

### Installation ###
    git clone git://github.com/shinout/browser.git

    OR

    npm install browser 

### Features ###
 - automatic cookie management
 - easy asynchronous handling with <a href="https://github.com/shinout/Junjo.js">Junjo.js</a>

### Usage ###
#### helloworld (onetime access) ####
    var browser = require("browser");
    browser.browse("shinout.net", function(err, out) {
      console.log(out.result);
    });

#### helloworld2 (using object) ####
    var browser = require("browser");
    var $b = new browser();
    $b.browse('https://accounts.google.com/Login'); // browse this url

    /* running on end of all browsings
     *   err: error object or null
     *   out: { result : result body, ...}
     */
    $b.on("end", function(err, out) {
      console.log(out.url, out.result, out.responseHeaders);
    });
    $b.run(); // execution

#### login sample (requires jquery) ####
    var userdata = {
      email: "XXXXXX@gmail.com",
      pass : "XXXXXXXX"
    };

    var $b = new browser();
    $b.submit({
      from : 'https://accounts.google.com/Login',
      selector: "#gaia_loginform",
      data : {
        Email  : userdata.email,
        Passwd : userdata.pass
      }
    });

    // authenticated access
    $b.browse('https://mail.google.com/mail/u/0/?ui=html&zy=d')
    .after(); // browse after previously registered function

    /* running on end of all browsings
     *   err: error object or null
     *   out: { result : result body, ...}
     */
    $b.on("end", function(err, out) {
      console.log(out.url, out.result, out.responseHeaders);
    });

#### login sample2 (do what $b.submit() is doing manually) ####
    var userdata = {
      email: "XXXXXX@gmail.com",
      pass : "XXXXXXXX"
    };

    var browser = require("browser");
    var $b = new browser();
    // $b.browse(the label of this request, url to access)
    $b.browse('login', 'https://accounts.google.com/Login', {debug: true});

    /* $b.browse(function(
     *   err : errors occured in the previous request, 
     *   out : result of the previous browsing
     *) { return url or return [url, options] }
     */
    $b.browse(function(err, out) {
      var jsdom = require("jsdom").jsdom;
      var jquery = require("jquery");
      var window = jsdom(out.result).createWindow();
      var $ = jquery.create(window);
      var postdata = {
        Email  : userdata.email,
        Passwd : userdata.pass
      };
      var url = $("#gaia_loginform").attr("action");
      // get hidden fields, and register them to post data
      $("input").each(function(k, el) {
        var $el = $(el);
        var name = $el.attr("name"), type = $el.attr("type"), val = $el.val();
        if (type == "hidden" || type == "submit") postdata[name] = val;
      });
      return [url, {
        data  : postdata, // set post data
        method: "POST"    // set HTTP method (default: GET)
      }];
    })
    .after("login"); // browse after browsing with label="login"

    $b.browse('https://mail.google.com/mail/u/0/?ui=html&zy=d')
    .after(); // browse after previously registered function

    $b.on("end", function(err, out) {
      console.log(out.result);
    });
    $b.run();

#### options object ####
>option object to pass to $b.browse() is the same format as u2r options.
See <a href="https://github.com/shinout/u2r">u2r</a> in detail.
The following are common options.

 - data   : (object) key-value pairs to pass to server
 - method : HTTP method (GET|POST|PUT|DELETE|HEAD). default: GET

>all other values below are automatically generated from URL

 - host
 - protocol
 - path
 - port
 - body : querystring format of options.data

#### keys of out object ####
 - result : response data(Buffer or String)
 - statusCode
 - location
 - responseHeaders
 - cookies : set-cookie headers
 - url : browsed url

### Contact ###
Feel free to contact <a href="twitter.com/shinout">@shinout</a>!
