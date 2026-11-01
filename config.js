/* Settings read from environment variables (set them on your hosting site; none are needed on your own computer). */
const DATABASE_URL = process.env.DATABASE_URL || '';
module.exports = {
  // Demo mode: sample people, and invite / reset links shown on screen instead of emailed.
  // It is ON on your own computer and OFF as soon as a real online database (DATABASE_URL) is used. DEMO_MODE=1 or 0 overrides.
  DEMO_MODE: process.env.DEMO_MODE !== undefined ? process.env.DEMO_MODE !== '0' : !DATABASE_URL,
  // The public address of the site, used in emailed links, for example https://au-launchpad.onrender.com
  APP_URL: (process.env.APP_URL || '').replace(/\/+$/, ''),
  // Sending email (Brevo): BREVO_API_KEY, MAIL_FROM (a sender address you verified in Brevo), MAIL_FROM_NAME
  BREVO_API_KEY: process.env.BREVO_API_KEY || '',
  MAIL_FROM: process.env.MAIL_FROM || '',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'AU Launchpad',
  // Behind a hosting proxy (Render, Railway) the visitor's real address is in X-Forwarded-For.
  TRUST_PROXY: process.env.TRUST_PROXY === '1' || process.env.RENDER === 'true',
};
