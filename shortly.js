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

//This is the session check
var restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

app.get('/', restrict, 
function(req, res) {
  res.render('index');
});

app.get('/create', restrict, 
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,   
function(req, res) {

  // The way to do a 'join' query with bookshelf
  //Use this way if you didn't have the userID stored as a session var
  new User({ username: req.session.user.username })
      .fetch({withRelated: ['links']})
      .then (function(currUser) {
        if (currUser) {
          return currUser.related('links').fetch();
        }
      })
      .then(function(links) {
        res.status(200).send(links.models);
      });
});

app.post('/links', restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  var currId = req.session.user.id;

  //With userId stored as a session var, we can just filter our query on that,
  //instead of dealing with that joining nonsense above.
  new Link({ url: uri, userId: currId }).fetch().then(function(found) {
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
          baseUrl: req.headers.origin,
          userId: currId
        })
        .then(function(newLink) {
          //console.log(newLink);
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
  res.render('login');

  if (req.session.user) {
    req.session.destroy(function(err) {
      if (err) { console.log(err); }
    });
  }
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/login', function(req, res) {
  // console.log('post req:', req.body);

  new User({ username: req.body.username}).fetch().then(function(found) {
    if (found) {
      found.checkPassword(req.body.password, function(bool) {
        if (bool) {
          //Start session!
          req.session.user = found;
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
  // console.log('post signup req.body', req.body);
  new User({ username: req.body.username}).fetch().then(function(found) {
    // console.log('Inside first Promise');
    if (found) {
      res.redirect('/login');
    } else {
      Users.create({
        username: req.body.username,
        password: req.body.password
      })
      .then(function(newUser) {
        //Start session!
        req.session.user = newUser;
        res.redirect('/');
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
  // console.log('In Links route');
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
