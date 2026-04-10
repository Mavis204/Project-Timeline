"use strict";
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

/**
 * server/index.js — Express application entry point.
 *
 * Responsibilities:
 *   - Connect to PostgreSQL via pool
 *   - Mount API routes under /api
 *   - Serve the built React client in production
 *   - Start HTTP server
 *
 * SETUP:
 *   1. cp .env.example .env   (fill in DATABASE_URL and PORT)
 *   2. psql $DATABASE_URL < db/schema.sql
 *   3. node index.js          (or: npm run dev with nodemon)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const pool = require("./db/pool");
const stateRouter = require("./routes/state");
const authRouter = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ──────────────────────────────────────────────────────────── */
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" })); // state blobs can be large

// Session middleware
app.use(
  session({
    store: new PgSession({ pool, tableName: "user_sessions" }),
    secret: process.env.SESSION_SECRET || "dev-secret-changeme",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Ensure session object always exists (for safety)
app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  next();
});

/* ── API routes ──────────────────────────────────────────────────────────── */
app.use("/api/auth", authRouter);
app.use("/api/state", stateRouter);

// Health check — useful for Docker / load balancer probes
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ── Serve built React client in production ──────────────────────────────── */
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

/* ── Start ───────────────────────────────────────────────────────────────── */
async function start() {
  try {
    // Verify DB connection before accepting traffic
    await pool.query("SELECT 1");
    console.log("✓ PostgreSQL connected");

    app.listen(PORT, () => {
      console.log(`✓ Server listening on http://localhost:${PORT}`);
      if (process.env.NODE_ENV !== "production") {
        console.log("  API:    http://localhost:" + PORT + "/api/state");
        console.log(
          "  Client: http://localhost:5173 (run: cd client && npm run dev)",
        );
      }
    });
  } catch (err) {
    console.error("✗ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
