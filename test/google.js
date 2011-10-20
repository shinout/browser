var browser = require("browser");
var T = require('./load.test');
var userdata = require('./accounts/google');

var $b = new browser();
$b.submit({
  from     : 'https://accounts.google.com/Login',
  selector : "#gaia_loginform", 
  data     : {
    Email  : userdata.u,
    Passwd : userdata.p,
    PersistentCookie : "yes"
  }
});
$b.browse('https://mail.google.com/mail/u/0/?ui=html&zy=d').after();

$b.on("end", function(err, out) {
  T.ok(out.result.match("logout"), "has logined");
});

$b.run();
