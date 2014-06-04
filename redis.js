'use strict';

var Pool = require('generic-pool'),
    Q = require('q'),
    Redis = require('redis');

var PooledRedis = function PooledRedis() {
  var localThis = this;
  this.pool = Pool.Pool({
    name: 'redis',
    create: function(callback) {
      var client = Redis.createClient();
      client.on('error', function (err) {
        console.log('Redis Error', err);
      });
      client.release = function() {
        localThis.pool.release(client);
      };
      callback(null, client);
    },
    destroy: function(client) {
      client.end();
    },
    max: 10,
    min: 2,
    idleTimeoutMillis: 60 * 1000,
    log: false
  });
};

PooledRedis.prototype.client = function() {
  var deferred = Q.defer();
  this.pool.acquire(function(err, client) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(client);
    }
  });
  return deferred.promise;
};

PooledRedis.prototype.brpoplpush = function(source, dest, timeout) {
  return this.command('brpoplpush', source, dest, timeout);
};

PooledRedis.prototype.del = function(key) {
  return this.command('del', key);
};

PooledRedis.prototype.get = function(key) {
  return this.command('get', key);
};

PooledRedis.prototype.lpop = function(key) {
  return this.command('lpop', key);
};

PooledRedis.prototype.lrem = function(key, index, value) {
  return this.command('lrem', key, index, value);
};

PooledRedis.prototype.renameex = function(oldName, newName) {
  var deferred = Q.defer();
  this.command('renameex', oldName, newName)
    .then(function(result) {
      if (!result) {
        deferred.fail('refusing to overwrite', oldName, newName);
      } else {
        deferred.resolve();
      }
    })
    .fail(function(err) {
      deferred.fail(err);
    });
  return deferred;
};

PooledRedis.prototype.rpoplpush = function(source, dest) {
  return this.command('rpoplpush', source, dest);
};

PooledRedis.prototype.sadd = function(key, value) {
  return this.command('sadd', key, value);
};

PooledRedis.prototype.set = function(key, value, expireSeconds) {
  return this.command('set', key, value, expireSeconds);
};

PooledRedis.prototype.setnx = function(key, value) {
  return this.command('setnx', key, value);
};

PooledRedis.prototype.smembers = function(key) {
  return this.command('smembers', key);
};

PooledRedis.prototype.command = function() {
  var deferred = Q.defer();
  var args = Array.prototype.slice.call(arguments);
  var name = args.shift();
  this.client()
    .then(function(client) {
      // Tack on a callback
      args.push(function(err, result) {
        client.release();
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve(result);
        }
      });
      client[name].apply(client, args);
    })
    .fail(function(err) {
      console.log('unable to get client', err);
      deferred.reject(err);
    });
  return deferred.promise;
};

PooledRedis.prototype.multi = function(commands) {
  
};

module.exports = PooledRedis;
