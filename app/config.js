var env = process.env;
var prod = env.ENV === 'production' ? true : false;

module.exports = {
  prod:     prod,
  domain:   prod ? env.DOMAIN         : 'localhost',
  url:      prod ? env.DOMAIN         : 'localhost:5000',
  port:     prod ? env.PORT           : 5000,
  psqlUrl:  prod ? env.DATABASE_URL   : 'postgres://admin:at@localhost/posties',
  redisUrl: prod ? env.REDISCLOUD_URL : 'redis://localhost:6379/0',
  revision: prod ? env.REVISION       : ''
};