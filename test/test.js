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

    it('defaults to connecting to localhost:5672', function() {

      var redis = new PooledRedis();

      expect(redis.port).to.equal(5672);
      expect(redis.host).to.equal('localhost');

      expect(redis.options.poolMaxSize).to.equal(10);
      expect(redis.options.poolMinSize).to.equal(2);

      expect(Redis.createClient).to.be.calledWith(5672, 'localhost');

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

    it('defaults to port 5672 and no password with a connection URL', function() {

      var redis = new PooledRedis(
        'redis://redis.example.com',

        // pass in options so we can test that they're merged with the
        // password
        { poolMaxSize: 20 }
      );

      expect(redis.port).to.equal(5672);
      expect(redis.host).to.equal('redis.example.com');
      expect(redis.options.auth_pass).to.be.not.ok;
      expect(redis.options.poolMaxSize).to.equal(20);

      expect(Redis.createClient).to.be.calledWith(5672, 'redis.example.com');
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

});
