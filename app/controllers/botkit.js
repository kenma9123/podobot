var Botkit = require('botkit')
var mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/botkit-demo'
var db = require('../../config/db')({
  mongoUri: mongoUri
});
var request = require('request')

var controller = Botkit.facebookbot({
  debug: true,
  access_token: process.env.FACEBOOK_PAGE_TOKEN,
  verify_token: process.env.FACEBOOK_VERIFY_TOKEN,
  storage: db
});

var bot = controller.spawn({});

// subscribe to page events
request.post('https://graph.facebook.com/me/subscribed_apps?access_token=' + process.env.FACEBOOK_PAGE_TOKEN,
  function(err, res, body) {
    if (err) {
      controller.log('Could not subscribe to page messages');
    } else {
      controller.log('Successfully subscribed to Facebook events:', body);
      console.log('Botkit activated');

      // start ticking to send conversation messages
      controller.startTicking();
    }
  }
);

console.log('botkit');

// this is triggered when a user clicks the send-to-messenger plugin
controller.on('facebook_optin', function(bot, message) {
  bot.reply(message, 'Hey there. I\'m Podo. Nice to meet you.');
});

// user said hello
controller.hears(['hello'], 'message_received', function(bot, message) {
  bot.startTyping(message, function () {
    // do something here, the "is typing" animation is visible
  });

  bot.stopTyping(message, function () {
    // do something here, the "is typing" animation is not visible
  });

  bot.replyWithTyping(message, 'Hey there, how\'s your day?');
});

// // user says anything else
// controller.hears('(.*)', 'message_received', function(bot, message) {
//   bot.replyWithTyping(message, 'you said ' + message.match[1]);
// });

// check user submission
controller.hears(['check', 'submissions'], 'message_received', function(bot, message) {
  // start a conversation to handle this response.
  bot.startConversation(message, function(err, convo) {

    convo.say('Okay I will check your form submissions.');
    convo.ask('May I know the form ID?', function(response, convo) {
      var formID = response.text;
      convo.say('Cool, I\'ll be back in sec.');

      setTimeout(function() {
        // convo.replyWithTyping(message, 'Here\'s the submissions of your form.');
        convo.say('Form ID: '+formID+' and Submission as of 10/12/2016');

        convo.ask('Anything else?', [
          {
            pattern: bot.utterances.no,
            callback: function(response,convo) {
              convo.say('OK see you next time!');
              convo.next();
            }
          },
          {
            pattern: bot.utterances.yes,
            callback: function(response,convo) {
              convo.say('Great! ask away...');
              // do something else...
              convo.next();
            }
          },
          {
            default: true,
            callback: function(response,convo) {
              // just repeat the question
              convo.say('OK I think that\'s a NO, see yah!');
              convo.next();
            }
          }
        ]);
      }, 3000);
    });
  });
});

// this function processes the POST request to the webhook
var handler = function(obj) {
  controller.debug('GOT A MESSAGE HOOK from facebook');
  var message;

  // if we receive a message
  if (obj.entry) {
    for (var e = 0; e < obj.entry.length; e++) {
      for (var m = 0; m < obj.entry[e].messaging.length; m++) {
        var facebook_message = obj.entry[e].messaging[m];

        console.log(facebook_message);

        // normal message
        if (facebook_message.message) {
          message = {
            text: facebook_message.message.text,
            user: facebook_message.sender.id,
            channel: facebook_message.sender.id,
            timestamp: facebook_message.timestamp,
            seq: facebook_message.message.seq,
            mid: facebook_message.message.mid,
            attachments: facebook_message.message.attachments
          };

          // save if user comes from m.me adress or Facebook search
          createUserIfNew(facebook_message.sender.id, facebook_message.timestamp);

          // notify bot we receive a message
          controller.receiveMessage(bot, message);
        }
        // clicks on a postback action in an attachment
        else if (facebook_message.postback) {
          // trigger BOTH a facebook_postback event
          // and a normal message received event.
          // this allows developers to receive postbacks as part of a conversation.
          message = {
            payload: facebook_message.postback.payload,
            user: facebook_message.sender.id,
            channel: facebook_message.sender.id,
            timestamp: facebook_message.timestamp
          };

          controller.trigger('facebook_postback', [bot, message]);

          message = {
            text: facebook_message.postback.payload,
            user: facebook_message.sender.id,
            channel: facebook_message.sender.id,
            timestamp: facebook_message.timestamp
          };

          controller.receiveMessage(bot, message);
        }
        // When a user clicks on "Send to Messenger"
        else if (facebook_message.optin) {
          message = {
            optin: facebook_message.optin,
            user: facebook_message.sender.id,
            channel: facebook_message.sender.id,
            timestamp: facebook_message.timestamp
          };

          // save if user comes from "Send to Messenger"
          createUserIfNew(facebook_message.sender.id, facebook_message.timestamp);

          // user just clicked the send message
          controller.trigger('facebook_optin', [bot, message]);
        }
        // message delivered callback
        else if (facebook_message.delivery) {
          message = {
            optin: facebook_message.delivery,
            user: facebook_message.sender.id,
            channel: facebook_message.sender.id,
            timestamp: facebook_message.timestamp
          };

          // message has been delivered
          controller.trigger('message_delivered', [bot, message]);
        } else {
          // we dont understand the following fb hook
          controller.log('Got an unexpected message from Facebook: ', facebook_message);
        }
      }
    }
  }
}

var createUserIfNew = function(id, ts) {
  controller.storage.users.get(id, function(err, user) {
    if (err) {
      console.log(err);
    } else if (!user) {
      controller.storage.users.save({
        id: id,
        created_at: ts
      });
    }
  });
};

exports.handler = handler;
