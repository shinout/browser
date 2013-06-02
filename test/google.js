var browser = require("browser");
var userdata = require('./accounts/google');
if (require("path").existsSync(__dirname + "/accounts/google.cookie.json")) {
  var cookieData = require('./accounts/google.cookie.json');
}
else {
  var cookieData = null;
}

console.log("cookieData", cookieData);
var $b = new browser();

// if cookieData exists, then omit login process
if (!cookieData) {
  console.yellow("login");

  $b.submit({
    from     : 'https://accounts.google.com/Login',
    selector : "#gaia_loginform", 
    data     : {
      Email  : userdata.email,
      Passwd : userdata.pass,
      PersistentCookie : "yes"
    },
    debug    : true
  });
}
else {
  console.yellow("login process was omitted");
}

$b.browse('https://mail.google.com/mail/u/0/?ui=html&zy=d').after();

$b.on("end", function(err, out) {
  console.log(out.result);

  // saving cookie data (out.cookies)
  require("fs").writeFileSync(__dirname + "/accounts/google.cookie.json", JSON.stringify(out.cookies));
});

// run with cookie data if exists
$b.run({cookies:cookieData});
