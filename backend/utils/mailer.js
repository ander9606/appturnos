'use strict';
const { Resend } = require('resend');

// ponytail: lazy singleton — upgrade path: inject in tests via dependency inversion
let _resend;
function client() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

async function enviarEmail({ to, subject, html }) {
  await client().emails.send({
    from: process.env.RESEND_FROM || 'Zaturno <onboarding@resend.dev>',
    to,
    subject,
    html,
  });
}

module.exports = { enviarEmail };
