/**
 * server/routes/auth.js
 *
 * Authentication routes.
 * Mounted at /api/auth in server/index.js.
 *
 * Routes:
 *   POST /api/auth/register  → create new account
 *   POST /api/auth/login     → authenticate and create session
 *   POST /api/auth/logout    → clear session
 *   GET  /api/auth/me        → get current user info
 */

"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/authController");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/logout", ctrl.logout);
router.get("/me", ctrl.getMe);
router.delete("/account", ctrl.deleteAccount);

module.exports = router;
