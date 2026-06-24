'use strict';

// ponytail: Twilio client created on first use — upgrade path: swap for any SMS provider
let _client;
function twilioClient() {
  if (!_client) {
    const twilio = require('twilio');
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _client;
}

async function enviarSms({ to, body }) {
  await twilioClient().messages.create({
    from: process.env.TWILIO_FROM,
    to,
    body,
  });
}

module.exports = { enviarSms };
