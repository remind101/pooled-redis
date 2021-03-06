'use strict';

var _ = require('underscore'),
    url = require('url'),
    Pool = require('generic-pool'),
    Q = require('q'),
    Redis = require('redis');

var registry = [];

var PooledRedis = function PooledRedis(port, host, options) {
  var self = this,
      database = null;

  // if options and host were not specified, or host is an object,
  // attempt to parse port as a connection string;
  // ie, redis://password@host:port/
  if (typeof port === 'string' && !options && (!host || _.isObject(host))) {
    var parsedUrl = url.parse(port);

    if (parsedUrl.protocol != 'redis:') {
      throw 'Unrecognized protocol: ' + parsedUrl.protocol;
    }

    options = host || {};
    port = parseInt(parsedUrl.port, 10);
    host = parsedUrl.hostname;
    options.auth_pass = (parsedUrl.auth || '').split(':').pop();

    if (parsedUrl.path) {
      var dbNum = parseInt(parsedUrl.path.substr(1), 10);
      if (dbNum != NaN) {
        database = dbNum;
      }
    }
  }

  self.port = port || 6379;
  self.host = host || '127.0.0.1';
  self.database = database;
  self.options = _.extend(
    {
      poolMaxSize: 10,
      poolMinSize: 2
    },
    options || {}
  );

  self.pool = Pool.Pool({
    name: 'redis',
    create: function(callback) {
      var client = Redis.createClient(self.port, self.host, self.options);
      client.on('error', function (err) {
        console.log('Redis Error', err);
        callback(err, null);
      });
      client.on('connect', function() {
        if (self.database) {
          // issue the select command before returning the client
          client.select(self.database, function(err) {
            callback(err, client);
          });
        } else {
          callback(null, client);
        }
      });
      client.release = function() {
        self.pool.release(client);
      };
    },
    destroy: function(client) {
      client.quit();
    },
    max: self.options.poolMaxSize,
    min: self.options.poolMinSize,
    idleTimeoutMillis: self.options.poolIdleTimeoutMillis || 60 * 1000,
    log: self.options.poolLog || false
  });

  registry.push(self);
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

// del will take an arbitrary number of keys and delete them.
PooledRedis.prototype.del = function() {
  var args = ['del'].concat(Array.prototype.slice.call(arguments));
  return this.command.apply(this, args);
};

PooledRedis.prototype.get = function(key) {
  return this.command('get', key);
};

PooledRedis.prototype.expire = function(key, seconds) {
  return this.command('expire', key, seconds)
};

PooledRedis.prototype.mget = function() {
  var args = ['mget'].concat(Array.prototype.slice.call(arguments));
  return this.command.apply(this, args);
};

PooledRedis.prototype.hgetall = function(key) {
  return this.command('hgetall', key);
};

PooledRedis.prototype.hmget = function() {
  var args = ['hmget'].concat(Array.prototype.slice.call(arguments));
  return this.command.apply(this, args);
}

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

PooledRedis.prototype.sadd = function(key, field) {
  return this.command('sadd', key, field);
};

PooledRedis.prototype.srem = function(key, field) {
  return this.command('srem', key, field);
};

PooledRedis.prototype.srandmember = function(key, count) {
  return this.command('srandmember', key, count);
};

PooledRedis.prototype.spop = function(key, count) {
  return this.command('spop', key, count);
};

PooledRedis.prototype.hsetnx = function(key, field, value) {
  return this.command('hsetnx', key, field, value);
};

PooledRedis.prototype.hget = function(key, field) {
  return this.command('hget', key, field);
};

PooledRedis.prototype.hgetall = function(key) {
  return this.command('hgetall', key);
};

PooledRedis.prototype.hdel = function(key, field) {
  return this.command('hdel', key, field);
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

PooledRedis.prototype.zcard = function(key) {
  return this.command('zcard', key);
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
  try {
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
  } catch (e) {
    deferred.reject(e);
  }
  return deferred.promise;
};

PooledRedis.prototype.multi = function(commands) {
};

PooledRedis.prototype.disconnect = function() {
  var self = this;
  var deferred = Q.defer();
  if (self.pool) {
    var resolveAfterDraining = function() {
      self.pool.destroyAllNow();
      deferred.resolve(self);
    };
    self.pool.drain(resolveAfterDraining);
  } else {
    deferred.resolve(self);
  }
  return deferred.promise;
};

PooledRedis.disconnectAll = function() {
  var disconnectPromises = registry.map(function(instance) {
    return instance.disconnect();
  });
  registry = [];
  return Q.all(disconnectPromises);
};

module.exports = PooledRedis;
