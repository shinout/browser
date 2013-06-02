    var userdata = require('./accounts/google');

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
      var $ = require("cheerio").load(out.result);
      var postdata = {
        Email  : userdata.email,
        Passwd : userdata.pass
      };
      var url = $("#gaia_loginform").attr("action");
      // get hidden fields, and register them to post data
      $("input").each(function(k, el) {
        var $el = $(el);
        var name = $el.attr("name"), type = $el.attr("type"), val = $el.attr("value");
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

