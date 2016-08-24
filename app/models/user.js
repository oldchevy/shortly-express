var db = require('../config');
var Link = require('./link.js');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users', 
  
  links: function() {
    return this.hasMany(Link, 'userId');
  },

  checkPassword: function(pass, callback) {
    bcrypt.compare(pass, this.get('password'), function(err, result) {
      callback(result);
    });
  },

  initialize: function() {
    this.on('creating', function(model) {

      var genHash = Promise.promisify(bcrypt.hash);

      return genHash(model.get('password'), null, null).then(function(hash) {
        model.set('password', hash);
      });
    });
  },

});

module.exports = User;