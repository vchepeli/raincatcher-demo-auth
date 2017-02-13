var $fh = require('fh-mbaas-api');
var express = require('express');
var mbaasExpress = $fh.mbaasExpress();
var cors = require('cors');
var mediator = require('fh-wfm-mediator/lib/mediator');
var bodyParser = require('body-parser');
var raincatcherUser = require('fh-wfm-user/lib/router/mbaas');
var sessionInit = require('./lib/sessionInit');

// list the endpoints which you want to make securable here
var securableEndpoints;
securableEndpoints = ['/hello'];

var app = express();

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys(securableEndpoints));
app.use('/mbaas', mbaasExpress.mbaas);

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.use('/hello', require('./lib/hello.js')());
app.use('/api', bodyParser.json({limit: '10mb'}));

/**
 * Session and Cookie configuration
 * This is being consumed in the raincatcher-user mbaas router.
 * For available stores, see
 * {@link https://github.com/feedhenry-raincatcher/raincatcher-user/tree/master/lib/session/mongoProvider.js}
 *
 * Redis is default store.
 * Switch to MongoDB:
 * 1. make sure to upgrade your database in Data Browser part of the RHMAP
 * 2. change 'store' attribute of sessionOptions to 'mongo'
 * 3. deploy
 */
var sessionOptions = {
  store: 'redis',
  config: {
    secret: process.env.FH_COOKIE_SECRET || 'raincatcher',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: '/'
    }
  }
};

// find out mongodb connection string from $fh.db
function run(cb) {
  sessionInit(sessionOptions, function(err) {
    if (err) {
      return cb(err);
    }
    // List the user fields which you don't want appearing in the authentication response.
    // This is being consumed in the raincatcher-user mbaas router.
    var authResponseExclusionList = ['password'];
    raincatcherUser.init(mediator, app, authResponseExclusionList, sessionOptions, function(err) {
      if (err) {
        return cb(err);
      }
      require('./lib/user')(mediator);

      // Important that this is last!
      app.use(mbaasExpress.errorHandler());

      var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
      var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
      app.listen(port, host, function(err) {
        cb(err, port);
      });
    });
  });
}

run(function(err, port) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("App started at: " + new Date() + " on port: " + port);
});
