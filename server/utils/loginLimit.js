// Slows down password guessing: after MAX_FAILS wrong passwords for one email, sign-in for that
// email is refused for LOCK_MS. A correct password clears the count.
//
// ponytail: the counts live in this process's memory, so a restart clears them and a second server
// would keep its own. Move them to MongoDB if Eventify ever runs on more than one server.
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10000; // a flood of made-up emails can't grow the map without limit

const failures = new Map(); // email -> { count, lockedUntil }

const isLocked = (email, now = Date.now()) => (failures.get(email)?.lockedUntil || 0) > now;

function recordFailure(email, now = Date.now()) {
  if (failures.size >= MAX_TRACKED && !failures.has(email)) failures.clear();
  const count = (isLocked(email, now) ? 0 : failures.get(email)?.count || 0) + 1;
  failures.set(email, count >= MAX_FAILS ? { count: 0, lockedUntil: now + LOCK_MS } : { count, lockedUntil: 0 });
}

const clearFailures = (email) => failures.delete(email);

module.exports = { MAX_FAILS, LOCK_MS, isLocked, recordFailure, clearFailures };
