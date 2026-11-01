/* Sending email through Brevo's web API (no packages needed). If email is not set up, the message is printed in the
   server log instead, so an administrator can still copy the link from there. */
const C = require('./config');

const configured = () => !!(C.BREVO_API_KEY && C.MAIL_FROM);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function sendMail({ to, name, subject, text, link, button }) {
  if (!configured()) { console.log(`\n[email not set up] To: ${to}\nSubject: ${subject}\n${text}\n${link || ''}\n`); return false; }
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#18181b">
    <h2 style="color:#c8191f;margin:0 0 12px">AU Launchpad</h2>
    <p>${esc(text).replace(/\n/g, '<br>')}</p>
    ${link ? `<p style="margin:22px 0"><a href="${esc(link)}" style="background:#c8191f;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(button || 'Open')}</a></p>
    <p style="font-size:12px;color:#666">Or paste this address into your browser:<br>${esc(link)}</p>` : ''}
    <p style="font-size:12px;color:#666">If you did not expect this email, you can ignore it.</p></div>`;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': C.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: C.MAIL_FROM_NAME, email: C.MAIL_FROM }, to: [{ email: to, name: name || undefined }], subject, htmlContent: html, textContent: `${text}\n\n${link || ''}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.error('Email was not sent:', r.status, (await r.text()).slice(0, 300)); return false; }
    return true;
  } catch (e) { console.error('Email was not sent:', e.message); return false; }
}
module.exports = { sendMail, configured };
