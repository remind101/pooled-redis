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

  });

});
