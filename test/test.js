var _ = require('underscore'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    Redis = require('redis'),
    PooledRedis = require('../');

expect = chai.expect;
chai.use(sinonChai);

describe('Pooled Redis', function() {

  beforeEach(function() {

    // stub out Redis client creation
    Redis.createClient = sinon.stub().returns(
      { on: sinon.stub() }
    );

  });

  describe('#constructor', function() {

    it('takes the port and host as arguments', function() {

      var redis = new PooledRedis(1234, 'redis.example.com', {});

      expect(redis.port).to.equal(1234);
      expect(redis.host).to.equal('redis.example.com');

      expect(Redis.createClient).to.be.calledWith(1234, 'redis.example.com');

    });

    it('sets the options from arguments', function() {

      var redis = new PooledRedis(
        1234, 'redis.example.com',
        { auth_pass: 'password' }
      );

      expect(redis.options.auth_pass).to.equal('password');

    });

    it('defaults to connecting to 127.0.0.1:6379', function() {

      var redis = new PooledRedis();

      expect(redis.port).to.equal(6379);
      expect(redis.host).to.equal('127.0.0.1');

      expect(redis.options.poolMaxSize).to.equal(10);
      expect(redis.options.poolMinSize).to.equal(2);

      expect(Redis.createClient).to.be.calledWith(6379, '127.0.0.1');

    });

    it('will set the host, port, and password from a connection URL', function() {

      var redis = new PooledRedis(
        'redis://password@redis.example.com:1234',

        // pass in options so we can test that they're merged with the
        // password
        { poolMaxSize: 20 }
      );

      expect(redis.port).to.equal(1234);
      expect(redis.host).to.equal('redis.example.com');
      expect(redis.options.auth_pass).to.equal('password');
      expect(redis.options.poolMaxSize).to.equal(20);

      expect(Redis.createClient).to.be.calledWith(1234, 'redis.example.com');
    });

    it('defaults to port 6379 and no password with a connection URL', function() {

      var redis = new PooledRedis(
        'redis://redis.example.com',

        // pass in options so we can test that they're merged with the
        // password
        { poolMaxSize: 20 }
      );

      expect(redis.port).to.equal(6379);
      expect(redis.host).to.equal('redis.example.com');
      expect(redis.options.auth_pass).to.be.not.ok;
      expect(redis.options.poolMaxSize).to.equal(20);

      expect(Redis.createClient).to.be.calledWith(6379, 'redis.example.com');
    });

    it('requires that the protocol be `redis`', function() {

      var raised = false;

      try {
        new PooledRedis('http://password@redis.example.com');
      } catch (e) {
        raised = true;
      }

      expect(raised).to.be.ok;

    });

  });

  describe('#disconnect', function() {
    it('calls pool#drain on disconnect', function() {
      var redis = new PooledRedis();
      redis.disconnect();
      expect(redis.pool._draining).to.be.true;
    });
  });

  describe('#disconnectAll', function() {
    it('calls #disconnect on all pools ever created', function() {
      var pools = [1, 2, 3].map(function() {
        return new PooledRedis();
      });
      PooledRedis.disconnectAll();
      pools.forEach(function(pool) {
        expect(pool.pool._draining).to.be.true;
      });
    });
  });
});
