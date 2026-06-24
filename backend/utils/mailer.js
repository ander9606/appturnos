'use strict';
const nodemailer = require('nodemailer');

// ponytail: lazy singleton — upgrade path: extract to DI container if testing needs mocking
let _transport;
function transport() {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transport;
}

async function enviarEmail({ to, subject, html }) {
  await transport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

module.exports = { enviarEmail };
