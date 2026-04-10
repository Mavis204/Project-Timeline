/**
 * server/middleware/requireAuth.js
 *
 * Authentication guard middleware.
 * Uncomment usage in server/routes/state.js once auth is implemented.
 *
 * IMPLEMENTATION HINT (GitHub Copilot):
 *   Install: npm install express-session connect-pg-simple bcryptjs
 *
 *   In server/index.js, add before routes:
 *     const session    = require('express-session');
 *     const PgSession  = require('connect-pg-simple')(session);
 *     app.use(session({
 *       store:             new PgSession({ pool, tableName: 'user_sessions' }),
 *       secret:            process.env.SESSION_SECRET,
 *       resave:            false,
 *       saveUninitialized: false,
 *       cookie:            { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
 *     }));
 *
 *   Add to schema.sql:
 *     CREATE TABLE IF NOT EXISTS users (
 *       id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
 *       email         TEXT        UNIQUE NOT NULL,
 *       password_hash TEXT        NOT NULL,
 *       created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
 *     );
 *
 *   Add POST /api/auth/register and POST /api/auth/login routes
 *   that set req.session.userId on successful login.
 */

'use strict';

/**
 * Express middleware that rejects unauthenticated requests.
 * @type {import('express').RequestHandler}
 */
function requireAuth(req, res, next) {
  if (req.session?.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — please log in' });
}

module.exports = requireAuth;
