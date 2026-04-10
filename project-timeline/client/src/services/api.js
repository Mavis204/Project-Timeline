/**
 * api.js — Centralized data service layer.
 *
 * CURRENT IMPLEMENTATION: localStorage (works offline, no server needed)
 * FULL-STACK MIGRATION: Replace each method body with the fetch() call shown
 * in the JSDoc comment above it. Signatures and return shapes stay IDENTICAL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPRESS ROUTES (server/routes/state.js):
 *
 *   const router = require('express').Router();
 *   const ctrl   = require('../controllers/stateController');
 *
 *   router.get ('/',       ctrl.getState);      // api.loadState()
 *   router.put ('/',       ctrl.putState);      // api.saveState(data)
 *   router.get ('/legacy', ctrl.getLegacy);     // api.loadLegacy()
 *
 *   module.exports = router;
 *
 * Mount in server/index.js:
 *   app.use('/api/state', require('./routes/state'));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTGRESQL SCHEMA (server/db/schema.sql):
 *
 *   CREATE TABLE IF NOT EXISTS app_state (
 *     user_id    TEXT        PRIMARY KEY,
 *     data       JSONB       NOT NULL,
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTROLLER (server/controllers/stateController.js):
 *
 *   const pool = require('../db/pool');
 *
 *   exports.getState = async (req, res) => {
 *     try {
 *       const userId = req.user?.id ?? 'default';
 *       const { rows } = await pool.query(
 *         'SELECT data FROM app_state WHERE user_id = $1',
 *         [userId]
 *       );
 *       res.json(rows[0]?.data ?? null);
 *     } catch (err) {
 *       console.error(err);
 *       res.status(500).json({ error: 'Failed to load state' });
 *     }
 *   };
 *
 *   exports.putState = async (req, res) => {
 *     try {
 *       const userId = req.user?.id ?? 'default';
 *       await pool.query(
 *         `INSERT INTO app_state (user_id, data)
 *          VALUES ($1, $2)
 *          ON CONFLICT (user_id)
 *          DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
 *         [userId, req.body]
 *       );
 *       res.sendStatus(204);
 *     } catch (err) {
 *       console.error(err);
 *       res.status(500).json({ error: 'Failed to save state' });
 *     }
 *   };
 *
 *   exports.getLegacy = async (req, res) => {
 *     // Only needed during one-time migration from localStorage.
 *     // After migration, this endpoint can be removed.
 *     res.json(null);
 *   };
 */

const api = {
  /**
   * Load the full persisted app state.
   * @returns {Promise<object|null>} Parsed state object, or null if none exists.
   */
  async loadState() {
    try {
      console.log("[loadState] Attempting to load state...");
      const res = await fetch("/api/state", { credentials: "include" });
      if (!res.ok) {
        console.warn("[loadState] HTTP error:", res.status);
        return null;
      }
      const data = await res.json();
      console.log(
        "[loadState] Loaded state successfully, projects:",
        data.teamData?.[Object.keys(data.teamData || {})[0]]?.projects
          ?.length || 0,
      );
      return data;
    } catch (err) {
      console.error("[loadState]", err);
      return null;
    }
  },

  /**
   * Persist the full app state.
   * @param {object} data - The complete state tree to persist.
   * @returns {Promise<void>}
   */
  async saveState(data) {
    try {
      console.log("[saveState] Attempting to save state...");
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        const errorMsg = error.error || `HTTP ${res.status}`;
        console.error("[saveState] Failed:", errorMsg);
        throw new Error(errorMsg);
      }
      console.log("[saveState] State saved successfully");
    } catch (err) {
      console.error("[saveState] Error:", err.message);
    }
  },

  /**
   * Load state from old localStorage keys (one-time migration helper).
   * @returns {Promise<object|null>} Legacy raw state, or null if none exists.
   */
  async loadLegacy() {
    try {
      const res = await fetch("/api/state/legacy", { credentials: "include" });
      return res.ok ? res.json() : null;
    } catch (err) {
      console.error("[loadLegacy]", err);
      return null;
    }
  },
};

export default api;
