/**
 * server/routes/state.js
 *
 * Mounts state persistence endpoints.
 * Mounted at /api/state in server/index.js.
 *
 * Routes:
 *   GET  /api/state        → load full app state
 *   PUT  /api/state        → save full app state
 *   GET  /api/state/legacy → legacy migration (returns null on fresh installs)
 *
 * To add authentication protection, uncomment the requireAuth middleware line
 * and create server/middleware/requireAuth.js.
 */

"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/stateController");
const requireAuth = require("../middleware/requireAuth");

// Protect all state routes
router.use(requireAuth);

router.get("/legacy", ctrl.getLegacy); // must be before '/' to avoid conflict
router.get("/", ctrl.getState);
router.put("/", ctrl.putState);

module.exports = router;
