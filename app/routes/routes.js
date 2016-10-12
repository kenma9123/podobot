var facebook_handler = require('../controllers/botkit').handler;

module.exports = function(app) {
  // root
  app.get('/', function(req, res) {
    // This enables subscription to the webhooks
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.FACEBOOK_VERIFY_TOKEN) {
      res.send(req.query['hub.challenge']);
    } else {
      res.send('Incorrect verify token');
    }
  });

  app.post('/', function(req, res) {
    facebook_handler(req.body);

    res.send('ok');
  });

  app.get('/test', function(req, res) {
    res.send('test');
  });
};
