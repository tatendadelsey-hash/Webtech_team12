/* Security helpers: password hashing, session tokens, login rate limit, password rules.
   Uses only Node's built-in crypto module. */
const crypto = require('node:crypto');

/* Passwords are never stored. We store scrypt(password, random salt), a slow one-way hash. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

/* Session ids are random. Only their SHA-256 is saved in the database, so a leaked database cannot be used to log in. */
const newToken = () => crypto.randomBytes(32).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* Same rule the sign-up screen shows: at least 8 characters, one number, one symbol. */
function passwordProblem(pw) {
  if (typeof pw !== 'string' || !pw) return 'Create a password.';
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (!/\d/.test(pw)) return 'Add at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Add at least one symbol, such as ! or @.';
  return '';
}

/* Simple in-memory limiter: at most `max` tries per `windowMs` for one key (used for log in). */
function makeLimiter(max, windowMs) {
  const hits = new Map();
  return {
    blocked(key) {
      const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
      hits.set(key, arr);
      return arr.length >= max;
    },
    add(key) { const arr = hits.get(key) || []; arr.push(Date.now()); hits.set(key, arr); },
    clear(key) { hits.delete(key); },
  };
}

module.exports = { hashPassword, verifyPassword, newToken, sha256, passwordProblem, makeLimiter };
