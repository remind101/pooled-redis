'use strict';

var _ = require('underscore'),
    Pool = require('generic-pool'),
    Q = require('q'),
    Redis = require('redis');

var PooledRedis = function PooledRedis(port, host, options) {
  var self = this;

  self.port = port || 5672;
  self.host = host || 'localhost';
  self.options = _.extend(
    {
      poolMaxSize: 10,
      poolMinSize: 2
    },
    options || {}
  );

  this.pool = Pool.Pool({
    name: 'redis',
    create: function(callback) {
      var client = Redis.createClient(self.port, self.host, self.options);
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
    max: self.options.poolMaxSize,
    min: self.options.poolMinSize,
    idleTimeoutMillis: self.options.poolIdleTimeoutMillis || 60 * 1000,
    log: self.options.poolLog || false
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

PooledRedis.prototype.hgetall = function(key) {
  return this.command('hgetall', key);
};

PooledRedis.prototype.hmset = function(key, updates) {
  var args = ['hmset', key].concat(_.flatten(_.pairs(updates)));

  return this.command.apply(this, args);
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
    .fail(deferred.reject)
    .done();

  return deferred.promise;
};

PooledRedis.prototype.rpoplpush = function(source, dest) {
  return this.command('rpoplpush', source, dest);
};

PooledRedis.prototype.sadd = function(key, value) {
  return this.command('sadd', key, value);
};

PooledRedis.prototype.set = function(key, value, expireSeconds) {

  var args = ['set', key, value];

  if (expireSeconds) {
    args.push('EX', expireSeconds);
  }

  return this.command.apply(this, args);

};

PooledRedis.prototype.setnx = function(key, value, expireSeconds) {

  var deferred = Q.defer(),
      args = ['set', key, value, 'NX'];

  if (expireSeconds) {
    args.push('EX', expireSeconds);
  }

  this.command.apply(this, args)
    .then(function(result) {
      if (result == 'OK') {
        deferred.resolve(result);
      } else {
        deferred.reject('NX failed');
      }
    })
    .fail(deferred.reject)
    .done();

  return deferred.promise;
};

PooledRedis.prototype.smembers = function(key) {
  return this.command('smembers', key);
};

PooledRedis.prototype.get = function(key) {
  var deferred = Q.defer();

  this.command('get', key)
    .then(function(result) {
      if (result === null) {
        deferred.reject('not found');
      } else {
        deferred.resolve(result);
      }
    })
    .fail(deferred.reject)
    .done();

  return deferred.promise;
};

PooledRedis.prototype.zrange = function(key, start, stop, withscores) {
  var args = ['zrange', key, start, stop];

  if (!!withscores) {
    args.push('WITHSCORES');
  }

  return this.command.apply(this, args);
}

PooledRedis.prototype.zrangebyscore = function(key, start, stop, withscores) {
  var args = ['zrangebyscore', key, start, stop];

  if (!!withscores) {
    args.push('WITHSCORES');
  }

  return this.command.apply(this, args);
}

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
    })
    .done();
  return deferred.promise;
};

PooledRedis.prototype.multi = function(commands) {

};

module.exports = PooledRedis;
