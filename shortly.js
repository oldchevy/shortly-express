var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'keyboard cat',
  cookie: {}
}));

app.use(express.static(__dirname + '/public'));


var restrict = function(req, res, next) {
  console.log('in restrict');
  if (req.session.login) {
    next();
  } else {
    res.redirect('/login');
  }
};

app.get('/', restrict, 
function(req, res) {
  console.log('In / route');
  res.render('index');
});

app.get('/create', restrict, 
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,   
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', function(req, res) {
  console.log('/login');
  res.render('login');

  if (req.session.login) {
    req.session.destroy(function(err) {
      if (err) { console.log(err); }
    });
  }
});

app.get('/signup', function(req, res) {
  console.log('/signup');
  res.render('signup');
});

app.post('/login', function(req, res) {
  console.log('post req:', req.body);

  new User({ username: req.body.username}).fetch().then(function(found) {
    if (found) {
      console.log('For Login - \nsPassword: ', req.body.password, '\nHash: ', found.attributes.password);
      bcrypt.compare(req.body.password, found.attributes.password, function(err, result) {
        if (err) {
          throw err;
        }
        if (result) {
          req.session.login = true;
          res.redirect('/');      
        } else {
          res.redirect('/login');          
        }
      });
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/signup', function(req, res) {
  console.log('post signup req.body', req.body);
  new User({ username: req.body.username}).fetch().then(function(found) {
    console.log('Inside first Promise');
    if (found) {
      res.redirect('/login');
    } else {
      console.log('About to hash');
      bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(req.body.password, salt, null, function(err, hash) {
          console.log('For Signup - \nPassword: ', req.body.password, '\nHash: ', hash, '\nSalt: ', salt);
          if (err) {
            console.log(err);
            throw err;
          } else {
            Users.create({
              username: req.body.username,
              password: hash
            })
            .then(function(newUser) {
              req.session.login = true;
              res.redirect('/');
            });
          }
        });
      });
    }
  });
});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log('In Links route');
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
