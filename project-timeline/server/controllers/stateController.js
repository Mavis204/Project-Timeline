/**
 * server/controllers/stateController.js
 *
 * Handles persistence of the full app state tree as a JSONB blob in PostgreSQL.
 * Maps 1-to-1 with the methods in client/src/services/api.js:
 *
 *   api.loadState()   →  GET  /api/state  →  exports.getState
 *   api.saveState(d)  →  PUT  /api/state  →  exports.putState
 *   api.loadLegacy()  →  GET  /api/state/legacy  →  exports.getLegacy
 *
 * USER IDENTITY:
 *   Currently uses a hardcoded 'default' user ID (single-user mode).
 *   When you add authentication (e.g. express-session, JWT, Passport),
 *   replace `getUserId(req)` to return the real authenticated user ID.
 *
 * ADDING AUTH (GitHub Copilot hint):
 *   1. Install: npm install express-session connect-pg-simple bcryptjs
 *   2. Add session middleware in server/index.js
 *   3. Add POST /api/auth/login and POST /api/auth/register routes
 *   4. Add requireAuth middleware (server/middleware/requireAuth.js)
 *   5. Apply requireAuth to the /api/state router
 *   6. Replace getUserId below: return req.session.userId;
 */

"use strict";

const pool = require("../db/pool");

/**
 * Resolve the current user's ID from the request.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getUserId(req) {
  // Multi-user mode: return authenticated user ID from session
  return req.session?.userId ?? null;
}

/**
 * GET /api/state
 * Returns the stored state JSONB for this user, or null if none exists.
 *
 * Response: 200 { ...stateObject }  |  200 null
 */
exports.getState = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const { rows } = await pool.query(
      "SELECT data FROM app_state WHERE user_id = $1",
      [userId],
    );
    // Return null (not 404) so the client falls back to mkInitialState()
    res.json(rows[0]?.data ?? null);
  } catch (err) {
    console.error("[getState]", err.message);
    res.status(500).json({ error: "Failed to load state" });
  }
};

/**
 * PUT /api/state
 * Upserts the full state JSONB for this user.
 *
 * Body: { ...fullStateObject }
 * Response: 204 No Content
 */
exports.putState = async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    await pool.query(
      `INSERT INTO app_state (user_id, data)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [userId, data],
    );

    res.sendStatus(204);
  } catch (err) {
    console.error("[putState]", err.message);
    res.status(500).json({ error: "Failed to save state" });
  }
};

/**
 * GET /api/state/legacy
 * One-time migration endpoint — returns null once all users have migrated.
 * The client calls this only if api.loadState() returns null.
 *
 * In a real multi-user rollout you'd query an old table here.
 * For a fresh install, this always returns null.
 *
 * Response: 200 null
 */
exports.getLegacy = async (_req, res) => {
  // Nothing to migrate server-side on a fresh install.
  // Old localStorage data is migrated by the client on first load.
  res.json(null);
};
