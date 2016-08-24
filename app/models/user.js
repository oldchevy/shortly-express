var db = require('../config');
var Link = require('./link.js');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users', 
  links: function() {
    return this.hasMany(Link, 'id');
  }
});

module.exports = User;