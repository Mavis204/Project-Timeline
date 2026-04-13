/**
 * server/controllers/authController.js
 *
 * Handles user authentication (register, login, logout).
 */

"use strict";

const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

/**
 * POST /api/auth/register
 * Create a new user account.
 *
 * Body: { email: string, password: string }
 * Response: 201 { userId: string, email: string }  |  400/409 error
 */
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // Check if user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), passwordHash],
    );

    const user = rows[0];

    // Set session
    req.session.userId = user.id;
    console.log(
      "[register] Session set for user:",
      user.id,
      "Session ID:",
      req.sessionID,
    );

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error("[register] Session save error:", err.message);
        return res.status(500).json({ error: "Failed to save session" });
      }
      console.log("[register] Session saved successfully");
      console.log(
        "[register] All headers:",
        JSON.stringify(res.getHeaders(), null, 2),
      );
      console.log("[register] Set-Cookie header:", res.getHeader("set-cookie"));
      res.status(201).json({
        userId: user.id,
        email: user.email,
      });
    });
  } catch (err) {
    console.error("[register]", err.message);
    res.status(500).json({ error: "Failed to register" });
  }
};

/**
 * POST /api/auth/login
 * Authenticate a user and create a session.
 *
 * Body: { email: string, password: string }
 * Response: 200 { userId: string, email: string }  |  401 error
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Find user
    const { rows } = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email.toLowerCase()],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Set session
    req.session.userId = user.id;
    console.log(
      "[login] Session set for user:",
      user.id,
      "Session ID:",
      req.sessionID,
    );

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        console.error("[login] Session save error:", err.message);
        return res.status(500).json({ error: "Failed to save session" });
      }
      console.log("[login] Session saved successfully");
      console.log(
        "[login] All headers:",
        JSON.stringify(res.getHeaders(), null, 2),
      );
      console.log("[login] Set-Cookie header:", res.getHeader("set-cookie"));
      res.json({
        userId: user.id,
        email: user.email,
      });
    });
  } catch (err) {
    console.error("[login]", err.message);
    res.status(500).json({ error: "Failed to log in" });
  }
};

/**
 * POST /api/auth/logout
 * Clear the session.
 *
 * Response: 204 No Content
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("[logout]", err.message);
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.sendStatus(204);
  });
};

/**
 * GET /api/auth/me
 * Get the current user's info (requires active session).
 *
 * Safely handles missing sessions:
 *   - If no session → 401 (Not logged in)
 *   - If user not in DB → 401 (Session invalid)
 *   - If DB error → 500 (Server error)
 *
 * Response: 200 { userId: string, email: string }  |  401 Unauthorized  |  500 Server Error
 */
exports.getMe = async (req, res) => {
  try {
    // Safely check for session and userId
    const userId = req.session?.userId;

    console.log(
      "[getMe] Session ID:",
      req.sessionID,
      "User ID:",
      userId || "none",
    );

    // No session or no userId in session
    if (!userId) {
      console.log("[getMe] No session user ID found - returning 401");
      return res.status(401).json(null);
    }

    // Query database for user
    let rows;
    try {
      const result = await pool.query(
        "SELECT id, email FROM users WHERE id = $1",
        [userId],
      );
      rows = result.rows;
    } catch (dbErr) {
      console.error("[getMe] Database query failed:", dbErr.message);
      return res.status(500).json({ error: "Database error" });
    }

    // User not found in database
    if (!rows || rows.length === 0) {
      console.log("[getMe] User ID " + userId + " not found in database");
      return res.status(401).json(null);
    }

    const user = rows[0];
    console.log("[getMe] User found:", user.email);

    // Success - return user info
    res.status(200).json({
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error("[getMe] Unexpected error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to get user info" });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("[deleteAccount] Session destroy error:", err.message);
        return res
          .status(500)
          .json({ error: "Account deleted but failed to clear session" });
      }

      res.clearCookie("connect.sid");
      return res.sendStatus(204);
    });
  } catch (err) {
    console.error("[deleteAccount]", err.message);
    res.status(500).json({ error: "Failed to delete account" });
  }
};
