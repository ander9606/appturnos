'use strict';

async function enviarSms({ to, body }) {
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sender: 'Zaturno', recipient: to, content: body, type: 'transactional' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Brevo SMS error ${res.status}: ${err.message ?? res.statusText}`);
  }
}

module.exports = { enviarSms };
