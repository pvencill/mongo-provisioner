'use strict';

var _ = require('lodash'),
    mongo = require('mongodb').MongoClient,
    printf = require('util').format,
    random = require('./random');

var defaults = {
  host: 'localhost',
  port: 27017,
  prefix: null,
  minSuffix : 5,
  minId: 0,
  minPasswordLength: 32,
  dbName : null,
  userName: null,
  userPassword: null,
  userRole: ['dbOwner'],
  authDb : 'admin',
  allowExistingDb : false //allow connecting to an existing Database
};

function makeName(options){
  var parts = [random.number(options.minSuffix, options.minId)];
  if(options.prefix)
    parts.unshift(options.prefix, '_');
  return parts.join('');
}

function createConfig(options){
  var cfg = _.clone(options);
  cfg.dbName = options.dbName || makeName(options);
  cfg.userName = options.userName || makeName(options);
  cfg.userPassword = options.userPassword || random.passwd(options.minPasswordLength);
  return cfg;
}

function buildConnectionString(user, pw, options){
  var format = "mongodb://%s:%s@%s:%s/%s?authSource=%s";
    if(user && pw){ //connect with a username and password
        return printf(format, user, pw, options.host, options.port, options.dbName, options.authDb);
    }
    else{
        //connect without a username and password
        format = "mongodb://%s:%s/%s?authSource=%s";
        return printf(format, options.host, options.port, options.dbName);
    }
}

function provision(user, pw, options, cb){
  if(_.isFunction(options)){
    cb = options;
    options = {};
  }
  options = _.defaults(options || {}, defaults);
  var config = createConfig(options);

  var mongoUrl = buildConnectionString(user, pw, config);
  mongo.connect(mongoUrl, function(e, db){
    if(e) return cb(e);
    db.command({usersInfo: 1}, function(err, result){ //make sure the database wasn't already created
        if (result.users.length===0 || options.allowExistingDb){ // no users are in the database, can assume it is new
          if (!Array.isArray(config.userRole))
            config.userRole = [config.userRole];
          db.addUser(config.userName, config.userPassword, {roles: config.userRole}, function(err, res){
              if(err) return cb(err);
                  return cb(null, config);
          });
        }
        else {
          return cb(new Error('A database with this name already exists and the \'allowExistingDb\' option is false'));
        }
    });
  });
}

module.exports = provision;
